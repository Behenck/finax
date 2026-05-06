import {
	CustomerDocumentType,
	CustomerPersonType,
	CustomerStatus,
	SaleCommissionDirection,
	SaleCommissionInstallmentStatus,
	SaleCommissionRecipientType,
	SaleCommissionSourceType,
	SaleDynamicFieldType,
	SaleStatus,
} from "generated/prisma/enums";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { makeUser } from "../../factories/make-user";
import { createTestApp } from "../../utils/test-app";

let app: Awaited<ReturnType<typeof createTestApp>>;

const IMPORT_DATE = "2026-03-15";

function baseImportBody(params: { rows: Array<Record<string, unknown>> }) {
	return {
		fileType: "XLSX",
		headerSignature: "sha256:commission-receipt-import-tests",
		importDate: IMPORT_DATE,
		rows: params.rows,
		mapping: {
			fields: {
				saleDateColumn: "DataVenda",
				groupColumn: "Grupo",
				quotaColumn: "Cota",
				installmentColumn: "Parcela",
				receivedAmountColumn: "Valor",
			},
		},
	};
}

function baseImportBodyWithMapping(params: {
	rows: Array<Record<string, unknown>>;
	mapping: {
		saleDateColumn: string;
		groupColumn: string;
		quotaColumn: string;
		installmentColumn: string;
		receivedAmountColumn: string;
	};
}) {
	return {
		fileType: "XLSX",
		headerSignature: "sha256:commission-receipt-import-tests-custom-mapping",
		importDate: IMPORT_DATE,
		rows: params.rows,
		mapping: {
			fields: params.mapping,
		},
	};
}

