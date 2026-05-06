import { hash } from "bcryptjs";
import {
	CustomerDocumentType,
	CustomerPersonType,
	CustomerStatus,
	PermissionOverrideEffect,
	Role,
	SaleDynamicFieldType,
	SaleHistoryAction,
	SaleStatus,
} from "generated/prisma/enums";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { makeUser } from "../../factories/make-user";
import { createTestApp } from "../../utils/test-app";

let app: Awaited<ReturnType<typeof createTestApp>>;

const DEFAULT_IMPORT_DATE = "2026-04-10";

async function authenticate(email: string, password: string) {
	const response = await request(app.server).post("/sessions/password").send({
		email,
		password,
	});

	expect(response.statusCode).toBe(200);
	return response.body.accessToken as string;
}

async function createAdminMemberFixture(
	organizationId: string,
	suffix: string,
) {
	const password = "123456";
	const passwordHash = await hash(password, 6);
	const user = await prisma.user.create({
		data: {
			name: `Delinquency import member ${suffix}`,
			email: `delinquency-import-member-${suffix}@example.com`,
			passwordHash,
			emailVerifiedAt: new Date(),
		},
	});

	const member = await prisma.member.create({
		data: {
			organizationId,
			userId: user.id,
			role: Role.ADMIN,
		},
	});

	return {
		user,
		member,
		password,
	};
}

async function denyPermission(params: {
	organizationId: string;
	memberId: string;
	permissionKey: string;
}) {
	const permission = await prisma.permission.findUnique({
		where: {
			key: params.permissionKey,
		},
		select: {
			id: true,
		},
	});

	if (!permission) {
		throw new Error(`Permission ${params.permissionKey} not found`);
	}

	await prisma.memberPermissionOverride.upsert({
		where: {
			memberId_permissionId: {
				memberId: params.memberId,
				permissionId: permission.id,
			},
		},
		update: {
			effect: PermissionOverrideEffect.DENY,
		},
		create: {
			organizationId: params.organizationId,
			memberId: params.memberId,
			permissionId: permission.id,
			effect: PermissionOverrideEffect.DENY,
		},
	});
}

async function createFixture() {
	const { user, org } = await makeUser();
	const token = await authenticate(user.email, user.password);
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
			description: "Produto para importação de inadimplência",
			isActive: true,
		},
	});

	await prisma.productSaleField.createMany({
		data: [
			{
				productId: product.id,
				label: "Grupo",
				labelNormalized: "grupo",
				type: SaleDynamicFieldType.TEXT,
				required: false,
				sortOrder: 1,
			},
			{
				productId: product.id,
				label: "Cota",
				labelNormalized: "cota",
				type: SaleDynamicFieldType.TEXT,
				required: false,
				sortOrder: 2,
			},
		],
	});

	return {
		user,
		token,
		org,
		company,
		customer,
		product,
	};
}

function buildTemplateMapping() {
	return {
		fields: {
			saleDateColumn: "DataVenda",
			customFieldMappings: [
				{
					customFieldLabel: "Grupo",
					columnKey: "Grupo",
				},
				{
					customFieldLabel: "Cota",
					columnKey: "Cota",
				},
			],
		},
	};
}

function buildTemplateMappingWithCustomFields(
	customFieldMappings: Array<{
		customFieldLabel: string;
		columnKey: string;
	}>,
) {
	return {
		fields: {
			saleDateColumn: "DataVenda",
			customFieldMappings,
		},
	};
}

function buildPreviewBody(params: {
	rows: Array<Record<string, unknown>>;
	importDate?: string;
	templateId?: string;
}) {
	return {
		fileType: "XLSX",
		headerSignature: "sha256:sale-delinquency-import-tests",
		templateId: params.templateId,
		importDate: params.importDate ?? DEFAULT_IMPORT_DATE,
		rows: params.rows,
		mapping: buildTemplateMapping(),
	};
}