async function createFixture() {
	const { user, org } = await makeUser();

	const loginResponse = await request(app.server)
		.post("/sessions/password")
		.send({
			email: user.email,
			password: user.password,
		});
	expect(loginResponse.statusCode).toBe(200);

	const token = loginResponse.body.accessToken as string;
	const suffix = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`;

	const company = await prisma.company.create({
		data: {
			name: `Empresa ${suffix}`,
			organizationId: org.id,
		},
	});

	const customer = await prisma.customer.create({
		data: {
			organizationId: org.id,
			personType: CustomerPersonType.PF,
			name: `Cliente ${suffix}`,
			documentType: CustomerDocumentType.CPF,
			documentNumber: `777777777${Math.floor(Math.random() * 9)}`,
			status: CustomerStatus.ACTIVE,
		},
	});

	const product = await prisma.product.create({
		data: {
			organizationId: org.id,
			name: `Produto ${suffix}`,
			description: "Produto para testes de importação de recebimentos",
			isActive: true,
		},
	});

	return {
		org,
		user,
		token,
		company,
		customer,
		product,
	};
}

async function createSaleWithIncomeInstallment(params: {
	organizationId: string;
	createdById: string;
	companyId: string;
	customerId: string;
	productId: string;
	group: string | number;
	quota: string | number;
	amount: number;
	saleStatus?: SaleStatus;
	installmentStatus?: SaleCommissionInstallmentStatus;
}) {
	const groupFieldId = crypto.randomUUID();
	const quotaFieldId = crypto.randomUUID();
	const saleDate = new Date(`${IMPORT_DATE}T00:00:00.000Z`);

	const sale = await prisma.sale.create({
		data: {
			organizationId: params.organizationId,
			companyId: params.companyId,
			customerId: params.customerId,
			productId: params.productId,
			saleDate,
			totalAmount: 500_000,
			status: params.saleStatus ?? SaleStatus.COMPLETED,
			dynamicFieldSchema: [
				{
					fieldId: groupFieldId,
					label: "Grupo",
					type: SaleDynamicFieldType.TEXT,
					required: false,
					options: [],
				},
				{
					fieldId: quotaFieldId,
					label: "Cota",
					type: SaleDynamicFieldType.TEXT,
					required: false,
					options: [],
				},
			],
			dynamicFieldValues: {
				[groupFieldId]: params.group,
				[quotaFieldId]: params.quota,
			},
			createdById: params.createdById,
		},
	});

	const commission = await prisma.saleCommission.create({
		data: {
			saleId: sale.id,
			sourceType: SaleCommissionSourceType.MANUAL,
			recipientType: SaleCommissionRecipientType.COMPANY,
			direction: SaleCommissionDirection.INCOME,
			beneficiaryCompanyId: params.companyId,
			startDate: saleDate,
			totalPercentage: 10_000,
			sortOrder: 0,
		},
		select: {
			id: true,
		},
	});

	const installment = await prisma.saleCommissionInstallment.create({
		data: {
			saleCommissionId: commission.id,
			installmentNumber: 1,
			percentage: 10_000,
			amount: params.amount,
			status:
				params.installmentStatus ?? SaleCommissionInstallmentStatus.PENDING,
			expectedPaymentDate: saleDate,
		},
	});

	return {
		sale,
		commission,
		installment,
	};
}

async function findLatestInstallmentReversalMovement(
	originInstallmentId: string,
) {
	return prisma.saleCommissionInstallment.findFirst({
		where: {
			originInstallmentId,
			status: SaleCommissionInstallmentStatus.REVERSED,
		},
		orderBy: {
			createdAt: "desc",
		},
		select: {
			id: true,
			originInstallmentId: true,
			status: true,
			amount: true,
			paymentDate: true,
			reversedFromStatus: true,
			reversedFromAmount: true,
			reversedFromPaymentDate: true,
		},
	});
}

describe("commission receipt import", () => {
	beforeAll(async () => {
		app = await createTestApp();
	});

	afterAll(async () => {
		await app.close();
	});

	it("should create, list, update and delete commission receipt import templates", async () => {
		const fixture = await createFixture();
		const headerSignature = "sha256:commission-template-signature";
		const mapping = {
			fields: {
				saleDateColumn: "DataVenda",
				groupColumn: "Grupo",
				quotaColumn: "Cota",
				installmentColumn: "Parcela",
				receivedAmountColumn: "Valor",
			},
		};

		const createResponse = await request(app.server)
			.post(
				`/organizations/${fixture.org.slug}/commissions/receipts/import-templates`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				name: "Template Administradora",
				headerSignature,
				mapping,
			});

		expect(createResponse.statusCode).toBe(201);
		const templateId = createResponse.body.templateId as string;
		expect(templateId).toBeTypeOf("string");

		const listResponse = await request(app.server)
			.get(
				`/organizations/${fixture.org.slug}/commissions/receipts/import-templates?headerSignature=${encodeURIComponent(
					headerSignature,
				)}`,
			)
			.set("Authorization", `Bearer ${fixture.token}`);

		expect(listResponse.statusCode).toBe(200);
		expect(listResponse.body.templates).toHaveLength(1);
		expect(listResponse.body.templates[0]).toMatchObject({
			id: templateId,
			name: "Template Administradora",
			isSuggested: true,
			mapping,
		});

		const updateResponse = await request(app.server)
			.put(
				`/organizations/${fixture.org.slug}/commissions/receipts/import-templates/${templateId}`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				name: "Template Atualizado",
				headerSignature,
				mapping,
			});

		expect(updateResponse.statusCode).toBe(204);

		const deleteResponse = await request(app.server)
			.delete(
				`/organizations/${fixture.org.slug}/commissions/receipts/import-templates/${templateId}`,
			)
			.set("Authorization", `Bearer ${fixture.token}`);

		expect(deleteResponse.statusCode).toBe(204);
	});

	it("should mark row as READY when positive value matches a single pending income installment", async () => {
		const fixture = await createFixture();
		const created = await createSaleWithIncomeInstallment({
			organizationId: fixture.org.id,
			createdById: fixture.user.id,
			companyId: fixture.company.id,
			customerId: fixture.customer.id,
			productId: fixture.product.id,
			group: "Grúpô Azul",
			quota: "0001",
			amount: 15_000,
		});

		const response = await request(app.server)
			.post(
				`/organizations/${fixture.org.slug}/commissions/receipts/imports/preview`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send(
				baseImportBody({
					rows: [
						{
							DataVenda: IMPORT_DATE,
							Grupo: "grupo azul",
							Cota: "0001",
							Parcela: "01 de 01",
							Valor: "150,00",
						},
					],
				}),
			);

		expect(response.statusCode).toBe(200);
		expect(response.body.summary.readyRows).toBe(1);
		expect(response.body.rows[0]).toMatchObject({
			rowNumber: 1,
			status: "READY",
			action: "MARK_AS_PAID",
			saleId: created.sale.id,
			installmentId: created.installment.id,
		});
	});

	it("should use the mapped received amount column and parse dot/comma decimal formats", async () => {
		const fixture = await createFixture();
		const created = await createSaleWithIncomeInstallment({
			organizationId: fixture.org.id,
			createdById: fixture.user.id,
			companyId: fixture.company.id,
			customerId: fixture.customer.id,
			productId: fixture.product.id,
			group: "Grupo Coluna Valor",
			quota: "901",
			amount: 15_000,
		});

		const response = await request(app.server)
			.post(
				`/organizations/${fixture.org.slug}/commissions/receipts/imports/preview`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send(
				baseImportBodyWithMapping({
					rows: [
						{
							DataVenda: "15/03/2026",
							Grupo: "Grupo Coluna Valor",
							Cota: "901",
							Parcela: "1",
							ValorErrado: "999,99",
							ValorCorreto: "150.00",
						},
					],
					mapping: {
						saleDateColumn: "DataVenda",
						groupColumn: "Grupo",
						quotaColumn: "Cota",
						installmentColumn: "Parcela",
						receivedAmountColumn: "ValorCorreto",
					},
				}),
			);

		expect(response.statusCode).toBe(200);
		expect(response.body.summary.readyRows).toBe(1);
		expect(response.body.rows[0]).toMatchObject({
			rowNumber: 1,
			status: "READY",
			action: "MARK_AS_PAID",
			saleId: created.sale.id,
			installmentId: created.installment.id,
		});
		expect(response.body.rows[0].receivedAmount).toBe(15_000);
	});

	it("should match group and quota ignoring leading zeros when import row is numeric", async () => {
		const fixture = await createFixture();
		const created = await createSaleWithIncomeInstallment({
			organizationId: fixture.org.id,
			createdById: fixture.user.id,
			companyId: fixture.company.id,
			customerId: fixture.customer.id,
			productId: fixture.product.id,
			group: "005488",
			quota: "0616",
			amount: 15_000,
		});

		const response = await request(app.server)
			.post(
				`/organizations/${fixture.org.slug}/commissions/receipts/imports/preview`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send(
				baseImportBody({
					rows: [
						{
							DataVenda: IMPORT_DATE,
							Grupo: 5488,
							Cota: 616,
							Parcela: "1",
							Valor: "150,00",
						},
					],
				}),
			);

		expect(response.statusCode).toBe(200);
		expect(response.body.rows[0]).toMatchObject({
			status: "READY",
			action: "MARK_AS_PAID",
			saleId: created.sale.id,
			installmentId: created.installment.id,
		});
	});

	it("should match group and quota ignoring leading zeros when stored sale values are numeric", async () => {
		const fixture = await createFixture();
		const created = await createSaleWithIncomeInstallment({
			organizationId: fixture.org.id,
			createdById: fixture.user.id,
			companyId: fixture.company.id,
			customerId: fixture.customer.id,
			productId: fixture.product.id,
			group: 5488,
			quota: 616,
			amount: 15_000,
		});

		const response = await request(app.server)
			.post(
				`/organizations/${fixture.org.slug}/commissions/receipts/imports/preview`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send(
				baseImportBody({
					rows: [
						{
							DataVenda: IMPORT_DATE,
							Grupo: "005488",
							Cota: "0616",
							Parcela: "1",
							Valor: "150,00",
						},
					],
				}),
			);

		expect(response.statusCode).toBe(200);
		expect(response.body.rows[0]).toMatchObject({
			status: "READY",
			action: "MARK_AS_PAID",
			saleId: created.sale.id,
			installmentId: created.installment.id,
		});
	});

	it("should keep alphanumeric group and quota matching as exact normalized text", async () => {
		const fixture = await createFixture();
		await createSaleWithIncomeInstallment({
			organizationId: fixture.org.id,
			createdById: fixture.user.id,
			companyId: fixture.company.id,
			customerId: fixture.customer.id,
			productId: fixture.product.id,
			group: "000A5488",
			quota: "00B616",
			amount: 15_000,
		});

		const response = await request(app.server)
			.post(
				`/organizations/${fixture.org.slug}/commissions/receipts/imports/preview`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send(
				baseImportBody({
					rows: [
						{
							DataVenda: IMPORT_DATE,
							Grupo: "A5488",
							Cota: "B616",
							Parcela: "1",
							Valor: "150,00",
						},
					],
				}),
			);

		expect(response.statusCode).toBe(200);
		expect(response.body.rows[0]).toMatchObject({
			status: "ATTENTION",
			action: "NONE",
		});
		expect(response.body.rows[0].reason).toContain("Nenhuma venda encontrada");
	});

	it("should classify attention and no-action scenarios in preview", async () => {
		const fixture = await createFixture();
		await createSaleWithIncomeInstallment({
			organizationId: fixture.org.id,
			createdById: fixture.user.id,
			companyId: fixture.company.id,
			customerId: fixture.customer.id,
			productId: fixture.product.id,
			group: "Grupo Base",
			quota: "100",
			amount: 12_000,
		});
		await createSaleWithIncomeInstallment({
			organizationId: fixture.org.id,
			createdById: fixture.user.id,
			companyId: fixture.company.id,
			customerId: fixture.customer.id,
			productId: fixture.product.id,
			group: "Grupo Pago",
			quota: "200",
			amount: 9_000,
			installmentStatus: SaleCommissionInstallmentStatus.PAID,
		});
		await createSaleWithIncomeInstallment({
			organizationId: fixture.org.id,
			createdById: fixture.user.id,
			companyId: fixture.company.id,
			customerId: fixture.customer.id,
			productId: fixture.product.id,
			group: "Grupo Duplicado",
			quota: "300",
			amount: 10_000,
		});
		await createSaleWithIncomeInstallment({
			organizationId: fixture.org.id,
			createdById: fixture.user.id,
			companyId: fixture.company.id,
			customerId: fixture.customer.id,
			productId: fixture.product.id,
			group: "Grupo Duplicado",
			quota: "300",
			amount: 10_000,
		});

		const response = await request(app.server)
			.post(
				`/organizations/${fixture.org.slug}/commissions/receipts/imports/preview`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send(
				baseImportBody({
					rows: [
						{
							DataVenda: IMPORT_DATE,
							Grupo: "Grupo Base",
							Cota: "100",
							Parcela: "1",
							Valor: "-20,00",
						},
						{
							DataVenda: IMPORT_DATE,
							Grupo: "Grupo Base",
							Cota: "100",
							Parcela: "01/01",
							Valor: "140,00",
						},
						{
							DataVenda: IMPORT_DATE,
							Grupo: "Grupo Inexistente",
							Cota: "999",
							Parcela: "1",
							Valor: "50,00",
						},
						{
							DataVenda: IMPORT_DATE,
							Grupo: "Grupo Duplicado",
							Cota: "300",
							Parcela: "1",
							Valor: "100,00",
						},
						{
							DataVenda: IMPORT_DATE,
							Grupo: "Grupo Base",
							Cota: "100",
							Parcela: "1",
							Valor: "0",
						},
						{
							DataVenda: IMPORT_DATE,
							Grupo: "Grupo Pago",
							Cota: "200",
							Parcela: "1",
							Valor: "90,00",
						},
					],
				}),
			);

		expect(response.statusCode).toBe(200);
		expect(response.body.summary.readyRows).toBe(2);
		expect(response.body.summary.attentionRows).toBe(2);
		expect(response.body.summary.noActionRows).toBe(2);
		expect(response.body.rows[0]).toMatchObject({
			status: "READY",
			action: "REVERSE_INSTALLMENT",
		});
		expect(response.body.rows[1]).toMatchObject({
			status: "READY",
			action: "UPDATE_AMOUNT_AND_MARK_AS_PAID",
		});
		expect(
			response.body.rows.map((row: { status: string }) => row.status),
		).toEqual([
			"READY",
			"READY",
			"ATTENTION",
			"ATTENTION",
			"NO_ACTION",
			"NO_ACTION",
		]);
	});

	it("should mark ATTENTION for negative row targeting an already reversed installment", async () => {
		const fixture = await createFixture();
		await createSaleWithIncomeInstallment({
			organizationId: fixture.org.id,
			createdById: fixture.user.id,
			companyId: fixture.company.id,
			customerId: fixture.customer.id,
			productId: fixture.product.id,
			group: "Grupo Já Estornado",
			quota: "305",
			amount: -9_000,
			installmentStatus: SaleCommissionInstallmentStatus.REVERSED,
		});

		const response = await request(app.server)
			.post(
				`/organizations/${fixture.org.slug}/commissions/receipts/imports/preview`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send(
				baseImportBody({
					rows: [
						{
							DataVenda: IMPORT_DATE,
							Grupo: "Grupo Já Estornado",
							Cota: "305",
							Parcela: "1",
							Valor: "-20,00",
						},
					],
				}),
			);

		expect(response.statusCode).toBe(200);
		expect(response.body.summary.attentionRows).toBe(1);
		expect(response.body.rows[0]).toMatchObject({
			status: "ATTENTION",
			action: "NONE",
			installmentStatus: "REVERSED",
		});
	});

	it("should mark ATTENTION when reversal amount exceeds remaining base amount", async () => {
		const fixture = await createFixture();
		const created = await createSaleWithIncomeInstallment({
			organizationId: fixture.org.id,
			createdById: fixture.user.id,
			companyId: fixture.company.id,
			customerId: fixture.customer.id,
			productId: fixture.product.id,
			group: "Grupo Limite Estorno",
			quota: "801",
			amount: 10_000,
			installmentStatus: SaleCommissionInstallmentStatus.PENDING,
		});

		await prisma.saleCommissionInstallment.create({
			data: {
				saleCommissionId: created.commission.id,
				originInstallmentId: created.installment.id,
				installmentNumber: created.installment.installmentNumber,
				percentage: created.installment.percentage,
				amount: -7_000,
				status: SaleCommissionInstallmentStatus.REVERSED,
				expectedPaymentDate: created.installment.expectedPaymentDate,
				paymentDate: new Date(`${IMPORT_DATE}T00:00:00.000Z`),
			},
		});

		const response = await request(app.server)
			.post(
				`/organizations/${fixture.org.slug}/commissions/receipts/imports/preview`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send(
				baseImportBody({
					rows: [
						{
							DataVenda: IMPORT_DATE,
							Grupo: "Grupo Limite Estorno",
							Cota: "801",
							Parcela: "1",
							Valor: "-40,00",
						},
					],
				}),
			);

		expect(response.statusCode).toBe(200);
		expect(response.body.rows[0]).toMatchObject({
			status: "ATTENTION",
			action: "NONE",
		});
		expect(response.body.rows[0].reason).toContain("excede");
	});

	it("should mark READY for direct full reversal on base installment", async () => {
		const fixture = await createFixture();
		await createSaleWithIncomeInstallment({
			organizationId: fixture.org.id,
			createdById: fixture.user.id,
			companyId: fixture.company.id,
			customerId: fixture.customer.id,
			productId: fixture.product.id,
			group: "Grupo Estorno Total Preview",
			quota: "802",
			amount: 5_000,
			installmentStatus: SaleCommissionInstallmentStatus.PENDING,
		});

		const response = await request(app.server)
			.post(
				`/organizations/${fixture.org.slug}/commissions/receipts/imports/preview`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send(
				baseImportBody({
					rows: [
						{
							DataVenda: IMPORT_DATE,
							Grupo: "Grupo Estorno Total Preview",
							Cota: "802",
							Parcela: "1",
							Valor: "-50,00",
						},
					],
				}),
			);

		expect(response.statusCode).toBe(200);
		expect(response.body.rows[0]).toMatchObject({
			status: "READY",
			action: "REVERSE_INSTALLMENT",
		});
		expect(response.body.rows[0].reason).toContain("estornar totalmente");
	});

	it("should apply selected READY rows with paymentDate = importDate and keep installment amount", async () => {
		const fixture = await createFixture();
		const created = await createSaleWithIncomeInstallment({
			organizationId: fixture.org.id,
			createdById: fixture.user.id,
			companyId: fixture.company.id,
			customerId: fixture.customer.id,
			productId: fixture.product.id,
			group: "Grupo Aplicar",
			quota: "500",
			amount: 21_000,
		});

		const applyResponse = await request(app.server)
			.post(
				`/organizations/${fixture.org.slug}/commissions/receipts/imports/apply`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				...baseImportBody({
					rows: [
						{
							DataVenda: IMPORT_DATE,
							Grupo: "Grupo Aplicar",
							Cota: "500",
							Parcela: "01/01",
							Valor: "210,00",
						},
					],
				}),
				selectedRowNumbers: [1],
			});

		expect(applyResponse.statusCode).toBe(200);
		expect(applyResponse.body).toMatchObject({
			requested: 1,
			applied: 1,
			skipped: 0,
		});

		const updatedInstallment =
			await prisma.saleCommissionInstallment.findUnique({
				where: {
					id: created.installment.id,
				},
				select: {
					status: true,
					amount: true,
					paymentDate: true,
				},
			});

		expect(updatedInstallment?.status).toBe(
			SaleCommissionInstallmentStatus.PAID,
		);
		expect(updatedInstallment?.amount).toBe(21_000);
		expect(updatedInstallment?.paymentDate?.toISOString().slice(0, 10)).toBe(
			IMPORT_DATE,
		);
	});

	it("should not change a READY divergent row when it is not selected for apply", async () => {
		const fixture = await createFixture();
		await createSaleWithIncomeInstallment({
			organizationId: fixture.org.id,
			createdById: fixture.user.id,
			companyId: fixture.company.id,
			customerId: fixture.customer.id,
			productId: fixture.product.id,
			group: "Grupo Selecionado",
			quota: "610",
			amount: 20_000,
		});
		const divergent = await createSaleWithIncomeInstallment({
			organizationId: fixture.org.id,
			createdById: fixture.user.id,
			companyId: fixture.company.id,
			customerId: fixture.customer.id,
			productId: fixture.product.id,
			group: "Grupo Divergente Não Selecionado",
			quota: "611",
			amount: 22_000,
		});

		const applyResponse = await request(app.server)
			.post(
				`/organizations/${fixture.org.slug}/commissions/receipts/imports/apply`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				...baseImportBody({
					rows: [
						{
							DataVenda: IMPORT_DATE,
							Grupo: "Grupo Selecionado",
							Cota: "610",
							Parcela: "01/01",
							Valor: "200,00",
						},
						{
							DataVenda: IMPORT_DATE,
							Grupo: "Grupo Divergente Não Selecionado",
							Cota: "611",
							Parcela: "01/01",
							Valor: "250,00",
						},
					],
				}),
				selectedRowNumbers: [1],
			});

		expect(applyResponse.statusCode).toBe(200);
		expect(applyResponse.body).toMatchObject({
			requested: 1,
			applied: 1,
			skipped: 0,
		});

		const divergentInstallment =
			await prisma.saleCommissionInstallment.findUnique({
				where: {
					id: divergent.installment.id,
				},
				select: {
					status: true,
					amount: true,
					paymentDate: true,
				},
			});

		expect(divergentInstallment?.status).toBe(
			SaleCommissionInstallmentStatus.PENDING,
		);
		expect(divergentInstallment?.amount).toBe(22_000);
		expect(divergentInstallment?.paymentDate).toBeNull();
	});

	it("should apply selected divergent READY row updating amount and marking installment as paid", async () => {
		const fixture = await createFixture();
		const created = await createSaleWithIncomeInstallment({
			organizationId: fixture.org.id,
			createdById: fixture.user.id,
			companyId: fixture.company.id,
			customerId: fixture.customer.id,
			productId: fixture.product.id,
			group: "Grupo Divergente Aplicar",
			quota: "700",
			amount: 24_000,
		});

		const applyResponse = await request(app.server)
			.post(
				`/organizations/${fixture.org.slug}/commissions/receipts/imports/apply`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				...baseImportBody({
					rows: [
						{
							DataVenda: IMPORT_DATE,
							Grupo: "Grupo Divergente Aplicar",
							Cota: "700",
							Parcela: "01/01",
							Valor: "280,00",
						},
					],
				}),
				selectedRowNumbers: [1],
			});

		expect(applyResponse.statusCode).toBe(200);
		expect(applyResponse.body).toMatchObject({
			requested: 1,
			applied: 1,
			skipped: 0,
		});
		expect(applyResponse.body.results[0]).toMatchObject({
			rowNumber: 1,
			result: "APPLIED",
			reason: "Parcela atualizada e marcada como paga com sucesso.",
		});

		const updatedInstallment =
			await prisma.saleCommissionInstallment.findUnique({
				where: {
					id: created.installment.id,
				},
				select: {
					status: true,
					amount: true,
					paymentDate: true,
				},
			});

		expect(updatedInstallment?.status).toBe(
			SaleCommissionInstallmentStatus.PAID,
		);
		expect(updatedInstallment?.amount).toBe(28_000);
		expect(updatedInstallment?.paymentDate?.toISOString().slice(0, 10)).toBe(
			IMPORT_DATE,
		);
	});

	it("should apply selected negative READY row by creating linked reversal movement", async () => {
		const fixture = await createFixture();
		const created = await createSaleWithIncomeInstallment({
			organizationId: fixture.org.id,
			createdById: fixture.user.id,
			companyId: fixture.company.id,
			customerId: fixture.customer.id,
			productId: fixture.product.id,
			group: "Grupo Estorno Importação",
			quota: "750",
			amount: 24_000,
			installmentStatus: SaleCommissionInstallmentStatus.PENDING,
		});

		const applyResponse = await request(app.server)
			.post(
				`/organizations/${fixture.org.slug}/commissions/receipts/imports/apply`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				...baseImportBody({
					rows: [
						{
							DataVenda: IMPORT_DATE,
							Grupo: "Grupo Estorno Importação",
							Cota: "750",
							Parcela: "01/01",
							Valor: "-50,00",
						},
					],
				}),
				selectedRowNumbers: [1],
			});

		expect(applyResponse.statusCode).toBe(200);
		expect(applyResponse.body).toMatchObject({
			requested: 1,
			applied: 1,
			skipped: 0,
		});
		expect(applyResponse.body.results[0]).toMatchObject({
			rowNumber: 1,
			result: "APPLIED",
			reason: "Movimento de estorno criado com sucesso.",
		});

		const updatedInstallment =
			await prisma.saleCommissionInstallment.findUnique({
				where: {
					id: created.installment.id,
				},
				select: {
					status: true,
					amount: true,
					paymentDate: true,
				},
			});
		const reversalMovement = await findLatestInstallmentReversalMovement(
			created.installment.id,
		);

		expect(updatedInstallment?.status).toBe(
			SaleCommissionInstallmentStatus.PENDING,
		);
		expect(updatedInstallment?.amount).toBe(24_000);
		expect(updatedInstallment?.paymentDate).toBeNull();
		expect(reversalMovement?.status).toBe(
			SaleCommissionInstallmentStatus.REVERSED,
		);
		expect(reversalMovement?.originInstallmentId).toBe(created.installment.id);
		expect(reversalMovement?.amount).toBe(-5_000);
		expect(reversalMovement?.paymentDate?.toISOString().slice(0, 10)).toBe(
			IMPORT_DATE,
		);
		expect(reversalMovement?.reversedFromStatus).toBeNull();
		expect(reversalMovement?.reversedFromAmount).toBeNull();
		expect(reversalMovement?.reversedFromPaymentDate).toBeNull();
	});

	it("should apply selected negative READY row by reversing base installment directly on full amount", async () => {
		const fixture = await createFixture();
		const created = await createSaleWithIncomeInstallment({
			organizationId: fixture.org.id,
			createdById: fixture.user.id,
			companyId: fixture.company.id,
			customerId: fixture.customer.id,
			productId: fixture.product.id,
			group: "Grupo Estorno Total Importação",
			quota: "751",
			amount: 24_000,
			installmentStatus: SaleCommissionInstallmentStatus.PENDING,
		});

		const applyResponse = await request(app.server)
			.post(
				`/organizations/${fixture.org.slug}/commissions/receipts/imports/apply`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				...baseImportBody({
					rows: [
						{
							DataVenda: IMPORT_DATE,
							Grupo: "Grupo Estorno Total Importação",
							Cota: "751",
							Parcela: "01/01",
							Valor: "-240,00",
						},
					],
				}),
				selectedRowNumbers: [1],
			});

		expect(applyResponse.statusCode).toBe(200);
		expect(applyResponse.body).toMatchObject({
			requested: 1,
			applied: 1,
			skipped: 0,
		});
		expect(applyResponse.body.results[0]).toMatchObject({
			rowNumber: 1,
			result: "APPLIED",
			reason: "Parcela estornada diretamente com sucesso.",
			installmentId: created.installment.id,
		});

		const updatedInstallment =
			await prisma.saleCommissionInstallment.findUnique({
				where: {
					id: created.installment.id,
				},
				select: {
					status: true,
					amount: true,
					paymentDate: true,
					reversedFromStatus: true,
					reversedFromAmount: true,
					reversedFromPaymentDate: true,
				},
			});
		const reversalMovement = await findLatestInstallmentReversalMovement(
			created.installment.id,
		);

		expect(updatedInstallment?.status).toBe(
			SaleCommissionInstallmentStatus.REVERSED,
		);
		expect(updatedInstallment?.amount).toBe(-24_000);
		expect(updatedInstallment?.paymentDate?.toISOString().slice(0, 10)).toBe(
			IMPORT_DATE,
		);
		expect(updatedInstallment?.reversedFromStatus).toBe(
			SaleCommissionInstallmentStatus.PENDING,
		);
		expect(updatedInstallment?.reversedFromAmount).toBe(24_000);
		expect(updatedInstallment?.reversedFromPaymentDate).toBeNull();
		expect(reversalMovement).toBeNull();
	});

	it("should skip row on apply when installment changed after preview", async () => {
		const fixture = await createFixture();
		const created = await createSaleWithIncomeInstallment({
			organizationId: fixture.org.id,
			createdById: fixture.user.id,
			companyId: fixture.company.id,
			customerId: fixture.customer.id,
			productId: fixture.product.id,
			group: "Grupo Concorrencia",
			quota: "900",
			amount: 8_000,
		});

		const previewResponse = await request(app.server)
			.post(
				`/organizations/${fixture.org.slug}/commissions/receipts/imports/preview`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send(
				baseImportBody({
					rows: [
						{
							DataVenda: IMPORT_DATE,
							Grupo: "Grupo Concorrencia",
							Cota: "900",
							Parcela: "1",
							Valor: "80,00",
						},
					],
				}),
			);

		expect(previewResponse.statusCode).toBe(200);
		expect(previewResponse.body.rows[0].status).toBe("READY");

		await prisma.saleCommissionInstallment.update({
			where: {
				id: created.installment.id,
			},
			data: {
				status: SaleCommissionInstallmentStatus.PAID,
				paymentDate: new Date(`${IMPORT_DATE}T00:00:00.000Z`),
			},
		});

		const applyResponse = await request(app.server)
			.post(
				`/organizations/${fixture.org.slug}/commissions/receipts/imports/apply`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				...baseImportBody({
					rows: [
						{
							DataVenda: IMPORT_DATE,
							Grupo: "Grupo Concorrencia",
							Cota: "900",
							Parcela: "1",
							Valor: "80,00",
						},
					],
				}),
				selectedRowNumbers: [1],
			});

		expect(applyResponse.statusCode).toBe(200);
		expect(applyResponse.body).toMatchObject({
			requested: 1,
			applied: 0,
			skipped: 1,
		});
		expect(applyResponse.body.results[0]).toMatchObject({
			rowNumber: 1,
			result: "SKIPPED",
		});
	});
});