async function createSaleForMatching(params: {
	organizationId: string;
	companyId: string;
	customerId: string;
	productId: string;
	createdById: string;
	saleDate: string;
	status?: SaleStatus;
	group: string | number;
	quota: string | number;
}) {
	const groupFieldId = crypto.randomUUID();
	const quotaFieldId = crypto.randomUUID();

	return prisma.sale.create({
		data: {
			organizationId: params.organizationId,
			companyId: params.companyId,
			customerId: params.customerId,
			productId: params.productId,
			saleDate: new Date(`${params.saleDate}T00:00:00.000Z`),
			totalAmount: 100_000,
			status: params.status ?? SaleStatus.COMPLETED,
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
		select: {
			id: true,
		},
	});
}

async function createSaleForCustomMatching(params: {
	organizationId: string;
	companyId: string;
	customerId: string;
	productId: string;
	createdById: string;
	saleDate: string;
	status?: SaleStatus;
	fields: Array<{
		label: string;
		value: string | number;
	}>;
}) {
	const schemaFields = params.fields.map((field, index) => ({
		fieldId: crypto.randomUUID(),
		label: field.label,
		type: SaleDynamicFieldType.TEXT,
		required: false,
		options: [],
		sortOrder: index + 1,
	}));

	return prisma.sale.create({
		data: {
			organizationId: params.organizationId,
			companyId: params.companyId,
			customerId: params.customerId,
			productId: params.productId,
			saleDate: new Date(`${params.saleDate}T00:00:00.000Z`),
			totalAmount: 100_000,
			status: params.status ?? SaleStatus.COMPLETED,
			dynamicFieldSchema: schemaFields,
			dynamicFieldValues: Object.fromEntries(
				schemaFields.map((field, index) => [
					field.fieldId,
					params.fields[index]?.value,
				]),
			),
			createdById: params.createdById,
		},
		select: {
			id: true,
		},
	});
}

describe("sales delinquency import", () => {
	beforeAll(async () => {
		app = await createTestApp();
	});

	afterAll(async () => {
		await app.close();
	});

	it("should create, list, update and delete delinquency import templates", async () => {
		const fixture = await createFixture();
		const mapping = buildTemplateMapping();
		const headerSignature = "sha256:delinquency-template-signature";

		const createResponse = await request(app.server)
			.post(
				`/organizations/${fixture.org.slug}/sales/delinquency/import-templates`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				name: "Template Inadimplência",
				headerSignature,
				mapping,
			});

		expect(createResponse.statusCode).toBe(201);
		const templateId = createResponse.body.templateId as string;

		const listResponse = await request(app.server)
			.get(
				`/organizations/${fixture.org.slug}/sales/delinquency/import-templates?headerSignature=${encodeURIComponent(
					headerSignature,
				)}`,
			)
			.set("Authorization", `Bearer ${fixture.token}`);

		expect(listResponse.statusCode).toBe(200);
		expect(listResponse.body.templates).toHaveLength(1);
		expect(listResponse.body.templates[0]).toMatchObject({
			id: templateId,
			name: "Template Inadimplência",
			isSuggested: true,
			mapping,
		});

		const updateResponse = await request(app.server)
			.put(
				`/organizations/${fixture.org.slug}/sales/delinquency/import-templates/${templateId}`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				name: "Template Inadimplência Atualizado",
				headerSignature,
				mapping,
			});

		expect(updateResponse.statusCode).toBe(204);

		const deleteResponse = await request(app.server)
			.delete(
				`/organizations/${fixture.org.slug}/sales/delinquency/import-templates/${templateId}`,
			)
			.set("Authorization", `Bearer ${fixture.token}`);

		expect(deleteResponse.statusCode).toBe(204);
	});

	it("should list available custom search fields", async () => {
		const fixture = await createFixture();
		const secondaryProduct = await prisma.product.create({
			data: {
				organizationId: fixture.org.id,
				name: "Produto Secundário",
				description: "Produto secundário para filtros",
				isActive: true,
			},
		});
		await prisma.productSaleField.create({
			data: {
				productId: secondaryProduct.id,
				label: "Bloco",
				labelNormalized: "bloco",
				type: SaleDynamicFieldType.TEXT,
				required: false,
				sortOrder: 1,
			},
		});

		const response = await request(app.server)
			.get(
				`/organizations/${fixture.org.slug}/sales/delinquency/import-search-fields`,
			)
			.set("Authorization", `Bearer ${fixture.token}`);

		expect(response.statusCode).toBe(200);
		expect(response.body.fields).toEqual(
			expect.arrayContaining([
				{ label: "Grupo" },
				{ label: "Cota" },
				{ label: "Bloco" },
			]),
		);

		const filteredResponse = await request(app.server)
			.get(
				`/organizations/${fixture.org.slug}/sales/delinquency/import-search-fields?productId=${fixture.product.id}`,
			)
			.set("Authorization", `Bearer ${fixture.token}`);

		expect(filteredResponse.statusCode).toBe(200);
		expect(filteredResponse.body.fields).toEqual(
			expect.arrayContaining([
				{ label: "Grupo" },
				{ label: "Cota" },
			]),
		);
		expect(filteredResponse.body.fields).not.toEqual(
			expect.arrayContaining([{ label: "Bloco" }]),
		);
	});

	it("should preview row as READY when matching a single completed sale without open delinquency in month", async () => {
		const fixture = await createFixture();
		const sale = await createSaleForMatching({
			organizationId: fixture.org.id,
			companyId: fixture.company.id,
			customerId: fixture.customer.id,
			productId: fixture.product.id,
			createdById: fixture.user.id,
			saleDate: "2026-03-15",
			status: SaleStatus.COMPLETED,
			group: "Grupo Azul",
			quota: "001",
		});

		const response = await request(app.server)
			.post(`/organizations/${fixture.org.slug}/sales/delinquency/imports/preview`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send(
				buildPreviewBody({
					rows: [
						{
							DataVenda: "2026-03-15",
							Grupo: "grupo azul",
							Cota: "001",
						},
					],
				}),
			);

		expect(response.statusCode).toBe(200);
		expect(response.body.summary).toMatchObject({
			totalRows: 1,
			readyRows: 1,
			noActionRows: 0,
			attentionRows: 0,
			errorRows: 0,
		});
		expect(response.body.rows[0]).toMatchObject({
			rowNumber: 1,
			status: "READY",
			action: "CREATE_DELINQUENCY",
			saleId: sale.id,
			dueDate: DEFAULT_IMPORT_DATE,
		});
	});

	it("should match grupo and cota ignoring leading zeros during delinquency preview", async () => {
		const fixture = await createFixture();
		const sale = await createSaleForMatching({
			organizationId: fixture.org.id,
			companyId: fixture.company.id,
			customerId: fixture.customer.id,
			productId: fixture.product.id,
			createdById: fixture.user.id,
			saleDate: "2026-03-15",
			status: SaleStatus.COMPLETED,
			group: "005488",
			quota: 616,
		});

		const response = await request(app.server)
			.post(`/organizations/${fixture.org.slug}/sales/delinquency/imports/preview`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send(
				buildPreviewBody({
					rows: [
						{
							DataVenda: "2026-03-15",
							Grupo: 5488,
							Cota: "0616",
						},
					],
				}),
			);

		expect(response.statusCode).toBe(200);
		expect(response.body.rows[0]).toMatchObject({
			status: "READY",
			action: "CREATE_DELINQUENCY",
			saleId: sale.id,
		});
	});

	it("should keep literal matching for numeric custom fields other than grupo and cota", async () => {
		const fixture = await createFixture();
		const sale = await createSaleForCustomMatching({
			organizationId: fixture.org.id,
			companyId: fixture.company.id,
			customerId: fixture.customer.id,
			productId: fixture.product.id,
			createdById: fixture.user.id,
			saleDate: "2026-03-18",
			status: SaleStatus.COMPLETED,
			fields: [{ label: "Contrato", value: "000123" }],
		});

		const response = await request(app.server)
			.post(`/organizations/${fixture.org.slug}/sales/delinquency/imports/preview`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				fileType: "XLSX",
				headerSignature: "sha256:sale-delinquency-import-contract-tests",
				importDate: DEFAULT_IMPORT_DATE,
				rows: [
					{
						DataVenda: "2026-03-18",
						Contrato: "123",
					},
				],
				mapping: buildTemplateMappingWithCustomFields([
					{
						customFieldLabel: "Contrato",
						columnKey: "Contrato",
					},
				]),
			});

		expect(response.statusCode).toBe(200);
		expect(response.body.rows[0]).toMatchObject({
			status: "ATTENTION",
			action: "NONE",
			saleId: null,
			matchCount: 0,
		});
		expect(response.body.rows[0].matchedSaleIds).not.toContain(sale.id);
	});

	it("should preview row as NO_ACTION when sale already has open delinquency in import month", async () => {
		const fixture = await createFixture();
		const sale = await createSaleForMatching({
			organizationId: fixture.org.id,
			companyId: fixture.company.id,
			customerId: fixture.customer.id,
			productId: fixture.product.id,
			createdById: fixture.user.id,
			saleDate: "2026-03-15",
			status: SaleStatus.COMPLETED,
			group: "Grupo Verde",
			quota: "777",
		});

		await prisma.saleDelinquency.create({
			data: {
				saleId: sale.id,
				organizationId: fixture.org.id,
				dueDate: new Date("2026-04-03T00:00:00.000Z"),
				createdById: fixture.user.id,
			},
		});

		const response = await request(app.server)
			.post(`/organizations/${fixture.org.slug}/sales/delinquency/imports/preview`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send(
				buildPreviewBody({
					rows: [
						{
							DataVenda: "2026-03-15",
							Grupo: "Grupo Verde",
							Cota: "777",
						},
					],
				}),
			);

		expect(response.statusCode).toBe(200);
		expect(response.body.rows[0]).toMatchObject({
			status: "NO_ACTION",
			action: "NONE",
			saleId: sale.id,
		});
	});

	it("should preview row as ATTENTION when matching multiple sales", async () => {
		const fixture = await createFixture();
		await createSaleForMatching({
			organizationId: fixture.org.id,
			companyId: fixture.company.id,
			customerId: fixture.customer.id,
			productId: fixture.product.id,
			createdById: fixture.user.id,
			saleDate: "2026-03-20",
			status: SaleStatus.COMPLETED,
			group: "Grupo Duplo",
			quota: "999",
		});
		await createSaleForMatching({
			organizationId: fixture.org.id,
			companyId: fixture.company.id,
			customerId: fixture.customer.id,
			productId: fixture.product.id,
			createdById: fixture.user.id,
			saleDate: "2026-03-20",
			status: SaleStatus.COMPLETED,
			group: "Grupo Duplo",
			quota: "999",
		});

		const response = await request(app.server)
			.post(`/organizations/${fixture.org.slug}/sales/delinquency/imports/preview`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send(
				buildPreviewBody({
					rows: [
						{
							DataVenda: "2026-03-20",
							Grupo: "Grupo Duplo",
							Cota: "999",
						},
					],
				}),
			);

		expect(response.statusCode).toBe(200);
		expect(response.body.rows[0]).toMatchObject({
			status: "ATTENTION",
			action: "NONE",
			matchCount: 2,
		});
	});

	it("should preview row as ERROR when sale date or custom fields are invalid", async () => {
		const fixture = await createFixture();

		const response = await request(app.server)
			.post(`/organizations/${fixture.org.slug}/sales/delinquency/imports/preview`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send(
				buildPreviewBody({
					rows: [
						{
							DataVenda: "data-invalida",
							Grupo: "Grupo X",
							Cota: "001",
						},
						{
							DataVenda: "2026-03-10",
							Grupo: "",
							Cota: "001",
						},
					],
				}),
			);

		expect(response.statusCode).toBe(200);
		expect(response.body.rows[0]).toMatchObject({
			status: "ERROR",
			action: "NONE",
		});
		expect(response.body.rows[1]).toMatchObject({
			status: "ERROR",
			action: "NONE",
		});
	});

	it("should mark only first duplicate row as READY in same sale/month and keep others as NO_ACTION", async () => {
		const fixture = await createFixture();
		await createSaleForMatching({
			organizationId: fixture.org.id,
			companyId: fixture.company.id,
			customerId: fixture.customer.id,
			productId: fixture.product.id,
			createdById: fixture.user.id,
			saleDate: "2026-03-25",
			status: SaleStatus.COMPLETED,
			group: "Grupo Rep",
			quota: "321",
		});

		const response = await request(app.server)
			.post(`/organizations/${fixture.org.slug}/sales/delinquency/imports/preview`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send(
				buildPreviewBody({
					rows: [
						{
							DataVenda: "2026-03-25",
							Grupo: "Grupo Rep",
							Cota: "321",
						},
						{
							DataVenda: "2026-03-25",
							Grupo: "Grupo Rep",
							Cota: "321",
						},
					],
				}),
			);

		expect(response.statusCode).toBe(200);
		expect(response.body.rows[0]).toMatchObject({
			status: "READY",
			action: "CREATE_DELINQUENCY",
		});
		expect(response.body.rows[1]).toMatchObject({
			status: "NO_ACTION",
			action: "NONE",
		});
	});

	it("should apply selected rows, create delinquency with importDate and skip non-ready rows", async () => {
		const fixture = await createFixture();
		const sale = await createSaleForMatching({
			organizationId: fixture.org.id,
			companyId: fixture.company.id,
			customerId: fixture.customer.id,
			productId: fixture.product.id,
			createdById: fixture.user.id,
			saleDate: "2026-03-14",
			status: SaleStatus.COMPLETED,
			group: "Grupo Apply",
			quota: "123",
		});

		const response = await request(app.server)
			.post(`/organizations/${fixture.org.slug}/sales/delinquency/imports/apply`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				...buildPreviewBody({
					rows: [
						{
							DataVenda: "2026-03-14",
							Grupo: "Grupo Apply",
							Cota: "123",
						},
						{
							DataVenda: "2026-03-14",
							Grupo: "Grupo inexistente",
							Cota: "000",
						},
					],
				}),
				selectedRowNumbers: [1, 2],
			});

		expect(response.statusCode).toBe(200);
		expect(response.body).toMatchObject({
			requested: 2,
			applied: 1,
			skipped: 1,
		});

		const delinquency = await prisma.saleDelinquency.findFirst({
			where: {
				saleId: sale.id,
				organizationId: fixture.org.id,
			},
			orderBy: {
				createdAt: "desc",
			},
			select: {
				dueDate: true,
			},
		});

		expect(delinquency?.dueDate.toISOString().slice(0, 10)).toBe(
			DEFAULT_IMPORT_DATE,
		);

		const historyEvent = await prisma.saleHistoryEvent.findFirst({
			where: {
				saleId: sale.id,
				action: SaleHistoryAction.DELINQUENCY_CREATED,
			},
			orderBy: {
				createdAt: "desc",
			},
		});
		expect(historyEvent).not.toBeNull();
	});

	it("should revalidate state during apply and skip when delinquency appears before confirmation", async () => {
		const fixture = await createFixture();
		const sale = await createSaleForMatching({
			organizationId: fixture.org.id,
			companyId: fixture.company.id,
			customerId: fixture.customer.id,
			productId: fixture.product.id,
			createdById: fixture.user.id,
			saleDate: "2026-03-12",
			status: SaleStatus.COMPLETED,
			group: "Grupo Reval",
			quota: "555",
		});

		const previewResponse = await request(app.server)
			.post(`/organizations/${fixture.org.slug}/sales/delinquency/imports/preview`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send(
				buildPreviewBody({
					rows: [
						{
							DataVenda: "2026-03-12",
							Grupo: "Grupo Reval",
							Cota: "555",
						},
					],
				}),
			);
		expect(previewResponse.statusCode).toBe(200);
		expect(previewResponse.body.rows[0]?.status).toBe("READY");

		await prisma.saleDelinquency.create({
			data: {
				saleId: sale.id,
				organizationId: fixture.org.id,
				dueDate: new Date("2026-04-04T00:00:00.000Z"),
				createdById: fixture.user.id,
			},
		});

		const applyResponse = await request(app.server)
			.post(`/organizations/${fixture.org.slug}/sales/delinquency/imports/apply`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				...buildPreviewBody({
					rows: [
						{
							DataVenda: "2026-03-12",
							Grupo: "Grupo Reval",
							Cota: "555",
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
	});

	it("should block endpoints when member lacks sales.import.manage permission", async () => {
		const fixture = await createFixture();
		const suffix = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
		const adminMember = await createAdminMemberFixture(fixture.org.id, suffix);
		await denyPermission({
			organizationId: fixture.org.id,
			memberId: adminMember.member.id,
			permissionKey: "sales.import.manage",
		});
		const deniedToken = await authenticate(
			adminMember.user.email,
			adminMember.password,
		);

		const response = await request(app.server)
			.get(
				`/organizations/${fixture.org.slug}/sales/delinquency/import-search-fields`,
			)
			.set("Authorization", `Bearer ${deniedToken}`);

		expect(response.statusCode).toBe(403);
	});
});
