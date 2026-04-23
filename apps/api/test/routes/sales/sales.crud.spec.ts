import {
	CustomerDocumentType,
	CustomerPersonType,
	CustomerStatus,
	PartnerDocumentType,
	PartnerStatus,
	ProductCommissionReversalMode,
	SaleStatus,
	SellerDocumentType,
	SellerStatus,
	TransactionNature,
	TransactionStatus,
	TransactionType,
} from "generated/prisma/enums";
import { addDays, format } from "date-fns";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { makeUser } from "../../factories/make-user";
import { createTestApp } from "../../utils/test-app";

let app: Awaited<ReturnType<typeof createTestApp>>;

function getRelativeDateInput(offsetDays: number) {
	return format(addDays(new Date(), offsetDays), "yyyy-MM-dd");
}

function toDateOnlyIsoString(value: string) {
	return `${value}T00:00:00.000Z`;
}

type ResponsibleInput =
	| {
			type: "SELLER";
			id: string;
	  }
	| {
			type: "PARTNER";
			id: string;
	  };

type SaleCommissionInput = {
	sourceType: "PULLED" | "MANUAL";
	recipientType:
		| "COMPANY"
		| "UNIT"
		| "SELLER"
		| "PARTNER"
		| "SUPERVISOR"
		| "OTHER";
	direction?: "INCOME" | "OUTCOME";
	calculationBase?: "SALE_TOTAL" | "COMMISSION";
	baseCommissionIndex?: number;
	beneficiaryId?: string;
	beneficiaryLabel?: string;
	useAdvancedDateSchedule?: boolean;
	startDate: string;
	totalPercentage: number;
	installments: Array<{
		installmentNumber: number;
		percentage: number;
		monthsToAdvance?: number;
	}>;
};

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
			name: `Company ${suffix}`,
			organizationId: org.id,
		},
	});

	const secondCompany = await prisma.company.create({
		data: {
			name: `Second company ${suffix}`,
			organizationId: org.id,
		},
	});

	const unit = await prisma.unit.create({
		data: {
			name: `Unit ${suffix}`,
			companyId: company.id,
		},
	});

	const foreignUnit = await prisma.unit.create({
		data: {
			name: `Foreign unit ${suffix}`,
			companyId: secondCompany.id,
		},
	});

	const customer = await prisma.customer.create({
		data: {
			organizationId: org.id,
			personType: CustomerPersonType.PF,
			name: `Customer ${suffix}`,
			documentType: CustomerDocumentType.CPF,
			documentNumber: `000000000${Math.floor(Math.random() * 9)}`,
			status: CustomerStatus.ACTIVE,
		},
	});

	const inactiveCustomer = await prisma.customer.create({
		data: {
			organizationId: org.id,
			personType: CustomerPersonType.PF,
			name: `Inactive customer ${suffix}`,
			documentType: CustomerDocumentType.CPF,
			documentNumber: `111111111${Math.floor(Math.random() * 9)}`,
			status: CustomerStatus.INACTIVE,
		},
	});

	const product = await prisma.product.create({
		data: {
			organizationId: org.id,
			name: `Product ${suffix}`,
			description: "Product for sales tests",
			isActive: true,
		},
	});

	const inactiveProduct = await prisma.product.create({
		data: {
			organizationId: org.id,
			name: `Inactive product ${suffix}`,
			description: "Inactive product for sales tests",
			isActive: false,
		},
	});

	const seller = await prisma.seller.create({
		data: {
			name: `Seller ${suffix}`,
			email: `seller-${suffix}@example.com`,
			phone: "55999999999",
			documentType: SellerDocumentType.CPF,
			document: `222222222${Math.floor(Math.random() * 9)}`,
			companyName: "Seller Company",
			state: "RS",
			organizationId: org.id,
			status: SellerStatus.ACTIVE,
		},
	});

	const inactiveSeller = await prisma.seller.create({
		data: {
			name: `Inactive seller ${suffix}`,
			email: `seller-inactive-${suffix}@example.com`,
			phone: "55999888888",
			documentType: SellerDocumentType.CPF,
			document: `333333333${Math.floor(Math.random() * 9)}`,
			companyName: "Seller Company",
			state: "RS",
			organizationId: org.id,
			status: SellerStatus.INACTIVE,
		},
	});

	const partner = await prisma.partner.create({
		data: {
			name: `Partner ${suffix}`,
			email: `partner-${suffix}@example.com`,
			phone: "55999777777",
			documentType: PartnerDocumentType.CPF,
			document: `444444444${Math.floor(Math.random() * 9)}`,
			companyName: "Partner Company",
			state: "RS",
			organizationId: org.id,
			status: PartnerStatus.ACTIVE,
		},
	});

	const inactivePartner = await prisma.partner.create({
		data: {
			name: `Inactive partner ${suffix}`,
			email: `partner-inactive-${suffix}@example.com`,
			phone: "55999666666",
			documentType: PartnerDocumentType.CPF,
			document: `555555555${Math.floor(Math.random() * 9)}`,
			companyName: "Partner Company",
			state: "RS",
			organizationId: org.id,
			status: PartnerStatus.INACTIVE,
		},
	});

	const supervisorUser = await prisma.user.create({
		data: {
			name: `Supervisor ${suffix}`,
			email: `supervisor-${suffix}@example.com`,
		},
	});

	const supervisor = await prisma.member.create({
		data: {
			role: "SUPERVISOR",
			organizationId: org.id,
			userId: supervisorUser.id,
		},
	});

	return {
		user,
		token,
		org,
		company,
		secondCompany,
		unit,
		foreignUnit,
		customer,
		inactiveCustomer,
		product,
		inactiveProduct,
		seller,
		inactiveSeller,
		partner,
		inactivePartner,
		supervisor,
	};
}

function buildCreatePayload(
	fixture: Awaited<ReturnType<typeof createFixture>>,
	overrides?: Partial<{
		saleDate: string;
		customerId: string;
		productId: string;
		totalAmount: number;
		responsible: ResponsibleInput;
		companyId: string;
		unitId: string | undefined;
		notes: string | undefined;
		dynamicFields: Record<string, unknown> | undefined;
		commissions: SaleCommissionInput[] | undefined;
	}>,
) {
	return {
		saleDate: "2026-03-04",
		customerId: fixture.customer.id,
		productId: fixture.product.id,
		totalAmount: 125_000,
		responsible: {
			type: "SELLER" as const,
			id: fixture.seller.id,
		},
		companyId: fixture.company.id,
		unitId: fixture.unit.id,
		notes: "Primeira venda",
		...overrides,
	};
}

async function setOrganizationSalesTransactionsSync(
	organizationId: string,
	enabled: boolean,
) {
	await prisma.organization.update({
		where: {
			id: organizationId,
		},
		data: {
			enableSalesTransactionsSync: enabled,
		},
	});
}

async function createProductSalesTransactionMapping(organizationId: string) {
	const suffix = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
	const costCenter = await prisma.costCenter.create({
		data: {
			name: `Sales Cost Center ${suffix}`,
			organizationId,
		},
	});
	const incomeCategory = await prisma.category.create({
		data: {
			name: `Sales Income Category ${suffix}`,
			color: "#16a34a",
			icon: "wallet",
			type: TransactionType.INCOME,
			organizationId,
		},
	});

	return {
		costCenter,
		incomeCategory,
	};
}

async function updateProductSalesTransactionMapping(params: {
	productId: string;
	categoryId: string | null;
	costCenterId: string | null;
}) {
	await prisma.product.update({
		where: {
			id: params.productId,
		},
		data: {
			salesTransactionCategoryId: params.categoryId,
			salesTransactionCostCenterId: params.costCenterId,
		},
	});
}

function buildCommissionsPayload(
	fixture: Awaited<ReturnType<typeof createFixture>>,
): SaleCommissionInput[] {
	return [
		{
			sourceType: "PULLED",
			recipientType: "SELLER",
			beneficiaryId: fixture.seller.id,
			startDate: "2026-03-10",
			totalPercentage: 1,
			installments: [
				{
					installmentNumber: 1,
					percentage: 0.5,
				},
				{
					installmentNumber: 2,
					percentage: 0.5,
				},
			],
		},
		{
			sourceType: "MANUAL",
			recipientType: "OTHER",
			beneficiaryLabel: "Bônus Operacional",
			startDate: "2026-03-15",
			totalPercentage: 0.5,
			installments: [
				{
					installmentNumber: 1,
					percentage: 0.5,
				},
			],
		},
	];
}

function buildThreeInstallmentsSellerCommissionsPayload(
	fixture: Awaited<ReturnType<typeof createFixture>>,
): SaleCommissionInput[] {
	return [
		{
			sourceType: "PULLED",
			recipientType: "SELLER",
			beneficiaryId: fixture.seller.id,
			startDate: "2026-03-10",
			totalPercentage: 1,
			installments: [
				{
					installmentNumber: 1,
					percentage: 0.34,
				},
				{
					installmentNumber: 2,
					percentage: 0.33,
				},
				{
					installmentNumber: 3,
					percentage: 0.33,
				},
			],
		},
	];
}

function buildAdvancedScheduleCommissionsPayload(
	fixture: Awaited<ReturnType<typeof createFixture>>,
): SaleCommissionInput[] {
	return [
		{
			sourceType: "PULLED",
			recipientType: "SELLER",
			beneficiaryId: fixture.seller.id,
			useAdvancedDateSchedule: true,
			startDate: "2026-03-10",
			totalPercentage: 1,
			installments: [
				{
					installmentNumber: 1,
					percentage: 0.34,
					monthsToAdvance: 0,
				},
				{
					installmentNumber: 2,
					percentage: 0.33,
					monthsToAdvance: 0,
				},
				{
					installmentNumber: 3,
					percentage: 0.33,
					monthsToAdvance: 2,
				},
			],
		},
	];
}

function buildMixedDirectionCommissionsPayload(
	fixture: Awaited<ReturnType<typeof createFixture>>,
): SaleCommissionInput[] {
	return [
		{
			sourceType: "PULLED",
			recipientType: "SELLER",
			beneficiaryId: fixture.seller.id,
			startDate: "2026-03-10",
			totalPercentage: 1,
			installments: [
				{
					installmentNumber: 1,
					percentage: 0.5,
				},
				{
					installmentNumber: 2,
					percentage: 0.5,
				},
			],
		},
		{
			sourceType: "MANUAL",
			recipientType: "COMPANY",
			beneficiaryId: fixture.company.id,
			startDate: "2026-03-15",
			totalPercentage: 1,
			installments: [
				{
					installmentNumber: 1,
					percentage: 1,
				},
			],
		},
		{
			sourceType: "MANUAL",
			recipientType: "PARTNER",
			beneficiaryId: fixture.partner.id,
			startDate: "2026-03-12",
			totalPercentage: 1,
			installments: [
				{
					installmentNumber: 1,
					percentage: 1,
				},
			],
		},
	];
}

function buildLinkedCommissionsPayload(
	fixture: Awaited<ReturnType<typeof createFixture>>,
): SaleCommissionInput[] {
	return [
		{
			sourceType: "PULLED",
			recipientType: "SELLER",
			beneficiaryId: fixture.seller.id,
			startDate: "2026-03-10",
			totalPercentage: 1,
			installments: [
				{
					installmentNumber: 1,
					percentage: 1,
				},
			],
		},
		{
			sourceType: "MANUAL",
			recipientType: "OTHER",
			beneficiaryLabel: "Comissão em cascata",
			calculationBase: "COMMISSION",
			baseCommissionIndex: 0,
			startDate: "2026-03-15",
			totalPercentage: 10,
			installments: [
				{
					installmentNumber: 1,
					percentage: 6,
				},
				{
					installmentNumber: 2,
					percentage: 4,
				},
			],
		},
	];
}

async function createSaleUsingApi(
	fixture: Awaited<ReturnType<typeof createFixture>>,
	payload?: ReturnType<typeof buildCreatePayload>,
) {
	const response = await request(app.server)
		.post(`/organizations/${fixture.org.slug}/sales`)
		.set("Authorization", `Bearer ${fixture.token}`)
		.send(payload ?? buildCreatePayload(fixture));

	expect(response.statusCode).toBe(201);
	expect(response.body).toHaveProperty("saleId");

	return response.body.saleId as string;
}

async function findLatestInstallmentReversalMovement(
	originInstallmentId: string,
) {
	return prisma.saleCommissionInstallment.findFirst({
		where: {
			originInstallmentId,
			status: "REVERSED",
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

async function patchSaleStatusUsingApi(
	fixture: Awaited<ReturnType<typeof createFixture>>,
	saleId: string,
	status: "APPROVED" | "COMPLETED" | "CANCELED",
) {
	const response = await request(app.server)
		.patch(`/organizations/${fixture.org.slug}/sales/${saleId}/status`)
		.set("Authorization", `Bearer ${fixture.token}`)
		.send({
			status,
		});

	expect(response.statusCode).toBe(204);
}

async function createSaleDelinquencyUsingApi(
	fixture: Awaited<ReturnType<typeof createFixture>>,
	saleId: string,
	dueDate: string,
) {
	const response = await request(app.server)
		.post(`/organizations/${fixture.org.slug}/sales/${saleId}/delinquencies`)
		.set("Authorization", `Bearer ${fixture.token}`)
		.send({
			dueDate,
		});

	expect(response.statusCode).toBe(201);
	expect(response.body).toHaveProperty("delinquencyId");

	return response.body.delinquencyId as string;
}

async function resolveSaleDelinquencyUsingApi(
	fixture: Awaited<ReturnType<typeof createFixture>>,
	saleId: string,
	delinquencyId: string,
) {
	const response = await request(app.server)
		.patch(
			`/organizations/${fixture.org.slug}/sales/${saleId}/delinquencies/${delinquencyId}/resolve`,
		)
		.set("Authorization", `Bearer ${fixture.token}`);

	expect(response.statusCode).toBe(204);
}

async function deleteSaleDelinquencyUsingApi(
	fixture: Awaited<ReturnType<typeof createFixture>>,
	saleId: string,
	delinquencyId: string,
) {
	const response = await request(app.server)
		.delete(
			`/organizations/${fixture.org.slug}/sales/${saleId}/delinquencies/${delinquencyId}`,
		)
		.set("Authorization", `Bearer ${fixture.token}`);

	expect(response.statusCode).toBe(204);
}

async function createProductDynamicFields(productId: string) {
	const groupField = await prisma.productSaleField.create({
		data: {
			productId,
			label: "Grupo",
			labelNormalized: "grupo",
			type: "TEXT",
			required: true,
			sortOrder: 0,
		},
	});

	const amountField = await prisma.productSaleField.create({
		data: {
			productId,
			label: "Valor negociado",
			labelNormalized: "valor negociado",
			type: "CURRENCY",
			required: true,
			sortOrder: 1,
		},
	});

	const stageField = await prisma.productSaleField.create({
		data: {
			productId,
			label: "Etapa",
			labelNormalized: "etapa",
			type: "SELECT",
			required: true,
			sortOrder: 2,
			options: {
				create: [
					{
						label: "Inbound",
						labelNormalized: "inbound",
						sortOrder: 0,
					},
					{
						label: "Outbound",
						labelNormalized: "outbound",
						sortOrder: 1,
					},
				],
			},
		},
		include: {
			options: {
				orderBy: {
					sortOrder: "asc",
				},
			},
		},
	});

	const channelsField = await prisma.productSaleField.create({
		data: {
			productId,
			label: "Canais",
			labelNormalized: "canais",
			type: "MULTI_SELECT",
			required: false,
			sortOrder: 3,
			options: {
				create: [
					{
						label: "Instagram",
						labelNormalized: "instagram",
						sortOrder: 0,
					},
					{
						label: "Indicação",
						labelNormalized: "indicação",
						sortOrder: 1,
					},
				],
			},
		},
		include: {
			options: {
				orderBy: {
					sortOrder: "asc",
				},
			},
		},
	});

	return {
		groupField,
		amountField,
		stageField,
		channelsField,
		stageOptions: stageField.options,
		channelsOptions: channelsField.options,
	};
}

async function getSaleHistoryEvents(
	fixture: Awaited<ReturnType<typeof createFixture>>,
	saleId: string,
) {
	const response = await request(app.server)
		.get(`/organizations/${fixture.org.slug}/sales/${saleId}/history`)
		.set("Authorization", `Bearer ${fixture.token}`);

	expect(response.statusCode).toBe(200);
	expect(Array.isArray(response.body.history)).toBe(true);

	return response.body.history as Array<{
		id: string;
		action: string;
		createdAt: string;
		actor: {
			id: string;
			name: string | null;
			avatarUrl: string | null;
		};
		changes: Array<{
			path: string;
			before: unknown;
			after: unknown;
		}>;
	}>;
}

describe("sales crud", () => {
	beforeAll(async () => {
		app = await createTestApp();
	});

	afterAll(async () => {
		await app.close();
	});

	it("should create sale with active seller", async () => {
		const fixture = await createFixture();

		const response = await request(app.server)
			.post(`/organizations/${fixture.org.slug}/sales`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send(buildCreatePayload(fixture));

		expect(response.statusCode).toBe(201);
		expect(response.body).toHaveProperty("saleId");

		const sale = await prisma.sale.findUnique({
			where: {
				id: response.body.saleId,
			},
		});

		expect(sale).not.toBeNull();
		expect(sale?.status).toBe(SaleStatus.PENDING);
		expect(sale?.responsibleType).toBe("SELLER");
		expect(sale?.totalAmount).toBe(125_000);
		expect(sale?.saleDate.toISOString().slice(0, 10)).toBe("2026-03-04");

		const commissionsCount = await prisma.saleCommission.count({
			where: {
				saleId: response.body.saleId,
			},
		});
		expect(commissionsCount).toBe(0);
	});

	it("should create sale with dynamic fields snapshot", async () => {
		const fixture = await createFixture();
		const productDynamicFields = await createProductDynamicFields(
			fixture.product.id,
		);

		const response = await request(app.server)
			.post(`/organizations/${fixture.org.slug}/sales`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send(
				buildCreatePayload(fixture, {
					dynamicFields: {
						[productDynamicFields.groupField.id]: "Grupo Norte",
						[productDynamicFields.amountField.id]: 350_000,
						[productDynamicFields.stageField.id]:
							productDynamicFields.stageOptions[0]?.id,
						[productDynamicFields.channelsField.id]: [
							productDynamicFields.channelsOptions[0]?.id,
						],
					},
				}),
			);

		expect(response.statusCode).toBe(201);

		const sale = await prisma.sale.findUnique({
			where: {
				id: response.body.saleId,
			},
			select: {
				dynamicFieldSchema: true,
				dynamicFieldValues: true,
			},
		});

		expect(sale).not.toBeNull();
		expect(Array.isArray(sale?.dynamicFieldSchema)).toBe(true);

		const dynamicFieldSchema = sale?.dynamicFieldSchema as Array<{
			fieldId: string;
			label: string;
			type: string;
			required: boolean;
			options: Array<{ id: string; label: string }>;
		}>;
		const dynamicFieldValues = sale?.dynamicFieldValues as Record<
			string,
			unknown
		>;

		expect(dynamicFieldSchema).toHaveLength(4);
		expect(
			dynamicFieldSchema.some(
				(field) =>
					field.fieldId === productDynamicFields.groupField.id &&
					field.label === "Grupo" &&
					field.type === "TEXT",
			),
		).toBe(true);
		expect(dynamicFieldValues[productDynamicFields.groupField.id]).toBe(
			"Grupo Norte",
		);
		expect(dynamicFieldValues[productDynamicFields.amountField.id]).toBe(
			350_000,
		);
		expect(dynamicFieldValues[productDynamicFields.stageField.id]).toBe(
			productDynamicFields.stageOptions[0]?.id,
		);
		expect(dynamicFieldValues[productDynamicFields.channelsField.id]).toEqual([
			productDynamicFields.channelsOptions[0]?.id,
		]);
	});

	it("should reject create sale when required dynamic field is missing", async () => {
		const fixture = await createFixture();
		const productDynamicFields = await createProductDynamicFields(
			fixture.product.id,
		);

		const response = await request(app.server)
			.post(`/organizations/${fixture.org.slug}/sales`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send(
				buildCreatePayload(fixture, {
					dynamicFields: {
						[productDynamicFields.groupField.id]: "Grupo Norte",
						[productDynamicFields.stageField.id]:
							productDynamicFields.stageOptions[0]?.id,
					},
				}),
			);

		expect(response.statusCode).toBe(400);
		expect(response.body.message).toContain("Valor negociado");
	});

	it("should create sale with pulled and manual commissions", async () => {
		const fixture = await createFixture();

		const response = await request(app.server)
			.post(`/organizations/${fixture.org.slug}/sales`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send(
				buildCreatePayload(fixture, {
					commissions: buildCommissionsPayload(fixture),
				}),
			);

		expect(response.statusCode).toBe(201);

		const commissions = await prisma.saleCommission.findMany({
			where: {
				saleId: response.body.saleId,
			},
			orderBy: {
				sortOrder: "asc",
			},
			include: {
				installments: {
					orderBy: {
						installmentNumber: "asc",
					},
				},
			},
		});

		expect(commissions).toHaveLength(2);
		expect(commissions[0]?.sourceType).toBe("PULLED");
		expect(commissions[0]?.recipientType).toBe("SELLER");
		expect(commissions[0]?.direction).toBe("OUTCOME");
		expect(commissions[0]?.beneficiarySellerId).toBe(fixture.seller.id);
		expect(commissions[0]?.totalPercentage).toBe(10_000);
		expect(commissions[0]?.installments.map((item) => item.percentage)).toEqual(
			[5_000, 5_000],
		);
		expect(commissions[0]?.installments.map((item) => item.amount)).toEqual([
			625, 625,
		]);
		expect(commissions[1]?.sourceType).toBe("MANUAL");
		expect(commissions[1]?.recipientType).toBe("OTHER");
		expect(commissions[1]?.direction).toBe("OUTCOME");
		expect(commissions[1]?.beneficiaryLabel).toBe("Bônus Operacional");
		expect(commissions[1]?.installments.map((item) => item.amount)).toEqual([
			625,
		]);
	});

	it("should create sale with linked commission and preserve own percentages", async () => {
		const fixture = await createFixture();

		const response = await request(app.server)
			.post(`/organizations/${fixture.org.slug}/sales`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send(
				buildCreatePayload(fixture, {
					commissions: buildLinkedCommissionsPayload(fixture),
				}),
			);

		expect(response.statusCode).toBe(201);

		const commissions = await prisma.saleCommission.findMany({
			where: {
				saleId: response.body.saleId,
			},
			orderBy: {
				sortOrder: "asc",
			},
			include: {
				installments: {
					orderBy: {
						installmentNumber: "asc",
					},
				},
			},
		});

		expect(commissions).toHaveLength(2);
		expect(commissions[0]?.calculationBase).toBe("SALE_TOTAL");
		expect(commissions[0]?.baseCommissionId).toBeNull();
		expect(commissions[0]?.totalPercentage).toBe(10_000);
		expect(commissions[0]?.installments.map((item) => item.percentage)).toEqual(
			[10_000],
		);
		expect(commissions[0]?.installments.map((item) => item.amount)).toEqual([
			1_250,
		]);

		expect(commissions[1]?.calculationBase).toBe("COMMISSION");
		expect(commissions[1]?.baseCommissionId).toBe(commissions[0]?.id);
		expect(commissions[1]?.totalPercentage).toBe(100_000);
		expect(commissions[1]?.installments.map((item) => item.percentage)).toEqual(
			[60_000, 40_000],
		);
		expect(commissions[1]?.installments.map((item) => item.amount)).toEqual([
			75, 50,
		]);

		const detailResponse = await request(app.server)
			.get(`/organizations/${fixture.org.slug}/sales/${response.body.saleId}`)
			.set("Authorization", `Bearer ${fixture.token}`);

		expect(detailResponse.statusCode).toBe(200);
		expect(detailResponse.body.sale.commissions[0].calculationBase).toBe(
			"SALE_TOTAL",
		);
		expect(detailResponse.body.sale.commissions[0].baseCommissionIndex).toBe(
			undefined,
		);
		expect(detailResponse.body.sale.commissions[1].calculationBase).toBe(
			"COMMISSION",
		);
		expect(detailResponse.body.sale.commissions[1].baseCommissionIndex).toBe(0);
	});

	it("should reject commission link when base index is missing", async () => {
		const fixture = await createFixture();

		const response = await request(app.server)
			.post(`/organizations/${fixture.org.slug}/sales`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send(
				buildCreatePayload(fixture, {
					commissions: [
						{
							sourceType: "MANUAL",
							recipientType: "OTHER",
							beneficiaryLabel: "Sem base",
							calculationBase: "COMMISSION",
							startDate: "2026-03-10",
							totalPercentage: 10,
							installments: [
								{
									installmentNumber: 1,
									percentage: 10,
								},
							],
						},
					],
				}),
			);

		expect(response.statusCode).toBe(400);
	});

	it("should reject commission link when base index is out of range", async () => {
		const fixture = await createFixture();

		const response = await request(app.server)
			.post(`/organizations/${fixture.org.slug}/sales`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send(
				buildCreatePayload(fixture, {
					commissions: [
						{
							sourceType: "MANUAL",
							recipientType: "SELLER",
							beneficiaryId: fixture.seller.id,
							startDate: "2026-03-10",
							totalPercentage: 1,
							installments: [
								{
									installmentNumber: 1,
									percentage: 1,
								},
							],
						},
						{
							sourceType: "MANUAL",
							recipientType: "OTHER",
							beneficiaryLabel: "Fora do range",
							calculationBase: "COMMISSION",
							baseCommissionIndex: 9,
							startDate: "2026-03-10",
							totalPercentage: 10,
							installments: [
								{
									installmentNumber: 1,
									percentage: 10,
								},
							],
						},
					],
				}),
			);

		expect(response.statusCode).toBe(400);
	});

	it("should reject commission self-link", async () => {
		const fixture = await createFixture();

		const response = await request(app.server)
			.post(`/organizations/${fixture.org.slug}/sales`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send(
				buildCreatePayload(fixture, {
					commissions: [
						{
							sourceType: "MANUAL",
							recipientType: "OTHER",
							beneficiaryLabel: "Auto referência",
							calculationBase: "COMMISSION",
							baseCommissionIndex: 0,
							startDate: "2026-03-10",
							totalPercentage: 10,
							installments: [
								{
									installmentNumber: 1,
									percentage: 10,
								},
							],
						},
					],
				}),
			);

		expect(response.statusCode).toBe(400);
	});

	it("should reject commission link when base commission is also commission-based", async () => {
		const fixture = await createFixture();

		const response = await request(app.server)
			.post(`/organizations/${fixture.org.slug}/sales`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send(
				buildCreatePayload(fixture, {
					commissions: [
						{
							sourceType: "MANUAL",
							recipientType: "SELLER",
							beneficiaryId: fixture.seller.id,
							startDate: "2026-03-10",
							totalPercentage: 1,
							installments: [
								{
									installmentNumber: 1,
									percentage: 1,
								},
							],
						},
						{
							sourceType: "MANUAL",
							recipientType: "OTHER",
							beneficiaryLabel: "Base inválida A",
							calculationBase: "COMMISSION",
							baseCommissionIndex: 0,
							startDate: "2026-03-10",
							totalPercentage: 10,
							installments: [
								{
									installmentNumber: 1,
									percentage: 10,
								},
							],
						},
						{
							sourceType: "MANUAL",
							recipientType: "OTHER",
							beneficiaryLabel: "Base inválida B",
							calculationBase: "COMMISSION",
							baseCommissionIndex: 1,
							startDate: "2026-03-10",
							totalPercentage: 10,
							installments: [
								{
									installmentNumber: 1,
									percentage: 10,
								},
							],
						},
					],
				}),
			);

		expect(response.statusCode).toBe(400);
	});

	it("should persist explicit commission direction when provided", async () => {
		const fixture = await createFixture();

		const response = await request(app.server)
			.post(`/organizations/${fixture.org.slug}/sales`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send(
				buildCreatePayload(fixture, {
					commissions: [
						{
							sourceType: "MANUAL",
							recipientType: "SELLER",
							direction: "INCOME",
							beneficiaryId: fixture.seller.id,
							startDate: "2026-03-10",
							totalPercentage: 1,
							installments: [
								{
									installmentNumber: 1,
									percentage: 1,
								},
							],
						},
					],
				}),
			);

		expect(response.statusCode).toBe(201);

		const commissions = await prisma.saleCommission.findMany({
			where: {
				saleId: response.body.saleId,
			},
			select: {
				direction: true,
				recipientType: true,
			},
		});

		expect(commissions).toHaveLength(1);
		expect(commissions[0]?.recipientType).toBe("SELLER");
		expect(commissions[0]?.direction).toBe("INCOME");
	});

	it("should derive commission direction from recipient type when omitted", async () => {
		const fixture = await createFixture();

		const response = await request(app.server)
			.post(`/organizations/${fixture.org.slug}/sales`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send(
				buildCreatePayload(fixture, {
					commissions: [
						{
							sourceType: "MANUAL",
							recipientType: "COMPANY",
							beneficiaryId: fixture.company.id,
							startDate: "2026-03-10",
							totalPercentage: 1,
							installments: [
								{
									installmentNumber: 1,
									percentage: 1,
								},
							],
						},
						{
							sourceType: "MANUAL",
							recipientType: "UNIT",
							beneficiaryId: fixture.unit.id,
							startDate: "2026-03-10",
							totalPercentage: 1,
							installments: [
								{
									installmentNumber: 1,
									percentage: 1,
								},
							],
						},
						{
							sourceType: "MANUAL",
							recipientType: "SELLER",
							beneficiaryId: fixture.seller.id,
							startDate: "2026-03-10",
							totalPercentage: 1,
							installments: [
								{
									installmentNumber: 1,
									percentage: 1,
								},
							],
						},
						{
							sourceType: "MANUAL",
							recipientType: "PARTNER",
							beneficiaryId: fixture.partner.id,
							startDate: "2026-03-10",
							totalPercentage: 1,
							installments: [
								{
									installmentNumber: 1,
									percentage: 1,
								},
							],
						},
						{
							sourceType: "MANUAL",
							recipientType: "SUPERVISOR",
							beneficiaryId: fixture.supervisor.id,
							startDate: "2026-03-10",
							totalPercentage: 1,
							installments: [
								{
									installmentNumber: 1,
									percentage: 1,
								},
							],
						},
						{
							sourceType: "MANUAL",
							recipientType: "OTHER",
							beneficiaryLabel: "Terceiro",
							startDate: "2026-03-10",
							totalPercentage: 1,
							installments: [
								{
									installmentNumber: 1,
									percentage: 1,
								},
							],
						},
					],
				}),
			);

		expect(response.statusCode).toBe(201);

		const commissions = await prisma.saleCommission.findMany({
			where: {
				saleId: response.body.saleId,
			},
			orderBy: {
				sortOrder: "asc",
			},
			select: {
				recipientType: true,
				direction: true,
			},
		});

		expect(commissions.map((commission) => commission.recipientType)).toEqual([
			"COMPANY",
			"UNIT",
			"SELLER",
			"PARTNER",
			"SUPERVISOR",
			"OTHER",
		]);
		expect(commissions.map((commission) => commission.direction)).toEqual([
			"INCOME",
			"INCOME",
			"OUTCOME",
			"OUTCOME",
			"OUTCOME",
			"OUTCOME",
		]);
	});

	it("should calculate installment amounts from sale total amount", async () => {
		const fixture = await createFixture();

		const response = await request(app.server)
			.post(`/organizations/${fixture.org.slug}/sales`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send(
				buildCreatePayload(fixture, {
					totalAmount: 100_000,
					commissions: [
						{
							sourceType: "PULLED",
							recipientType: "SELLER",
							beneficiaryId: fixture.seller.id,
							startDate: "2026-03-10",
							totalPercentage: 1,
							installments: [
								{
									installmentNumber: 1,
									percentage: 0.25,
								},
								{
									installmentNumber: 2,
									percentage: 0.25,
								},
								{
									installmentNumber: 3,
									percentage: 0.25,
								},
								{
									installmentNumber: 4,
									percentage: 0.25,
								},
							],
						},
					],
				}),
			);

		expect(response.statusCode).toBe(201);

		const installments = await prisma.saleCommissionInstallment.findMany({
			where: {
				saleCommission: {
					saleId: response.body.saleId,
				},
			},
			orderBy: {
				installmentNumber: "asc",
			},
			select: {
				amount: true,
			},
		});

		expect(installments.map((installment) => installment.amount)).toEqual([
			250, 250, 250, 250,
		]);
	});

	it("should apply rounding residual to last installment", async () => {
		const fixture = await createFixture();

		const response = await request(app.server)
			.post(`/organizations/${fixture.org.slug}/sales`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send(
				buildCreatePayload(fixture, {
					totalAmount: 100_050,
					commissions: [
						{
							sourceType: "PULLED",
							recipientType: "SELLER",
							beneficiaryId: fixture.seller.id,
							startDate: "2026-03-10",
							totalPercentage: 1,
							installments: [
								{
									installmentNumber: 1,
									percentage: 0.25,
								},
								{
									installmentNumber: 2,
									percentage: 0.25,
								},
								{
									installmentNumber: 3,
									percentage: 0.25,
								},
								{
									installmentNumber: 4,
									percentage: 0.25,
								},
							],
						},
					],
				}),
			);

		expect(response.statusCode).toBe(201);

		const installments = await prisma.saleCommissionInstallment.findMany({
			where: {
				saleCommission: {
					saleId: response.body.saleId,
				},
			},
			orderBy: {
				installmentNumber: "asc",
			},
			select: {
				amount: true,
			},
		});

		expect(installments.map((installment) => installment.amount)).toEqual([
			250, 250, 250, 251,
		]);
	});

	it("should create sale with active partner", async () => {
		const fixture = await createFixture();

		const response = await request(app.server)
			.post(`/organizations/${fixture.org.slug}/sales`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send(
				buildCreatePayload(fixture, {
					responsible: {
						type: "PARTNER",
						id: fixture.partner.id,
					},
					unitId: undefined,
				}),
			);

		expect(response.statusCode).toBe(201);

		const sale = await prisma.sale.findUnique({
			where: {
				id: response.body.saleId,
			},
		});

		expect(sale?.responsibleType).toBe("PARTNER");
		expect(sale?.responsibleId).toBe(fixture.partner.id);
	});

	it("should create sale with inactive partner as responsible", async () => {
		const fixture = await createFixture();

		const response = await request(app.server)
			.post(`/organizations/${fixture.org.slug}/sales`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send(
				buildCreatePayload(fixture, {
					responsible: {
						type: "PARTNER",
						id: fixture.inactivePartner.id,
					},
					unitId: undefined,
				}),
			);

		expect(response.statusCode).toBe(201);

		const sale = await prisma.sale.findUnique({
			where: {
				id: response.body.saleId,
			},
			select: {
				responsibleType: true,
				responsibleId: true,
			},
		});
		const partner = await prisma.partner.findUnique({
			where: {
				id: fixture.inactivePartner.id,
			},
			select: {
				status: true,
			},
		});

		expect(sale?.responsibleType).toBe("PARTNER");
		expect(sale?.responsibleId).toBe(fixture.inactivePartner.id);
		expect(partner?.status).toBe(PartnerStatus.INACTIVE);
	});

	it("should auto activate inactive responsible partner only when sale is completed", async () => {
		const fixture = await createFixture();

		const createResponse = await request(app.server)
			.post(`/organizations/${fixture.org.slug}/sales`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send(
				buildCreatePayload(fixture, {
					responsible: {
						type: "PARTNER",
						id: fixture.inactivePartner.id,
					},
					unitId: undefined,
				}),
			);
		expect(createResponse.statusCode).toBe(201);

		const saleId = createResponse.body.saleId as string;

		await patchSaleStatusUsingApi(fixture, saleId, "APPROVED");

		const partnerAfterApproved = await prisma.partner.findUnique({
			where: {
				id: fixture.inactivePartner.id,
			},
			select: {
				status: true,
			},
		});
		expect(partnerAfterApproved?.status).toBe(PartnerStatus.INACTIVE);

		await patchSaleStatusUsingApi(fixture, saleId, "COMPLETED");

		const partnerAfterCompleted = await prisma.partner.findUnique({
			where: {
				id: fixture.inactivePartner.id,
			},
			select: {
				status: true,
			},
		});
		expect(partnerAfterCompleted?.status).toBe(PartnerStatus.ACTIVE);
	});

	it("should keep inactive commission partner inactive after completing sale", async () => {
		const fixture = await createFixture();
		const saleId = await createSaleUsingApi(
			fixture,
			buildCreatePayload(fixture, {
				commissions: [
					{
						sourceType: "MANUAL",
						recipientType: "PARTNER",
						beneficiaryId: fixture.inactivePartner.id,
						startDate: "2026-03-10",
						totalPercentage: 1,
						installments: [
							{
								installmentNumber: 1,
								percentage: 1,
							},
						],
					},
				],
			}),
		);

		await patchSaleStatusUsingApi(fixture, saleId, "APPROVED");
		await patchSaleStatusUsingApi(fixture, saleId, "COMPLETED");

		const partnerAfterCompleted = await prisma.partner.findUnique({
			where: {
				id: fixture.inactivePartner.id,
			},
			select: {
				status: true,
			},
		});

		expect(partnerAfterCompleted?.status).toBe(PartnerStatus.INACTIVE);
	});

	it("should create delinquency for completed sale and expose it in sale details and sales list", async () => {
		const fixture = await createFixture();
		const saleId = await createSaleUsingApi(fixture);
		const dueDate = getRelativeDateInput(-10);

		await patchSaleStatusUsingApi(fixture, saleId, "APPROVED");
		await patchSaleStatusUsingApi(fixture, saleId, "COMPLETED");

		const delinquencyId = await createSaleDelinquencyUsingApi(
			fixture,
			saleId,
			dueDate,
		);

		const saleDetailResponse = await request(app.server)
			.get(`/organizations/${fixture.org.slug}/sales/${saleId}`)
			.set("Authorization", `Bearer ${fixture.token}`);

		expect(saleDetailResponse.statusCode).toBe(200);
		expect(saleDetailResponse.body.sale.delinquencySummary).toMatchObject({
			hasOpen: true,
			openCount: 1,
			oldestDueDate: toDateOnlyIsoString(dueDate),
			latestDueDate: toDateOnlyIsoString(dueDate),
		});
		expect(saleDetailResponse.body.sale.openDelinquencies).toHaveLength(1);
		expect(saleDetailResponse.body.sale.openDelinquencies[0]?.id).toBe(
			delinquencyId,
		);
		expect(saleDetailResponse.body.sale.delinquencyHistory).toHaveLength(0);

		const salesResponse = await request(app.server)
			.get(`/organizations/${fixture.org.slug}/sales`)
			.set("Authorization", `Bearer ${fixture.token}`);

		expect(salesResponse.statusCode).toBe(200);
		const listedSale = salesResponse.body.sales.find(
			(sale: { id: string }) => sale.id === saleId,
		);
		expect(listedSale?.delinquencySummary).toMatchObject({
			hasOpen: true,
			openCount: 1,
		});
	});

	it("should reject delinquency creation when sale is not completed", async () => {
		const fixture = await createFixture();
		const saleId = await createSaleUsingApi(fixture);
		const dueDate = getRelativeDateInput(-10);

		const pendingResponse = await request(app.server)
			.post(`/organizations/${fixture.org.slug}/sales/${saleId}/delinquencies`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				dueDate,
			});

		expect(pendingResponse.statusCode).toBe(400);
		expect(pendingResponse.body.message).toBe(
			"Delinquency can only be created for completed sales",
		);

		await patchSaleStatusUsingApi(fixture, saleId, "APPROVED");

		const approvedResponse = await request(app.server)
			.post(`/organizations/${fixture.org.slug}/sales/${saleId}/delinquencies`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				dueDate,
			});

		expect(approvedResponse.statusCode).toBe(400);
		expect(approvedResponse.body.message).toBe(
			"Delinquency can only be created for completed sales",
		);
	});

	it("should reject delinquency creation when due date is in the future", async () => {
		const fixture = await createFixture();
		const saleId = await createSaleUsingApi(fixture);
		const futureDueDate = getRelativeDateInput(1);

		await patchSaleStatusUsingApi(fixture, saleId, "APPROVED");
		await patchSaleStatusUsingApi(fixture, saleId, "COMPLETED");

		const response = await request(app.server)
			.post(`/organizations/${fixture.org.slug}/sales/${saleId}/delinquencies`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				dueDate: futureDueDate,
			});

		expect(response.statusCode).toBe(400);
		expect(response.body.message).toContain(
			"Delinquency due date cannot be in the future",
		);
	});

	it("should allow multiple delinquency due dates and reject duplicate open due date", async () => {
		const fixture = await createFixture();
		const saleId = await createSaleUsingApi(fixture);
		const firstDueDate = getRelativeDateInput(-30);
		const secondDueDate = getRelativeDateInput(-5);

		await patchSaleStatusUsingApi(fixture, saleId, "APPROVED");
		await patchSaleStatusUsingApi(fixture, saleId, "COMPLETED");

		await createSaleDelinquencyUsingApi(fixture, saleId, firstDueDate);
		await createSaleDelinquencyUsingApi(fixture, saleId, secondDueDate);

		const duplicatedResponse = await request(app.server)
			.post(`/organizations/${fixture.org.slug}/sales/${saleId}/delinquencies`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				dueDate: firstDueDate,
			});

		expect(duplicatedResponse.statusCode).toBe(400);
		expect(duplicatedResponse.body.message).toBe(
			"An open delinquency already exists for this due date",
		);
	});

	it(
		"should resolve delinquency items individually, keep history and clear active state after last open item",
		async () => {
		const fixture = await createFixture();
		const saleId = await createSaleUsingApi(fixture);
		const firstDueDate = getRelativeDateInput(-30);
		const secondDueDate = getRelativeDateInput(-5);

		await patchSaleStatusUsingApi(fixture, saleId, "APPROVED");
		await patchSaleStatusUsingApi(fixture, saleId, "COMPLETED");

		const firstDelinquencyId = await createSaleDelinquencyUsingApi(
			fixture,
			saleId,
			firstDueDate,
		);
		const secondDelinquencyId = await createSaleDelinquencyUsingApi(
			fixture,
			saleId,
			secondDueDate,
		);

		await resolveSaleDelinquencyUsingApi(fixture, saleId, firstDelinquencyId);

		const detailAfterFirstResolution = await request(app.server)
			.get(`/organizations/${fixture.org.slug}/sales/${saleId}`)
			.set("Authorization", `Bearer ${fixture.token}`);

		expect(detailAfterFirstResolution.statusCode).toBe(200);
		expect(detailAfterFirstResolution.body.sale.delinquencySummary).toMatchObject({
			hasOpen: true,
			openCount: 1,
			oldestDueDate: toDateOnlyIsoString(secondDueDate),
			latestDueDate: toDateOnlyIsoString(secondDueDate),
		});
		expect(detailAfterFirstResolution.body.sale.openDelinquencies).toHaveLength(1);
		expect(detailAfterFirstResolution.body.sale.openDelinquencies[0]?.id).toBe(
			secondDelinquencyId,
		);
		expect(detailAfterFirstResolution.body.sale.delinquencyHistory).toHaveLength(
			1,
		);

		await resolveSaleDelinquencyUsingApi(fixture, saleId, secondDelinquencyId);

		const detailAfterSecondResolution = await request(app.server)
			.get(`/organizations/${fixture.org.slug}/sales/${saleId}`)
			.set("Authorization", `Bearer ${fixture.token}`);

		expect(detailAfterSecondResolution.statusCode).toBe(200);
		expect(
			detailAfterSecondResolution.body.sale.delinquencySummary,
		).toMatchObject({
			hasOpen: false,
			openCount: 0,
			oldestDueDate: null,
			latestDueDate: null,
		});
		expect(detailAfterSecondResolution.body.sale.openDelinquencies).toHaveLength(
			0,
		);
		expect(detailAfterSecondResolution.body.sale.delinquencyHistory).toHaveLength(
			2,
		);

		const history = await getSaleHistoryEvents(fixture, saleId);
		expect(
			history.some((event) => event.action === "DELINQUENCY_CREATED"),
		).toBe(true);
		expect(
			history.some((event) => event.action === "DELINQUENCY_RESOLVED"),
		).toBe(true);
		},
		15000,
	);

	it(
		"should delete open delinquency and clear active state when it was the last one",
		async () => {
			const fixture = await createFixture();
			const saleId = await createSaleUsingApi(fixture);
			const dueDate = getRelativeDateInput(-10);

			await patchSaleStatusUsingApi(fixture, saleId, "APPROVED");
			await patchSaleStatusUsingApi(fixture, saleId, "COMPLETED");

			const delinquencyId = await createSaleDelinquencyUsingApi(
				fixture,
				saleId,
				dueDate,
			);

			await deleteSaleDelinquencyUsingApi(fixture, saleId, delinquencyId);

			const detailResponse = await request(app.server)
				.get(`/organizations/${fixture.org.slug}/sales/${saleId}`)
				.set("Authorization", `Bearer ${fixture.token}`);

			expect(detailResponse.statusCode).toBe(200);
			expect(detailResponse.body.sale.delinquencySummary).toMatchObject({
				hasOpen: false,
				openCount: 0,
				oldestDueDate: null,
				latestDueDate: null,
			});
			expect(detailResponse.body.sale.openDelinquencies).toHaveLength(0);
			expect(detailResponse.body.sale.delinquencyHistory).toHaveLength(0);

			const deletedDelinquency = await prisma.saleDelinquency.findUnique({
				where: {
					id: delinquencyId,
				},
			});
			expect(deletedDelinquency).toBeNull();

			const history = await getSaleHistoryEvents(fixture, saleId);
			expect(
				history.some((event) => event.action === "DELINQUENCY_DELETED"),
			).toBe(true);
		},
		15000,
	);

	it(
		"should delete resolved delinquency from history",
		async () => {
			const fixture = await createFixture();
			const saleId = await createSaleUsingApi(fixture);
			const dueDate = getRelativeDateInput(-10);

			await patchSaleStatusUsingApi(fixture, saleId, "APPROVED");
			await patchSaleStatusUsingApi(fixture, saleId, "COMPLETED");

			const delinquencyId = await createSaleDelinquencyUsingApi(
				fixture,
				saleId,
				dueDate,
			);

			await resolveSaleDelinquencyUsingApi(fixture, saleId, delinquencyId);
			await deleteSaleDelinquencyUsingApi(fixture, saleId, delinquencyId);

			const detailResponse = await request(app.server)
				.get(`/organizations/${fixture.org.slug}/sales/${saleId}`)
				.set("Authorization", `Bearer ${fixture.token}`);

			expect(detailResponse.statusCode).toBe(200);
			expect(detailResponse.body.sale.delinquencySummary).toMatchObject({
				hasOpen: false,
				openCount: 0,
				oldestDueDate: null,
				latestDueDate: null,
			});
			expect(detailResponse.body.sale.openDelinquencies).toHaveLength(0);
			expect(detailResponse.body.sale.delinquencyHistory).toHaveLength(0);

			const history = await getSaleHistoryEvents(fixture, saleId);
			expect(
				history.filter((event) => event.action === "DELINQUENCY_DELETED"),
			).toHaveLength(1);
		},
		15000,
	);

	it(
		"should list only delinquent sales and expose customer sales delinquency summary",
		async () => {
		const fixture = await createFixture();
		const delinquentSaleId = await createSaleUsingApi(
			fixture,
			buildCreatePayload(fixture, {
				saleDate: "2026-03-04",
			}),
		);
		const regularSaleId = await createSaleUsingApi(
			fixture,
			buildCreatePayload(fixture, {
				saleDate: "2026-03-05",
			}),
		);

		await patchSaleStatusUsingApi(fixture, delinquentSaleId, "APPROVED");
		await patchSaleStatusUsingApi(fixture, delinquentSaleId, "COMPLETED");
		await patchSaleStatusUsingApi(fixture, regularSaleId, "APPROVED");
		await patchSaleStatusUsingApi(fixture, regularSaleId, "COMPLETED");
		const dueDate = getRelativeDateInput(-10);
		await createSaleDelinquencyUsingApi(
			fixture,
			delinquentSaleId,
			dueDate,
		);

		const delinquentSalesResponse = await request(app.server)
			.get(`/organizations/${fixture.org.slug}/sales/delinquency`)
			.set("Authorization", `Bearer ${fixture.token}`);

		expect(delinquentSalesResponse.statusCode).toBe(200);
		expect(delinquentSalesResponse.body.sales).toHaveLength(1);
		expect(delinquentSalesResponse.body.sales[0]?.id).toBe(delinquentSaleId);
		expect(delinquentSalesResponse.body.sales[0]?.openDelinquencies).toHaveLength(
			1,
		);

		const customerResponse = await request(app.server)
			.get(
				`/organizations/${fixture.org.slug}/customers/${fixture.customer.id}`,
			)
			.set("Authorization", `Bearer ${fixture.token}`);

		expect(customerResponse.statusCode).toBe(200);
		expect(customerResponse.body.customer.sales).toHaveLength(2);

		const customerDelinquentSale = customerResponse.body.customer.sales.find(
			(sale: { id: string }) => sale.id === delinquentSaleId,
		);
		const customerRegularSale = customerResponse.body.customer.sales.find(
			(sale: { id: string }) => sale.id === regularSaleId,
		);

		expect(customerDelinquentSale?.delinquencySummary).toMatchObject({
			hasOpen: true,
			openCount: 1,
		});
		expect(customerDelinquentSale?.openDelinquencies).toHaveLength(1);
		expect(customerRegularSale?.delinquencySummary).toMatchObject({
			hasOpen: false,
			openCount: 0,
		});
		expect(customerRegularSale?.openDelinquencies).toHaveLength(0);
		},
		15000,
	);

	it("should fail when customer is inactive", async () => {
		const fixture = await createFixture();

		const response = await request(app.server)
			.post(`/organizations/${fixture.org.slug}/sales`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send(
				buildCreatePayload(fixture, {
					customerId: fixture.inactiveCustomer.id,
				}),
			);

		expect(response.statusCode).toBe(400);
		expect(response.body.message).toBe("Customer not found or inactive");
	});

	it("should fail when product is inactive", async () => {
		const fixture = await createFixture();

		const response = await request(app.server)
			.post(`/organizations/${fixture.org.slug}/sales`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send(
				buildCreatePayload(fixture, {
					productId: fixture.inactiveProduct.id,
				}),
			);

		expect(response.statusCode).toBe(400);
		expect(response.body.message).toBe("Product not found or inactive");
	});

	it("should fail when unit is outside selected company", async () => {
		const fixture = await createFixture();

		const response = await request(app.server)
			.post(`/organizations/${fixture.org.slug}/sales`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send(
				buildCreatePayload(fixture, {
					companyId: fixture.company.id,
					unitId: fixture.foreignUnit.id,
				}),
			);

		expect(response.statusCode).toBe(400);
		expect(response.body.message).toBe("Unit not found for company");
	});

	it("should fail when responsible is inactive", async () => {
		const fixture = await createFixture();

		const response = await request(app.server)
			.post(`/organizations/${fixture.org.slug}/sales`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send(
				buildCreatePayload(fixture, {
					responsible: {
						type: "SELLER",
						id: fixture.inactiveSeller.id,
					},
				}),
			);

		expect(response.statusCode).toBe(400);
		expect(response.body.message).toBe("Seller not found or inactive");
	});

	it("should fail when commission installments total does not match total percentage", async () => {
		const fixture = await createFixture();

		const response = await request(app.server)
			.post(`/organizations/${fixture.org.slug}/sales`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send(
				buildCreatePayload(fixture, {
					commissions: [
						{
							sourceType: "MANUAL",
							recipientType: "SELLER",
							beneficiaryId: fixture.seller.id,
							startDate: "2026-03-10",
							totalPercentage: 1,
							installments: [
								{
									installmentNumber: 1,
									percentage: 0.4,
								},
								{
									installmentNumber: 2,
									percentage: 0.4,
								},
							],
						},
					],
				}),
			);

		expect(response.statusCode).toBe(400);
	});

	it("should fail when commission start date is missing", async () => {
		const fixture = await createFixture();

		const payload = buildCreatePayload(fixture) as Record<string, unknown>;
		payload.commissions = [
			{
				sourceType: "MANUAL",
				recipientType: "SELLER",
				beneficiaryId: fixture.seller.id,
				totalPercentage: 1,
				installments: [
					{
						installmentNumber: 1,
						percentage: 1,
					},
				],
			},
		];

		const response = await request(app.server)
			.post(`/organizations/${fixture.org.slug}/sales`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send(payload);

		expect(response.statusCode).toBe(400);
	});

	it("should fail when commission beneficiary is outside organization", async () => {
		const fixture = await createFixture();

		const response = await request(app.server)
			.post(`/organizations/${fixture.org.slug}/sales`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send(
				buildCreatePayload(fixture, {
					commissions: [
						{
							sourceType: "MANUAL",
							recipientType: "COMPANY",
							beneficiaryId: "11111111-1111-4111-8111-111111111111",
							startDate: "2026-03-10",
							totalPercentage: 1,
							installments: [
								{
									installmentNumber: 1,
									percentage: 1,
								},
							],
						},
					],
				}),
			);

		expect(response.statusCode).toBe(400);
		expect(response.body.message).toBe("One or more companies were not found");
	});

	it("should list sales with summary names", async () => {
		const fixture = await createFixture();

		const firstSaleId = await createSaleUsingApi(fixture);

		const secondSaleId = await createSaleUsingApi(
			fixture,
			buildCreatePayload(fixture, {
				responsible: {
					type: "PARTNER",
					id: fixture.partner.id,
				},
				notes: "Venda por parceiro",
				commissions: buildCommissionsPayload(fixture),
			}),
		);

		const response = await request(app.server)
			.get(`/organizations/${fixture.org.slug}/sales`)
			.set("Authorization", `Bearer ${fixture.token}`);

		expect(response.statusCode).toBe(200);
		expect(Array.isArray(response.body.sales)).toBe(true);
		expect(response.body.sales).toHaveLength(2);

		const firstSale = response.body.sales.find(
			(sale: { id: string }) => sale.id === firstSaleId,
		);

		expect(firstSale).toBeDefined();
		expect(firstSale.customer.name).toBe(fixture.customer.name);
		expect(firstSale.product.name).toBe(fixture.product.name);
		expect(firstSale.company.name).toBe(fixture.company.name);
		expect(firstSale.createdBy.id).toBeDefined();
		expect(firstSale.responsible.type).toBe("SELLER");
		expect(firstSale.commissionInstallmentsSummary).toEqual({
			total: 0,
			pending: 0,
			paid: 0,
			canceled: 0,
			reversed: 0,
		});

		const secondSale = response.body.sales.find(
			(sale: { id: string }) => sale.id === secondSaleId,
		);

		expect(secondSale).toBeDefined();
		expect(secondSale.commissionInstallmentsSummary).toEqual({
			total: 3,
			pending: 3,
			paid: 0,
			canceled: 0,
			reversed: 0,
		});
	});

	it("should get sale by id", async () => {
		const fixture = await createFixture();
		const saleId = await createSaleUsingApi(
			fixture,
			buildCreatePayload(fixture, {
				commissions: buildCommissionsPayload(fixture),
			}),
		);

		const response = await request(app.server)
			.get(`/organizations/${fixture.org.slug}/sales/${saleId}`)
			.set("Authorization", `Bearer ${fixture.token}`);

		expect(response.statusCode).toBe(200);
		expect(response.body.sale.id).toBe(saleId);
		expect(response.body.sale.organizationId).toBe(fixture.org.id);
		expect(response.body.sale.customer.id).toBe(fixture.customer.id);
		expect(response.body.sale.product.id).toBe(fixture.product.id);
		expect(response.body.sale.company.id).toBe(fixture.company.id);
		expect(response.body.sale.unit.id).toBe(fixture.unit.id);
		expect(response.body.sale.responsible.type).toBe("SELLER");
		expect(response.body.sale.commissions).toHaveLength(2);
		expect(response.body.sale.commissions[0].sourceType).toBe("PULLED");
		expect(response.body.sale.commissions[1].sourceType).toBe("MANUAL");
		expect(response.body.sale.commissions[0].calculationBase).toBe(
			"SALE_TOTAL",
		);
		expect(
			response.body.sale.commissions[0].baseCommissionIndex,
		).toBeUndefined();
		expect(response.body.sale.commissions[1].calculationBase).toBe(
			"SALE_TOTAL",
		);
		expect(
			response.body.sale.commissions[1].baseCommissionIndex,
		).toBeUndefined();
		expect(response.body.sale.commissions[0].direction).toBe("OUTCOME");
		expect(response.body.sale.commissions[1].direction).toBe("OUTCOME");
		expect(response.body.sale.commissions[0].totalAmount).toBe(1_250);
		expect(response.body.sale.commissions[1].totalAmount).toBe(625);
		expect(
			response.body.sale.commissions[0].installments.map(
				(installment: { amount: number }) => installment.amount,
			),
		).toEqual([625, 625]);
		expect(
			response.body.sale.commissions[1].installments.map(
				(installment: { amount: number }) => installment.amount,
			),
		).toEqual([625]);
		for (const commission of response.body.sale.commissions as Array<{
			totalAmount: number;
			installments: Array<{ amount: number }>;
		}>) {
			const installmentsTotal = commission.installments.reduce(
				(sum, installment) => sum + installment.amount,
				0,
			);
			expect(installmentsTotal).toBe(commission.totalAmount);
		}
	});

	it("should create sale history events for create and update", async () => {
		const fixture = await createFixture();
		const saleId = await createSaleUsingApi(fixture);

		const createdHistory = await getSaleHistoryEvents(fixture, saleId);
		expect(createdHistory).toHaveLength(1);
		expect(createdHistory[0]?.action).toBe("CREATED");
		expect(createdHistory[0]?.actor.id).toBe(fixture.user.id);
		expect(createdHistory[0]?.changes.length).toBeGreaterThan(0);
		expect(
			createdHistory[0]?.changes.some(
				(change) => change.path === "sale.totalAmount",
			),
		).toBe(true);

		const updateResponse = await request(app.server)
			.put(`/organizations/${fixture.org.slug}/sales/${saleId}`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send(
				buildCreatePayload(fixture, {
					totalAmount: 130_000,
					notes: "Venda com valor atualizado",
				}),
			);

		expect(updateResponse.statusCode).toBe(204);

		const updatedHistory = await getSaleHistoryEvents(fixture, saleId);
		expect(updatedHistory[0]?.action).toBe("UPDATED");
		expect(updatedHistory[1]?.action).toBe("CREATED");
		expect(
			new Date(updatedHistory[0]?.createdAt ?? "").getTime(),
		).toBeGreaterThanOrEqual(
			new Date(updatedHistory[1]?.createdAt ?? "").getTime(),
		);

		const totalAmountChange = updatedHistory[0]?.changes.find(
			(change) => change.path === "sale.totalAmount",
		);
		expect(totalAmountChange).toBeDefined();
		expect(totalAmountChange?.before).toBe(125_000);
		expect(totalAmountChange?.after).toBe(130_000);
	});

	it("should include dynamic field diff in sale history", async () => {
		const fixture = await createFixture();
		const productDynamicFields = await createProductDynamicFields(
			fixture.product.id,
		);
		const saleId = await createSaleUsingApi(
			fixture,
			buildCreatePayload(fixture, {
				dynamicFields: {
					[productDynamicFields.groupField.id]: "Grupo Norte",
					[productDynamicFields.amountField.id]: 200_000,
					[productDynamicFields.stageField.id]:
						productDynamicFields.stageOptions[0]?.id,
					[productDynamicFields.channelsField.id]: [
						productDynamicFields.channelsOptions[0]?.id,
					],
				},
			}),
		);

		const updateResponse = await request(app.server)
			.put(`/organizations/${fixture.org.slug}/sales/${saleId}`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send(
				buildCreatePayload(fixture, {
					dynamicFields: {
						[productDynamicFields.groupField.id]: "Grupo Sul",
						[productDynamicFields.amountField.id]: 300_000,
						[productDynamicFields.stageField.id]:
							productDynamicFields.stageOptions[1]?.id,
						[productDynamicFields.channelsField.id]: [
							productDynamicFields.channelsOptions[0]?.id,
							productDynamicFields.channelsOptions[1]?.id,
						],
					},
				}),
			);

		expect(updateResponse.statusCode).toBe(204);

		const history = await getSaleHistoryEvents(fixture, saleId);
		const updateEvent = history.find((event) => event.action === "UPDATED");

		expect(updateEvent).toBeDefined();

		const groupFieldChange = updateEvent?.changes.find(
			(change) =>
				change.path ===
				`sale.dynamicFieldValues.${productDynamicFields.groupField.id}`,
		) as
			| {
					before: { value: unknown; label: string };
					after: { value: unknown; label: string };
			  }
			| undefined;

		expect(groupFieldChange).toBeDefined();
		expect(groupFieldChange?.before.label).toBe("Grupo");
		expect(groupFieldChange?.before.value).toBe("Grupo Norte");
		expect(groupFieldChange?.after.value).toBe("Grupo Sul");
	});

	it("should create sale history events for status and commission installment changes", async () => {
		const fixture = await createFixture();
		const saleId = await createSaleUsingApi(
			fixture,
			buildCreatePayload(fixture, {
				commissions: buildCommissionsPayload(fixture),
			}),
		);

		const approveResponse = await request(app.server)
			.patch(`/organizations/${fixture.org.slug}/sales/${saleId}/status`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				status: "APPROVED",
			});
		expect(approveResponse.statusCode).toBe(204);

		const commission = await prisma.saleCommission.findFirst({
			where: {
				saleId,
			},
			orderBy: {
				sortOrder: "asc",
			},
			select: {
				id: true,
			},
		});
		expect(commission?.id).toBeDefined();

		const installments = await prisma.saleCommissionInstallment.findMany({
			where: {
				saleCommissionId: commission?.id,
			},
			orderBy: {
				installmentNumber: "asc",
			},
			select: {
				id: true,
				expectedPaymentDate: true,
			},
		});
		expect(installments.length).toBeGreaterThan(1);

		const updateInstallmentResponse = await request(app.server)
			.patch(
				`/organizations/${fixture.org.slug}/sales/${saleId}/commission-installments/${installments[0]?.id}`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				amount: 777,
				expectedPaymentDate: "2026-04-15",
			});
		expect(updateInstallmentResponse.statusCode).toBe(204);

		const patchInstallmentStatusResponse = await request(app.server)
			.patch(
				`/organizations/${fixture.org.slug}/sales/${saleId}/commission-installments/${installments[0]?.id}/status`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				status: "PAID",
				paymentDate: "2026-04-20",
				amount: 778,
			});
		expect(patchInstallmentStatusResponse.statusCode).toBe(204);

		const deleteInstallmentResponse = await request(app.server)
			.delete(
				`/organizations/${fixture.org.slug}/sales/${saleId}/commission-installments/${installments[1]?.id}`,
			)
			.set("Authorization", `Bearer ${fixture.token}`);
		expect(deleteInstallmentResponse.statusCode).toBe(204);

		const history = await getSaleHistoryEvents(fixture, saleId);
		const actions = history.map((event) => event.action);

		expect(actions).toContain("CREATED");
		expect(actions).toContain("STATUS_CHANGED");
		expect(actions).toContain("COMMISSION_INSTALLMENT_UPDATED");
		expect(actions).toContain("COMMISSION_INSTALLMENT_STATUS_UPDATED");
		expect(actions).toContain("COMMISSION_INSTALLMENT_DELETED");

		const statusEvent = history.find(
			(event) => event.action === "STATUS_CHANGED",
		);
		expect(statusEvent).toBeDefined();
		expect(
			statusEvent?.changes.some(
				(change) =>
					change.path === "sale.status" &&
					change.before === "PENDING" &&
					change.after === "APPROVED",
			),
		).toBe(true);
	});

	it("should return history scoped by sale", async () => {
		const fixture = await createFixture();
		const firstSaleId = await createSaleUsingApi(fixture);
		const secondSaleId = await createSaleUsingApi(
			fixture,
			buildCreatePayload(fixture, {
				notes: "Segunda venda",
			}),
		);

		const firstSaleUpdateResponse = await request(app.server)
			.put(`/organizations/${fixture.org.slug}/sales/${firstSaleId}`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send(
				buildCreatePayload(fixture, {
					totalAmount: 150_000,
				}),
			);
		expect(firstSaleUpdateResponse.statusCode).toBe(204);

		const firstHistory = await getSaleHistoryEvents(fixture, firstSaleId);
		const secondHistory = await getSaleHistoryEvents(fixture, secondSaleId);

		expect(firstHistory).toHaveLength(2);
		expect(secondHistory).toHaveLength(1);
		expect(secondHistory[0]?.action).toBe("CREATED");
	});

	it("should update sale via put without changing status", async () => {
		const fixture = await createFixture();
		const saleId = await createSaleUsingApi(fixture);

		const updateResponse = await request(app.server)
			.put(`/organizations/${fixture.org.slug}/sales/${saleId}`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send(
				buildCreatePayload(fixture, {
					totalAmount: 500_000,
					notes: "Venda atualizada",
					responsible: {
						type: "PARTNER",
						id: fixture.partner.id,
					},
				}),
			);

		expect(updateResponse.statusCode).toBe(204);

		const sale = await prisma.sale.findUnique({
			where: {
				id: saleId,
			},
		});

		expect(sale?.totalAmount).toBe(500_000);
		expect(sale?.notes).toBe("Venda atualizada");
		expect(sale?.responsibleType).toBe("PARTNER");
		expect(sale?.status).toBe(SaleStatus.PENDING);
	});

	it("should require dynamic fields and replace snapshot when product changes on update", async () => {
		const fixture = await createFixture();
		const originalDynamicFields = await createProductDynamicFields(
			fixture.product.id,
		);

		const saleId = await createSaleUsingApi(
			fixture,
			buildCreatePayload(fixture, {
				dynamicFields: {
					[originalDynamicFields.groupField.id]: "Grupo Norte",
					[originalDynamicFields.amountField.id]: 220_000,
					[originalDynamicFields.stageField.id]:
						originalDynamicFields.stageOptions[0]?.id,
					[originalDynamicFields.channelsField.id]: [],
				},
			}),
		);

		const replacementProduct = await prisma.product.create({
			data: {
				organizationId: fixture.org.id,
				name: `Produto Novo ${Date.now()}`,
				description: "Produto para troca",
				isActive: true,
			},
		});
		const replacementDynamicFields = await createProductDynamicFields(
			replacementProduct.id,
		);

		const missingDynamicFieldsResponse = await request(app.server)
			.put(`/organizations/${fixture.org.slug}/sales/${saleId}`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send(
				buildCreatePayload(fixture, {
					productId: replacementProduct.id,
					dynamicFields: undefined,
				}),
			);

		expect(missingDynamicFieldsResponse.statusCode).toBe(400);
		expect(missingDynamicFieldsResponse.body.message).toBe(
			"Dynamic fields are required when changing product",
		);

		const updateResponse = await request(app.server)
			.put(`/organizations/${fixture.org.slug}/sales/${saleId}`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send(
				buildCreatePayload(fixture, {
					productId: replacementProduct.id,
					dynamicFields: {
						[replacementDynamicFields.groupField.id]: "Grupo Refeito",
						[replacementDynamicFields.amountField.id]: 310_000,
						[replacementDynamicFields.stageField.id]:
							replacementDynamicFields.stageOptions[1]?.id,
						[replacementDynamicFields.channelsField.id]: [
							replacementDynamicFields.channelsOptions[0]?.id,
						],
					},
				}),
			);

		expect(updateResponse.statusCode).toBe(204);

		const updatedSale = await prisma.sale.findUnique({
			where: {
				id: saleId,
			},
			select: {
				productId: true,
				dynamicFieldSchema: true,
				dynamicFieldValues: true,
			},
		});

		expect(updatedSale?.productId).toBe(replacementProduct.id);

		const dynamicFieldSchema = updatedSale?.dynamicFieldSchema as Array<{
			fieldId: string;
		}>;
		const dynamicFieldValues = updatedSale?.dynamicFieldValues as Record<
			string,
			unknown
		>;

		expect(
			dynamicFieldSchema.some(
				(field) => field.fieldId === replacementDynamicFields.groupField.id,
			),
		).toBe(true);
		expect(
			dynamicFieldSchema.some(
				(field) => field.fieldId === originalDynamicFields.groupField.id,
			),
		).toBe(false);
		expect(dynamicFieldValues[replacementDynamicFields.groupField.id]).toBe(
			"Grupo Refeito",
		);
	});

	it("should replace sale commissions on update when commissions is provided", async () => {
		const fixture = await createFixture();
		const saleId = await createSaleUsingApi(
			fixture,
			buildCreatePayload(fixture, {
				commissions: buildCommissionsPayload(fixture),
			}),
		);

		const updateResponse = await request(app.server)
			.put(`/organizations/${fixture.org.slug}/sales/${saleId}`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send(
				buildCreatePayload(fixture, {
					commissions: [
						{
							sourceType: "MANUAL",
							recipientType: "COMPANY",
							beneficiaryId: fixture.company.id,
							startDate: "2026-03-10",
							totalPercentage: 1.5,
							installments: [
								{
									installmentNumber: 1,
									percentage: 0.5,
								},
								{
									installmentNumber: 2,
									percentage: 1,
								},
							],
						},
					],
				}),
			);

		expect(updateResponse.statusCode).toBe(204);

		const commissions = await prisma.saleCommission.findMany({
			where: {
				saleId,
			},
		});
		expect(commissions).toHaveLength(1);
		expect(commissions[0]?.sourceType).toBe("MANUAL");
		expect(commissions[0]?.recipientType).toBe("COMPANY");
		expect(commissions[0]?.direction).toBe("INCOME");
		expect(commissions[0]?.beneficiaryCompanyId).toBe(fixture.company.id);
		expect(commissions[0]?.totalPercentage).toBe(15_000);

		const installments = await prisma.saleCommissionInstallment.findMany({
			where: {
				saleCommissionId: commissions[0]?.id,
			},
			orderBy: {
				installmentNumber: "asc",
			},
			select: {
				amount: true,
				percentage: true,
			},
		});
		expect(installments.map((installment) => installment.percentage)).toEqual([
			5_000, 10_000,
		]);
		expect(installments.map((installment) => installment.amount)).toEqual([
			625, 1_250,
		]);
	});

	it("should replace sale commissions with link on update when commissions is provided", async () => {
		const fixture = await createFixture();
		const saleId = await createSaleUsingApi(
			fixture,
			buildCreatePayload(fixture, {
				commissions: buildCommissionsPayload(fixture),
			}),
		);

		const updateResponse = await request(app.server)
			.put(`/organizations/${fixture.org.slug}/sales/${saleId}`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send(
				buildCreatePayload(fixture, {
					commissions: buildLinkedCommissionsPayload(fixture),
				}),
			);

		expect(updateResponse.statusCode).toBe(204);

		const commissions = await prisma.saleCommission.findMany({
			where: {
				saleId,
			},
			orderBy: {
				sortOrder: "asc",
			},
			include: {
				installments: {
					orderBy: {
						installmentNumber: "asc",
					},
				},
			},
		});

		expect(commissions).toHaveLength(2);
		expect(commissions[0]?.calculationBase).toBe("SALE_TOTAL");
		expect(commissions[0]?.baseCommissionId).toBeNull();
		expect(commissions[1]?.calculationBase).toBe("COMMISSION");
		expect(commissions[1]?.baseCommissionId).toBe(commissions[0]?.id);
		expect(commissions[1]?.installments.map((item) => item.amount)).toEqual([
			75, 50,
		]);
	});

	it("should recalculate installment amounts on update without commissions", async () => {
		const fixture = await createFixture();
		const saleId = await createSaleUsingApi(
			fixture,
			buildCreatePayload(fixture, {
				totalAmount: 100_000,
				commissions: [
					{
						sourceType: "PULLED",
						recipientType: "SELLER",
						beneficiaryId: fixture.seller.id,
						startDate: "2026-03-10",
						totalPercentage: 1,
						installments: [
							{
								installmentNumber: 1,
								percentage: 0.25,
							},
							{
								installmentNumber: 2,
								percentage: 0.25,
							},
							{
								installmentNumber: 3,
								percentage: 0.25,
							},
							{
								installmentNumber: 4,
								percentage: 0.25,
							},
						],
					},
				],
			}),
		);

		const updateResponse = await request(app.server)
			.put(`/organizations/${fixture.org.slug}/sales/${saleId}`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send(
				buildCreatePayload(fixture, {
					totalAmount: 100_500,
				}),
			);

		expect(updateResponse.statusCode).toBe(204);

		const installments = await prisma.saleCommissionInstallment.findMany({
			where: {
				saleCommission: {
					saleId,
				},
			},
			orderBy: {
				installmentNumber: "asc",
			},
			select: {
				amount: true,
			},
		});

		expect(installments.map((installment) => installment.amount)).toEqual([
			251, 251, 251, 252,
		]);
	});

	it("should require applyValueChangeToCommissions on completed sale total amount change with commissions", async () => {
		const fixture = await createFixture();
		const saleId = await createSaleUsingApi(
			fixture,
			buildCreatePayload(fixture, {
				totalAmount: 100_000,
				commissions: [
					{
						sourceType: "PULLED",
						recipientType: "SELLER",
						beneficiaryId: fixture.seller.id,
						startDate: "2026-03-10",
						totalPercentage: 1,
						installments: [
							{
								installmentNumber: 1,
								percentage: 0.5,
							},
							{
								installmentNumber: 2,
								percentage: 0.5,
							},
						],
					},
				],
			}),
		);

		await patchSaleStatusUsingApi(fixture, saleId, "APPROVED");
		await patchSaleStatusUsingApi(fixture, saleId, "COMPLETED");

		const updateResponse = await request(app.server)
			.put(`/organizations/${fixture.org.slug}/sales/${saleId}`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send(
				buildCreatePayload(fixture, {
					totalAmount: 120_000,
				}),
			);

		expect(updateResponse.statusCode).toBe(400);
		expect(updateResponse.body.message).toBe(
			"applyValueChangeToCommissions is required when changing totalAmount on a COMPLETED sale with commissions",
		);
	});

	it("should update completed sale total amount without changing commissions when applyValueChangeToCommissions is false", async () => {
		const fixture = await createFixture();
		const saleId = await createSaleUsingApi(
			fixture,
			buildCreatePayload(fixture, {
				totalAmount: 100_000,
				commissions: [
					{
						sourceType: "PULLED",
						recipientType: "SELLER",
						beneficiaryId: fixture.seller.id,
						startDate: "2026-03-10",
						totalPercentage: 1,
						installments: [
							{
								installmentNumber: 1,
								percentage: 0.25,
							},
							{
								installmentNumber: 2,
								percentage: 0.25,
							},
							{
								installmentNumber: 3,
								percentage: 0.25,
							},
							{
								installmentNumber: 4,
								percentage: 0.25,
							},
						],
					},
				],
			}),
		);

		await patchSaleStatusUsingApi(fixture, saleId, "APPROVED");
		await patchSaleStatusUsingApi(fixture, saleId, "COMPLETED");

		const installmentsBefore = await prisma.saleCommissionInstallment.findMany({
			where: {
				saleCommission: {
					saleId,
				},
			},
			orderBy: {
				installmentNumber: "asc",
			},
			select: {
				id: true,
				amount: true,
			},
		});

		const updatePayload = {
			...buildCreatePayload(fixture, {
				totalAmount: 200_000,
			}),
			applyValueChangeToCommissions: false,
		};
		const updateResponse = await request(app.server)
			.put(`/organizations/${fixture.org.slug}/sales/${saleId}`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send(updatePayload);

		expect(updateResponse.statusCode).toBe(204);

		const sale = await prisma.sale.findUnique({
			where: {
				id: saleId,
			},
			select: {
				totalAmount: true,
			},
		});
		expect(sale?.totalAmount).toBe(200_000);

		const installmentsAfter = await prisma.saleCommissionInstallment.findMany({
			where: {
				saleCommission: {
					saleId,
				},
			},
			orderBy: {
				installmentNumber: "asc",
			},
			select: {
				id: true,
				amount: true,
			},
		});

		expect(installmentsAfter).toEqual(installmentsBefore);
	});

	it(
		"should create reversal movements for paid installments when reducing completed sale amount with reversePaidInstallmentsOnReduction",
		async () => {
			const fixture = await createFixture();
			const saleId = await createSaleUsingApi(
				fixture,
				buildCreatePayload(fixture, {
					totalAmount: 100_000,
					commissions: [
						{
							sourceType: "PULLED",
							recipientType: "SELLER",
							beneficiaryId: fixture.seller.id,
							startDate: "2026-03-10",
							totalPercentage: 1,
							installments: [
								{
									installmentNumber: 1,
									percentage: 0.25,
								},
								{
									installmentNumber: 2,
									percentage: 0.25,
								},
								{
									installmentNumber: 3,
									percentage: 0.25,
								},
								{
									installmentNumber: 4,
									percentage: 0.25,
								},
							],
						},
					],
				}),
			);

			await patchSaleStatusUsingApi(fixture, saleId, "APPROVED");
			await patchSaleStatusUsingApi(fixture, saleId, "COMPLETED");

			const installmentsBefore = await prisma.saleCommissionInstallment.findMany({
				where: {
					saleCommission: {
						saleId,
						recipientType: "SELLER",
					},
					originInstallmentId: null,
				},
				orderBy: {
					installmentNumber: "asc",
				},
				select: {
					id: true,
					installmentNumber: true,
				},
			});

			const firstInstallmentId = installmentsBefore[0]?.id;
			const secondInstallmentId = installmentsBefore[1]?.id;
			expect(firstInstallmentId).toBeDefined();
			expect(secondInstallmentId).toBeDefined();

			const firstPaidResponse = await request(app.server)
				.patch(
					`/organizations/${fixture.org.slug}/sales/${saleId}/commission-installments/${firstInstallmentId}/status`,
				)
				.set("Authorization", `Bearer ${fixture.token}`)
				.send({
					status: "PAID",
					paymentDate: "2026-03-20",
				});
			expect(firstPaidResponse.statusCode).toBe(204);

			const secondPaidResponse = await request(app.server)
				.patch(
					`/organizations/${fixture.org.slug}/sales/${saleId}/commission-installments/${secondInstallmentId}/status`,
				)
				.set("Authorization", `Bearer ${fixture.token}`)
				.send({
					status: "PAID",
					paymentDate: "2026-03-21",
				});
			expect(secondPaidResponse.statusCode).toBe(204);

			const updateResponse = await request(app.server)
				.put(`/organizations/${fixture.org.slug}/sales/${saleId}`)
				.set("Authorization", `Bearer ${fixture.token}`)
				.send({
					...buildCreatePayload(fixture, {
						totalAmount: 50_000,
					}),
					applyValueChangeToCommissions: true,
					reversePaidInstallmentsOnReduction: true,
					paidInstallmentsReversalDate: "2026-04-02",
				});
			expect(updateResponse.statusCode).toBe(204);

			const baseInstallmentsAfter = await prisma.saleCommissionInstallment.findMany({
				where: {
					saleCommission: {
						saleId,
						recipientType: "SELLER",
					},
					originInstallmentId: null,
				},
				orderBy: {
					installmentNumber: "asc",
				},
				select: {
					id: true,
					installmentNumber: true,
					status: true,
					amount: true,
				},
			});
			const reversalMovements = await prisma.saleCommissionInstallment.findMany({
				where: {
					originInstallmentId: {
						in: [firstInstallmentId, secondInstallmentId].filter(
							(value): value is string => Boolean(value),
						),
					},
					status: "REVERSED",
				},
				orderBy: [
					{
						originInstallmentId: "asc",
					},
					{
						createdAt: "asc",
					},
				],
				select: {
					originInstallmentId: true,
					amount: true,
					paymentDate: true,
				},
			});

			expect(baseInstallmentsAfter.map((installment) => installment.status)).toEqual(
				["PAID", "PAID", "PENDING", "PENDING"],
			);
			expect(baseInstallmentsAfter.map((installment) => installment.amount)).toEqual(
				[250, 250, 125, 125],
			);
			expect(reversalMovements).toHaveLength(2);
			expect(reversalMovements.map((movement) => movement.amount)).toEqual([
				-125, -125,
			]);
			expect(
				reversalMovements.every(
					(movement) =>
						movement.paymentDate?.toISOString().slice(0, 10) === "2026-04-02",
				),
			).toBe(true);

			const history = await getSaleHistoryEvents(fixture, saleId);
			const updateEvent = history[0];
			expect(updateEvent?.action).toBe("UPDATED");
			expect(
				updateEvent?.changes.some(
					(change) =>
						change.path === "sale.totalAmount" &&
						change.before === 100_000 &&
						change.after === 50_000,
				),
			).toBe(true);
			expect(
				updateEvent?.changes.some(
					(change) =>
						change.path === "sale.pendingCommissionInstallmentsUpdatedCount" &&
						change.after === 2,
				),
			).toBe(true);
			expect(
				updateEvent?.changes.some(
					(change) =>
						change.path === "sale.paidCommissionInstallmentsReversedCount" &&
						change.after === 2,
				),
			).toBe(true);
			expect(
				updateEvent?.changes.some((change) =>
					/^commissions\[\d+\]\.installments\[\d+\]\./.test(change.path),
				),
			).toBe(false);
		},
		15_000,
	);

	it("should use today as reversal date when reducing completed sale amount with reversePaidInstallmentsOnReduction and no date", async () => {
		const fixture = await createFixture();
		const saleId = await createSaleUsingApi(
			fixture,
			buildCreatePayload(fixture, {
				totalAmount: 100_000,
				commissions: [
					{
						sourceType: "PULLED",
						recipientType: "SELLER",
						beneficiaryId: fixture.seller.id,
						startDate: "2026-03-10",
						totalPercentage: 1,
						installments: [
							{
								installmentNumber: 1,
								percentage: 0.5,
							},
							{
								installmentNumber: 2,
								percentage: 0.5,
							},
						],
					},
				],
			}),
		);

		await patchSaleStatusUsingApi(fixture, saleId, "APPROVED");
		await patchSaleStatusUsingApi(fixture, saleId, "COMPLETED");

		const baseInstallments = await prisma.saleCommissionInstallment.findMany({
			where: {
				saleCommission: {
					saleId,
					recipientType: "SELLER",
				},
				originInstallmentId: null,
			},
			orderBy: {
				installmentNumber: "asc",
			},
			select: {
				id: true,
			},
		});
		const paidInstallmentId = baseInstallments[0]?.id;
		expect(paidInstallmentId).toBeDefined();

		const markPaidResponse = await request(app.server)
			.patch(
				`/organizations/${fixture.org.slug}/sales/${saleId}/commission-installments/${paidInstallmentId}/status`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				status: "PAID",
				paymentDate: "2026-03-20",
			});
		expect(markPaidResponse.statusCode).toBe(204);

		const updateResponse = await request(app.server)
			.put(`/organizations/${fixture.org.slug}/sales/${saleId}`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				...buildCreatePayload(fixture, {
					totalAmount: 50_000,
				}),
				applyValueChangeToCommissions: true,
				reversePaidInstallmentsOnReduction: true,
			});
		expect(updateResponse.statusCode).toBe(204);

		const createdReversal = await prisma.saleCommissionInstallment.findFirst({
			where: {
				originInstallmentId: paidInstallmentId,
				status: "REVERSED",
			},
			orderBy: {
				createdAt: "desc",
			},
			select: {
				amount: true,
				paymentDate: true,
			},
		});

		expect(createdReversal?.amount).toBe(-250);
		expect(createdReversal?.paymentDate?.toISOString().slice(0, 10)).toBe(
			new Date().toISOString().slice(0, 10),
		);
	});

	it(
		"should create only reversal delta for paid installments when existing reversal movements already exist",
		async () => {
		const fixture = await createFixture();
		const saleId = await createSaleUsingApi(
			fixture,
			buildCreatePayload(fixture, {
				totalAmount: 100_000,
				commissions: [
					{
						sourceType: "PULLED",
						recipientType: "SELLER",
						beneficiaryId: fixture.seller.id,
						startDate: "2026-03-10",
						totalPercentage: 1,
						installments: [
							{
								installmentNumber: 1,
								percentage: 0.25,
							},
							{
								installmentNumber: 2,
								percentage: 0.25,
							},
							{
								installmentNumber: 3,
								percentage: 0.25,
							},
							{
								installmentNumber: 4,
								percentage: 0.25,
							},
						],
					},
				],
			}),
		);

		await patchSaleStatusUsingApi(fixture, saleId, "APPROVED");
		await patchSaleStatusUsingApi(fixture, saleId, "COMPLETED");

		const baseInstallments = await prisma.saleCommissionInstallment.findMany({
			where: {
				saleCommission: {
					saleId,
					recipientType: "SELLER",
				},
				originInstallmentId: null,
			},
			orderBy: {
				installmentNumber: "asc",
			},
			select: {
				id: true,
				installmentNumber: true,
			},
		});
		const firstInstallmentId = baseInstallments[0]?.id;
		const secondInstallmentId = baseInstallments[1]?.id;
		expect(firstInstallmentId).toBeDefined();
		expect(secondInstallmentId).toBeDefined();

		for (const installmentId of [firstInstallmentId, secondInstallmentId]) {
			const markPaidResponse = await request(app.server)
				.patch(
					`/organizations/${fixture.org.slug}/sales/${saleId}/commission-installments/${installmentId}/status`,
				)
				.set("Authorization", `Bearer ${fixture.token}`)
				.send({
					status: "PAID",
					paymentDate: "2026-03-20",
				});
			expect(markPaidResponse.statusCode).toBe(204);
		}

		const firstReductionResponse = await request(app.server)
			.put(`/organizations/${fixture.org.slug}/sales/${saleId}`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				...buildCreatePayload(fixture, {
					totalAmount: 60_000,
				}),
				applyValueChangeToCommissions: true,
				reversePaidInstallmentsOnReduction: true,
				paidInstallmentsReversalDate: "2026-04-03",
			});
		expect(firstReductionResponse.statusCode).toBe(204);

		const secondReductionResponse = await request(app.server)
			.put(`/organizations/${fixture.org.slug}/sales/${saleId}`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				...buildCreatePayload(fixture, {
					totalAmount: 40_000,
				}),
				applyValueChangeToCommissions: true,
				reversePaidInstallmentsOnReduction: true,
				paidInstallmentsReversalDate: "2026-04-04",
			});
		expect(secondReductionResponse.statusCode).toBe(204);

		const reversalMovements = await prisma.saleCommissionInstallment.findMany({
			where: {
				originInstallmentId: {
					in: [firstInstallmentId, secondInstallmentId].filter(
						(value): value is string => Boolean(value),
					),
				},
				status: "REVERSED",
			},
			orderBy: {
				createdAt: "asc",
			},
			select: {
				originInstallmentId: true,
				amount: true,
			},
		});

		const reversalSummaryByOrigin = reversalMovements.reduce(
			(summary, movement) => {
				if (!movement.originInstallmentId) {
					return summary;
				}

				const current = summary.get(movement.originInstallmentId) ?? {
					count: 0,
					sumAmount: 0,
				};
				summary.set(movement.originInstallmentId, {
					count: current.count + 1,
					sumAmount: current.sumAmount + movement.amount,
				});

				return summary;
			},
			new Map<string, { count: number; sumAmount: number }>(),
		);

		expect(reversalSummaryByOrigin.get(firstInstallmentId ?? "")).toEqual({
			count: 2,
			sumAmount: -150,
		});
		expect(reversalSummaryByOrigin.get(secondInstallmentId ?? "")).toEqual({
			count: 2,
			sumAmount: -150,
		});
		},
		15_000,
	);

	it("should reject reversePaidInstallmentsOnReduction when applyValueChangeToCommissions is false", async () => {
		const fixture = await createFixture();
		const saleId = await createSaleUsingApi(
			fixture,
			buildCreatePayload(fixture, {
				totalAmount: 100_000,
				commissions: buildCommissionsPayload(fixture),
			}),
		);

		await patchSaleStatusUsingApi(fixture, saleId, "APPROVED");
		await patchSaleStatusUsingApi(fixture, saleId, "COMPLETED");

		const updateResponse = await request(app.server)
			.put(`/organizations/${fixture.org.slug}/sales/${saleId}`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				...buildCreatePayload(fixture, {
					totalAmount: 80_000,
				}),
				applyValueChangeToCommissions: false,
				reversePaidInstallmentsOnReduction: true,
			});

		expect(updateResponse.statusCode).toBe(400);
		expect(updateResponse.body.message).toBe(
			"reversePaidInstallmentsOnReduction can only be used when applyValueChangeToCommissions is true",
		);
	});

	it("should rebalance only pending installments on completed sale amount change when applyValueChangeToCommissions is true and keep summarized history", async () => {
		const fixture = await createFixture();
		const saleId = await createSaleUsingApi(
			fixture,
			buildCreatePayload(fixture, {
				totalAmount: 100_000,
				commissions: [
					{
						sourceType: "PULLED",
						recipientType: "SELLER",
						beneficiaryId: fixture.seller.id,
						startDate: "2026-03-10",
						totalPercentage: 1,
						installments: [
							{
								installmentNumber: 1,
								percentage: 0.25,
							},
							{
								installmentNumber: 2,
								percentage: 0.25,
							},
							{
								installmentNumber: 3,
								percentage: 0.25,
							},
							{
								installmentNumber: 4,
								percentage: 0.25,
							},
						],
					},
				],
			}),
		);

		await patchSaleStatusUsingApi(fixture, saleId, "APPROVED");
		await patchSaleStatusUsingApi(fixture, saleId, "COMPLETED");

		const installmentsBeforeStatusSetup =
			await prisma.saleCommissionInstallment.findMany({
				where: {
					saleCommission: {
						saleId,
					},
				},
				orderBy: {
					installmentNumber: "asc",
				},
				select: {
					id: true,
					installmentNumber: true,
				},
			});

		const installment1Id = installmentsBeforeStatusSetup[0]?.id;
		const installment2Id = installmentsBeforeStatusSetup[1]?.id;
		const installment3Id = installmentsBeforeStatusSetup[2]?.id;
		const installment4Id = installmentsBeforeStatusSetup[3]?.id;
		expect(installment1Id).toBeDefined();
		expect(installment2Id).toBeDefined();
		expect(installment3Id).toBeDefined();
		expect(installment4Id).toBeDefined();

		const markPaidResponse = await request(app.server)
			.patch(
				`/organizations/${fixture.org.slug}/sales/${saleId}/commission-installments/${installment1Id}/status`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				status: "PAID",
				paymentDate: "2026-03-21",
			});
		expect(markPaidResponse.statusCode).toBe(204);

		await prisma.saleCommissionInstallment.update({
			where: {
				id: installment2Id,
			},
			data: {
				status: "CANCELED",
				paymentDate: null,
				reversedFromStatus: null,
				reversedFromAmount: null,
				reversedFromPaymentDate: null,
			},
		});

		await prisma.saleCommissionInstallment.update({
			where: {
				id: installment3Id,
			},
			data: {
				status: "REVERSED",
				amount: -250,
				paymentDate: new Date("2026-03-23T00:00:00.000Z"),
			},
		});

		const installmentsBefore = await prisma.saleCommissionInstallment.findMany({
			where: {
				saleCommission: {
					saleId,
				},
			},
			orderBy: {
				installmentNumber: "asc",
			},
			select: {
				id: true,
				installmentNumber: true,
				status: true,
				amount: true,
			},
		});

		const updatePayload = {
			...buildCreatePayload(fixture, {
				totalAmount: 200_000,
			}),
			applyValueChangeToCommissions: true,
		};
		const updateResponse = await request(app.server)
			.put(`/organizations/${fixture.org.slug}/sales/${saleId}`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send(updatePayload);

		expect(updateResponse.statusCode).toBe(204);

		const installmentsAfter = await prisma.saleCommissionInstallment.findMany({
			where: {
				saleCommission: {
					saleId,
				},
			},
			orderBy: {
				installmentNumber: "asc",
			},
			select: {
				id: true,
				installmentNumber: true,
				status: true,
				amount: true,
			},
		});

		const installmentByNumberBefore = new Map(
			installmentsBefore.map((installment) => [
				installment.installmentNumber,
				installment,
			]),
		);
		const installmentByNumberAfter = new Map(
			installmentsAfter.map((installment) => [
				installment.installmentNumber,
				installment,
			]),
		);

		expect(installmentByNumberAfter.get(1)?.status).toBe("PAID");
		expect(installmentByNumberAfter.get(2)?.status).toBe("CANCELED");
		expect(installmentByNumberAfter.get(3)?.status).toBe("REVERSED");
		expect(installmentByNumberAfter.get(4)?.status).toBe("PENDING");

		expect(installmentByNumberAfter.get(1)?.amount).toBe(
			installmentByNumberBefore.get(1)?.amount,
		);
		expect(installmentByNumberAfter.get(2)?.amount).toBe(
			installmentByNumberBefore.get(2)?.amount,
		);
		expect(installmentByNumberAfter.get(3)?.amount).toBe(
			installmentByNumberBefore.get(3)?.amount,
		);
		expect(installmentByNumberAfter.get(4)?.amount).toBe(500);

		const history = await getSaleHistoryEvents(fixture, saleId);
		const updateEvent = history[0];
		expect(updateEvent?.action).toBe("UPDATED");

		expect(
			updateEvent?.changes.some(
				(change) =>
					change.path === "sale.totalAmount" &&
					change.before === 100_000 &&
					change.after === 200_000,
			),
		).toBe(true);
		expect(
			updateEvent?.changes.some(
				(change) =>
					change.path === "sale.pendingCommissionInstallmentsUpdatedCount" &&
					change.after === 1,
			),
		).toBe(true);
		expect(
			updateEvent?.changes.some((change) =>
				/^commissions\[\d+\]\.installments\[\d+\]\./.test(change.path),
			),
		).toBe(false);
	});

	it("should recalculate pending installments by percentage even when paid installments exceed the new commission target", async () => {
		const fixture = await createFixture();
		const saleId = await createSaleUsingApi(
			fixture,
			buildCreatePayload(fixture, {
				totalAmount: 100_000,
				commissions: [
					{
						sourceType: "PULLED",
						recipientType: "SELLER",
						beneficiaryId: fixture.seller.id,
						startDate: "2026-03-10",
						totalPercentage: 1,
						installments: [
							{
								installmentNumber: 1,
								percentage: 0.5,
							},
							{
								installmentNumber: 2,
								percentage: 0.5,
							},
						],
					},
				],
			}),
		);

		await patchSaleStatusUsingApi(fixture, saleId, "APPROVED");
		await patchSaleStatusUsingApi(fixture, saleId, "COMPLETED");

		const installmentsBefore = await prisma.saleCommissionInstallment.findMany({
			where: {
				saleCommission: {
					saleId,
				},
			},
			orderBy: {
				installmentNumber: "asc",
			},
			select: {
				id: true,
				installmentNumber: true,
				status: true,
				amount: true,
			},
		});

		const installment1Id = installmentsBefore[0]?.id;
		expect(installment1Id).toBeDefined();

		const markPaidResponse = await request(app.server)
			.patch(
				`/organizations/${fixture.org.slug}/sales/${saleId}/commission-installments/${installment1Id}/status`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				status: "PAID",
				paymentDate: "2026-03-21",
			});
		expect(markPaidResponse.statusCode).toBe(204);

		const updatePayload = {
			...buildCreatePayload(fixture, {
				totalAmount: 30_000,
			}),
			applyValueChangeToCommissions: true,
		};
		const updateResponse = await request(app.server)
			.put(`/organizations/${fixture.org.slug}/sales/${saleId}`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send(updatePayload);

		expect(updateResponse.statusCode).toBe(204);

		const installmentsAfter = await prisma.saleCommissionInstallment.findMany({
			where: {
				saleCommission: {
					saleId,
				},
			},
			orderBy: {
				installmentNumber: "asc",
			},
			select: {
				installmentNumber: true,
				status: true,
				amount: true,
			},
		});

		const installmentByNumberAfter = new Map(
			installmentsAfter.map((installment) => [
				installment.installmentNumber,
				installment,
			]),
		);

		expect(installmentByNumberAfter.get(1)?.status).toBe("PAID");
		expect(installmentByNumberAfter.get(1)?.amount).toBe(500);
		expect(installmentByNumberAfter.get(2)?.status).toBe("PENDING");
		expect(installmentByNumberAfter.get(2)?.amount).toBe(150);
	});

	it("should block commissions update when sale is not pending", async () => {
		const fixture = await createFixture();
		const saleId = await createSaleUsingApi(
			fixture,
			buildCreatePayload(fixture, {
				commissions: buildCommissionsPayload(fixture),
			}),
		);

		const approveResponse = await request(app.server)
			.patch(`/organizations/${fixture.org.slug}/sales/${saleId}/status`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				status: "APPROVED",
			});

		expect(approveResponse.statusCode).toBe(204);

		const updateResponse = await request(app.server)
			.put(`/organizations/${fixture.org.slug}/sales/${saleId}`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send(
				buildCreatePayload(fixture, {
					commissions: buildCommissionsPayload(fixture),
				}),
			);

		expect(updateResponse.statusCode).toBe(400);
		expect(updateResponse.body.message).toBe(
			"Cannot update commissions when sale status is not PENDING",
		);
	});

	it("should force commission installments as canceled when sale is canceled", async () => {
		const fixture = await createFixture();
		const saleId = await createSaleUsingApi(
			fixture,
			buildCreatePayload(fixture, {
				commissions: buildCommissionsPayload(fixture),
			}),
		);

		const cancelResponse = await request(app.server)
			.patch(`/organizations/${fixture.org.slug}/sales/${saleId}/status`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				status: "CANCELED",
			});

		expect(cancelResponse.statusCode).toBe(204);

		const installments = await prisma.saleCommissionInstallment.findMany({
			where: {
				saleCommission: {
					saleId,
				},
			},
			select: {
				status: true,
				amount: true,
				paymentDate: true,
			},
		});

		expect(installments.length).toBeGreaterThan(0);
		expect(
			installments.every((installment) => installment.status === "CANCELED"),
		).toBe(true);
		expect(
			installments.every((installment) => installment.paymentDate === null),
		).toBe(true);
		expect(installments.every((installment) => installment.amount === 0)).toBe(
			true,
		);

		const history = await getSaleHistoryEvents(fixture, saleId);
		const statusEvent = history.find(
			(event) => event.action === "STATUS_CHANGED",
		);

		expect(statusEvent).toBeDefined();
		expect(
			statusEvent?.changes.some(
				(change) =>
					change.path === "sale.status" &&
					change.before === "PENDING" &&
					change.after === "CANCELED",
			),
		).toBe(true);
		expect(
			statusEvent?.changes.some(
				(change) =>
					change.path.startsWith("commissions[") &&
					change.path.endsWith(".status") &&
					change.before === "PENDING" &&
					change.after === "CANCELED",
			),
		).toBe(true);
	});

	it("should list commission installments by sale", async () => {
		const fixture = await createFixture();
		const saleId = await createSaleUsingApi(
			fixture,
			buildCreatePayload(fixture, {
				commissions: buildCommissionsPayload(fixture),
			}),
		);

		const approveResponse = await request(app.server)
			.patch(`/organizations/${fixture.org.slug}/sales/${saleId}/status`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				status: "APPROVED",
			});

		expect(approveResponse.statusCode).toBe(204);

		const response = await request(app.server)
			.get(
				`/organizations/${fixture.org.slug}/sales/${saleId}/commission-installments`,
			)
			.set("Authorization", `Bearer ${fixture.token}`);

		expect(response.statusCode).toBe(200);
		expect(response.body.installments).toHaveLength(3);
		expect(response.body.installments[0].status).toBe("PENDING");
		expect(response.body.installments[0].beneficiaryId).toBe(fixture.seller.id);
		expect(response.body.installments[0].beneficiaryKey).toBe(
			`SELLER:${fixture.seller.id}`,
		);
		expect(response.body.installments[0].direction).toBe("OUTCOME");
		expect(response.body.installments[0].expectedPaymentDate).toContain(
			"2026-03-10",
		);
		expect(response.body.installments[1].expectedPaymentDate).toContain(
			"2026-04-10",
		);
	});

	it("should support commission installments without expected payment date and keep nulls last in organization list", async () => {
		const fixture = await createFixture();
		const saleId = await createSaleUsingApi(
			fixture,
			buildCreatePayload(fixture, {
				commissions: buildAdvancedScheduleCommissionsPayload(fixture),
			}),
		);

		const approveResponse = await request(app.server)
			.patch(`/organizations/${fixture.org.slug}/sales/${saleId}/status`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				status: "APPROVED",
			});

		expect(approveResponse.statusCode).toBe(204);

		const completeResponse = await request(app.server)
			.patch(`/organizations/${fixture.org.slug}/sales/${saleId}/status`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				status: "COMPLETED",
			});

		expect(completeResponse.statusCode).toBe(204);

		const saleInstallmentsResponse = await request(app.server)
			.get(
				`/organizations/${fixture.org.slug}/sales/${saleId}/commission-installments`,
			)
			.set("Authorization", `Bearer ${fixture.token}`);

		expect(saleInstallmentsResponse.statusCode).toBe(200);
		expect(
			saleInstallmentsResponse.body.installments.map(
				(installment: { expectedPaymentDate: string | null }) =>
					installment.expectedPaymentDate
						? new Date(installment.expectedPaymentDate)
								.toISOString()
								.slice(0, 10)
						: null,
			),
		).toEqual(["2026-03-10", null, "2026-05-10"]);

		const organizationInstallmentsResponse = await request(app.server)
			.get(
				`/organizations/${fixture.org.slug}/commissions/installments?direction=OUTCOME&page=1&pageSize=20`,
			)
			.set("Authorization", `Bearer ${fixture.token}`);

		expect(organizationInstallmentsResponse.statusCode).toBe(200);
		expect(
			organizationInstallmentsResponse.body.items.map(
				(item: { expectedPaymentDate: string | null }) =>
					item.expectedPaymentDate
						? new Date(item.expectedPaymentDate).toISOString().slice(0, 10)
						: null,
			),
		).toEqual(["2026-03-10", "2026-05-10", null]);

		const filteredResponse = await request(app.server)
			.get(
				`/organizations/${fixture.org.slug}/commissions/installments?direction=OUTCOME&expectedFrom=2026-05-01&expectedTo=2026-05-31&page=1&pageSize=20`,
			)
			.set("Authorization", `Bearer ${fixture.token}`);

		expect(filteredResponse.statusCode).toBe(200);
		expect(filteredResponse.body.items).toHaveLength(1);
		expect(filteredResponse.body.items[0].expectedPaymentDate).toContain(
			"2026-05-10",
		);

		const undatedInstallment = saleInstallmentsResponse.body.installments[1] as {
			id: string;
		};

		const patchResponse = await request(app.server)
			.patch(
				`/organizations/${fixture.org.slug}/sales/${saleId}/commission-installments/${undatedInstallment.id}`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				expectedPaymentDate: "2026-04-10",
			});

		expect(patchResponse.statusCode).toBe(204);

		const patchedInstallment =
			await prisma.saleCommissionInstallment.findUniqueOrThrow({
				where: {
					id: undatedInstallment.id,
				},
				select: {
					expectedPaymentDate: true,
				},
			});

		expect(
			patchedInstallment.expectedPaymentDate?.toISOString().slice(0, 10),
		).toBe("2026-04-10");
	});

	it("should list organization commission installments with pagination and summary by direction", async () => {
		const fixture = await createFixture();
		const saleId = await createSaleUsingApi(
			fixture,
			buildCreatePayload(fixture, {
				commissions: buildMixedDirectionCommissionsPayload(fixture),
			}),
		);

		const approveResponse = await request(app.server)
			.patch(`/organizations/${fixture.org.slug}/sales/${saleId}/status`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				status: "APPROVED",
			});

		expect(approveResponse.statusCode).toBe(204);
		const completeResponse = await request(app.server)
			.patch(`/organizations/${fixture.org.slug}/sales/${saleId}/status`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				status: "COMPLETED",
			});

		expect(completeResponse.statusCode).toBe(204);

		const response = await request(app.server)
			.get(
				`/organizations/${fixture.org.slug}/commissions/installments?page=1&pageSize=2`,
			)
			.set("Authorization", `Bearer ${fixture.token}`);

		expect(response.statusCode).toBe(200);
		expect(response.body.items).toHaveLength(2);
		expect(response.body.pagination).toEqual({
			page: 1,
			pageSize: 2,
			total: 4,
			totalPages: 2,
		});
		expect(response.body.items[0].direction).toBe("OUTCOME");
		expect(response.body.items[0].saleId).toBe(saleId);
		expect(response.body.items[0].saleStatus).toBe("COMPLETED");
		expect(response.body.items[0].customer.id).toBe(fixture.customer.id);
		expect(response.body.items[0].product.id).toBe(fixture.product.id);
		expect(response.body.items[0].company.id).toBe(fixture.company.id);
		expect(response.body.summaryByDirection.OUTCOME).toEqual({
			total: {
				count: 3,
				amount: 2_500,
			},
			pending: {
				count: 3,
				amount: 2_500,
			},
			paid: {
				count: 0,
				amount: 0,
			},
			canceled: {
				count: 0,
				amount: 0,
			},
			reversed: {
				count: 0,
				amount: 0,
			},
		});
		expect(response.body.summaryByDirection.INCOME).toEqual({
			total: {
				count: 1,
				amount: 1_250,
			},
			pending: {
				count: 1,
				amount: 1_250,
			},
			paid: {
				count: 0,
				amount: 0,
			},
			canceled: {
				count: 0,
				amount: 0,
			},
			reversed: {
				count: 0,
				amount: 0,
			},
		});
	});

	it("should list organization commission installments ordered by status and expected date", async () => {
		const fixture = await createFixture();
		const saleId = await createSaleUsingApi(
			fixture,
			buildCreatePayload(fixture, {
				commissions: buildCommissionsPayload(fixture),
			}),
		);

		const approveResponse = await request(app.server)
			.patch(`/organizations/${fixture.org.slug}/sales/${saleId}/status`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				status: "APPROVED",
			});
		expect(approveResponse.statusCode).toBe(204);

		const completeResponse = await request(app.server)
			.patch(`/organizations/${fixture.org.slug}/sales/${saleId}/status`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				status: "COMPLETED",
			});
		expect(completeResponse.statusCode).toBe(204);

		const installmentsResponse = await request(app.server)
			.get(
				`/organizations/${fixture.org.slug}/sales/${saleId}/commission-installments`,
			)
			.set("Authorization", `Bearer ${fixture.token}`);
		expect(installmentsResponse.statusCode).toBe(200);

		const sellerInstallmentId = installmentsResponse.body.installments.find(
			(installment: { recipientType: string; installmentNumber: number }) =>
				installment.recipientType === "SELLER" &&
				installment.installmentNumber === 1,
		)?.id as string | undefined;

		expect(sellerInstallmentId).toBeTruthy();

		const paidResponse = await request(app.server)
			.patch(
				`/organizations/${fixture.org.slug}/sales/${saleId}/commission-installments/${sellerInstallmentId}/status`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				status: "PAID",
				paymentDate: "2026-03-18",
			});
		expect(paidResponse.statusCode).toBe(204);

		const response = await request(app.server)
			.get(
				`/organizations/${fixture.org.slug}/commissions/installments?direction=OUTCOME&page=1&pageSize=20`,
			)
			.set("Authorization", `Bearer ${fixture.token}`);

		expect(response.statusCode).toBe(200);
		expect(response.body.items).toHaveLength(3);
		expect(
			response.body.items.map((item: { status: string }) => item.status),
		).toEqual(["PENDING", "PENDING", "PAID"]);

		const pendingExpectedDates = response.body.items
			.filter((item: { status: string }) => item.status === "PENDING")
			.map((item: { expectedPaymentDate: string }) =>
				new Date(item.expectedPaymentDate).getTime(),
			);

		expect(pendingExpectedDates[0]).toBeLessThanOrEqual(
			pendingExpectedDates[1],
		);
	});

	it("should not list organization commission installments for approved sales", async () => {
		const fixture = await createFixture();
		const saleId = await createSaleUsingApi(
			fixture,
			buildCreatePayload(fixture, {
				commissions: buildMixedDirectionCommissionsPayload(fixture),
			}),
		);

		const approveResponse = await request(app.server)
			.patch(`/organizations/${fixture.org.slug}/sales/${saleId}/status`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				status: "APPROVED",
			});

		expect(approveResponse.statusCode).toBe(204);

		const response = await request(app.server)
			.get(`/organizations/${fixture.org.slug}/commissions/installments`)
			.set("Authorization", `Bearer ${fixture.token}`);

		expect(response.statusCode).toBe(200);
		expect(response.body.items).toHaveLength(0);
		expect(response.body.pagination.total).toBe(0);
		expect(response.body.summaryByDirection.OUTCOME.total).toEqual({
			count: 0,
			amount: 0,
		});
		expect(response.body.summaryByDirection.INCOME.total).toEqual({
			count: 0,
			amount: 0,
		});
	});

	it("should filter organization commission installments by product id", async () => {
		const fixture = await createFixture();
		const suffix = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`;

		const secondProduct = await prisma.product.create({
			data: {
				organizationId: fixture.org.id,
				name: `Product second ${suffix}`,
				description: "Second product for commission filters",
				isActive: true,
			},
		});

		const firstSaleId = await createSaleUsingApi(
			fixture,
			buildCreatePayload(fixture, {
				productId: fixture.product.id,
				commissions: buildCommissionsPayload(fixture),
			}),
		);

		await createSaleUsingApi(
			fixture,
			buildCreatePayload(fixture, {
				productId: secondProduct.id,
				commissions: buildCommissionsPayload(fixture),
			}),
		);

		const sales = await prisma.sale.findMany({
			where: {
				organizationId: fixture.org.id,
			},
			select: {
				id: true,
			},
		});

		for (const sale of sales) {
			const approveResponse = await request(app.server)
				.patch(`/organizations/${fixture.org.slug}/sales/${sale.id}/status`)
				.set("Authorization", `Bearer ${fixture.token}`)
				.send({
					status: "APPROVED",
				});

			expect(approveResponse.statusCode).toBe(204);
			const completeResponse = await request(app.server)
				.patch(`/organizations/${fixture.org.slug}/sales/${sale.id}/status`)
				.set("Authorization", `Bearer ${fixture.token}`)
				.send({
					status: "COMPLETED",
				});

			expect(completeResponse.statusCode).toBe(204);
		}

		const response = await request(app.server)
			.get(
				`/organizations/${fixture.org.slug}/commissions/installments?productId=${fixture.product.id}`,
			)
			.set("Authorization", `Bearer ${fixture.token}`);

		expect(response.statusCode).toBe(200);
		expect(response.body.pagination.total).toBe(3);
		expect(response.body.items).toHaveLength(3);
		expect(
			response.body.items.every(
				(item: { saleId: string; product: { id: string } }) =>
					item.saleId === firstSaleId && item.product.id === fixture.product.id,
			),
		).toBe(true);
		expect(response.body.summaryByDirection.OUTCOME.total).toEqual({
			count: 3,
			amount: 1_875,
		});
		expect(response.body.summaryByDirection.INCOME.total).toEqual({
			count: 0,
			amount: 0,
		});
	});

	it("should filter organization commission installments by direction, status, expected dates and search", async () => {
		const fixture = await createFixture();
		const saleId = await createSaleUsingApi(
			fixture,
			buildCreatePayload(fixture, {
				commissions: buildCommissionsPayload(fixture),
			}),
		);

		const approveResponse = await request(app.server)
			.patch(`/organizations/${fixture.org.slug}/sales/${saleId}/status`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				status: "APPROVED",
			});
		expect(approveResponse.statusCode).toBe(204);

		const completeResponse = await request(app.server)
			.patch(`/organizations/${fixture.org.slug}/sales/${saleId}/status`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				status: "COMPLETED",
			});
		expect(completeResponse.statusCode).toBe(204);

		const installmentsResponse = await request(app.server)
			.get(
				`/organizations/${fixture.org.slug}/sales/${saleId}/commission-installments`,
			)
			.set("Authorization", `Bearer ${fixture.token}`);

		const sellerInstallmentId = installmentsResponse.body.installments.find(
			(installment: { recipientType: string; installmentNumber: number }) =>
				installment.recipientType === "SELLER" &&
				installment.installmentNumber === 1,
		)?.id as string | undefined;

		expect(sellerInstallmentId).toBeTruthy();

		const paidResponse = await request(app.server)
			.patch(
				`/organizations/${fixture.org.slug}/sales/${saleId}/commission-installments/${sellerInstallmentId}/status`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				status: "PAID",
				paymentDate: "2026-03-18",
			});

		expect(paidResponse.statusCode).toBe(204);

		const response = await request(app.server)
			.get(
				`/organizations/${fixture.org.slug}/commissions/installments?direction=OUTCOME&status=PAID&expectedFrom=2026-03-01&expectedTo=2026-03-31&productId=${fixture.product.id}&q=${encodeURIComponent(
					fixture.customer.name.slice(0, 6),
				)}`,
			)
			.set("Authorization", `Bearer ${fixture.token}`);

		expect(response.statusCode).toBe(200);
		expect(response.body.items).toHaveLength(1);
		expect(response.body.items[0].direction).toBe("OUTCOME");
		expect(response.body.items[0].status).toBe("PAID");
		expect(response.body.items[0].saleId).toBe(saleId);
		expect(response.body.pagination).toEqual({
			page: 1,
			pageSize: 20,
			total: 1,
			totalPages: 1,
		});
		expect(response.body.summaryByDirection.OUTCOME.paid).toEqual({
			count: 1,
			amount: response.body.items[0].amount,
		});
		expect(response.body.summaryByDirection.INCOME.total).toEqual({
			count: 0,
			amount: 0,
		});
	});

	it("should fail when organization commission installments date range is invalid", async () => {
		const fixture = await createFixture();
		const response = await request(app.server)
			.get(
				`/organizations/${fixture.org.slug}/commissions/installments?expectedFrom=2026-04-10&expectedTo=2026-03-10`,
			)
			.set("Authorization", `Bearer ${fixture.token}`);

		expect(response.statusCode).toBe(400);
		expect(response.body.message).toBe(
			"expectedFrom must be less than or equal to expectedTo",
		);
	});

	it("should patch commission installment status to paid with explicit payment date", async () => {
		const fixture = await createFixture();
		const saleId = await createSaleUsingApi(
			fixture,
			buildCreatePayload(fixture, {
				commissions: buildCommissionsPayload(fixture),
			}),
		);

		await request(app.server)
			.patch(`/organizations/${fixture.org.slug}/sales/${saleId}/status`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				status: "APPROVED",
			});

		const installmentsResponse = await request(app.server)
			.get(
				`/organizations/${fixture.org.slug}/sales/${saleId}/commission-installments`,
			)
			.set("Authorization", `Bearer ${fixture.token}`);

		const installmentId = installmentsResponse.body.installments[0]
			?.id as string;
		expect(installmentId).toBeTruthy();

		const patchResponse = await request(app.server)
			.patch(
				`/organizations/${fixture.org.slug}/sales/${saleId}/commission-installments/${installmentId}/status`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				status: "PAID",
				paymentDate: "2026-03-21",
				amount: 777,
			});

		expect(patchResponse.statusCode).toBe(204);

		const installment = await prisma.saleCommissionInstallment.findUnique({
			where: {
				id: installmentId,
			},
			select: {
				status: true,
				paymentDate: true,
				amount: true,
			},
		});

		expect(installment?.status).toBe("PAID");
		expect(installment?.paymentDate?.toISOString().slice(0, 10)).toBe(
			"2026-03-21",
		);
		expect(installment?.amount).toBe(777);
	});

	it("should patch commission installment status to paid with current date when omitted", async () => {
		const fixture = await createFixture();
		const saleId = await createSaleUsingApi(
			fixture,
			buildCreatePayload(fixture, {
				commissions: buildCommissionsPayload(fixture),
			}),
		);

		await request(app.server)
			.patch(`/organizations/${fixture.org.slug}/sales/${saleId}/status`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				status: "APPROVED",
			});

		const installmentsResponse = await request(app.server)
			.get(
				`/organizations/${fixture.org.slug}/sales/${saleId}/commission-installments`,
			)
			.set("Authorization", `Bearer ${fixture.token}`);

		const installmentId = installmentsResponse.body.installments[0]
			?.id as string;

		const patchResponse = await request(app.server)
			.patch(
				`/organizations/${fixture.org.slug}/sales/${saleId}/commission-installments/${installmentId}/status`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				status: "PAID",
			});

		expect(patchResponse.statusCode).toBe(204);

		const installment = await prisma.saleCommissionInstallment.findUnique({
			where: {
				id: installmentId,
			},
			select: {
				status: true,
				paymentDate: true,
			},
		});

		expect(installment?.status).toBe("PAID");
		expect(installment?.paymentDate).not.toBeNull();
	});

	it(
		"should cancel target and pending remaining installments and create automatic reversal when rule exists",
		async () => {
		const fixture = await createFixture();
		await prisma.productCommissionReversalRule.create({
			data: {
				productId: fixture.product.id,
				installmentNumber: 2,
				percentage: 500_000,
			},
		});

		const saleId = await createSaleUsingApi(
			fixture,
			buildCreatePayload(fixture, {
				commissions: buildThreeInstallmentsSellerCommissionsPayload(fixture),
			}),
		);

		await request(app.server)
			.patch(`/organizations/${fixture.org.slug}/sales/${saleId}/status`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({ status: "APPROVED" });

		const sellerInstallments = await prisma.saleCommissionInstallment.findMany({
			where: {
				saleCommission: {
					saleId,
					recipientType: "SELLER",
				},
				originInstallmentId: null,
			},
			orderBy: {
				installmentNumber: "asc",
			},
			select: {
				id: true,
			},
		});

		await request(app.server)
			.patch(
				`/organizations/${fixture.org.slug}/sales/${saleId}/commission-installments/${sellerInstallments[0]?.id}/status`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				status: "PAID",
				amount: 600,
				paymentDate: "2026-03-20",
			});

		const cancelResponse = await request(app.server)
			.patch(
				`/organizations/${fixture.org.slug}/sales/${saleId}/commission-installments/${sellerInstallments[1]?.id}/status`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				status: "CANCELED",
				reversalDate: "2026-03-28",
			});

		expect(cancelResponse.statusCode).toBe(204);

		const secondInstallment = await prisma.saleCommissionInstallment.findUnique({
			where: {
				id: sellerInstallments[1]?.id,
			},
			select: {
				status: true,
				amount: true,
				paymentDate: true,
			},
		});
		const thirdInstallment = await prisma.saleCommissionInstallment.findUnique({
			where: {
				id: sellerInstallments[2]?.id,
			},
			select: {
				status: true,
				amount: true,
				paymentDate: true,
			},
		});
		const reversalMovement = await findLatestInstallmentReversalMovement(
			sellerInstallments[1]?.id ?? "",
		);

		expect(secondInstallment?.status).toBe("CANCELED");
		expect(secondInstallment?.amount).toBe(0);
		expect(secondInstallment?.paymentDate).toBeNull();
		expect(thirdInstallment?.status).toBe("CANCELED");
		expect(thirdInstallment?.amount).toBe(0);
		expect(thirdInstallment?.paymentDate).toBeNull();
		expect(reversalMovement?.status).toBe("REVERSED");
		expect(reversalMovement?.amount).toBe(-300);
		expect(reversalMovement?.paymentDate?.toISOString().slice(0, 10)).toBe(
			"2026-03-28",
		);
		},
		15_000,
	);

	it("should cancel target and pending remaining installments without reversal when no rule exists", async () => {
		const fixture = await createFixture();
		const saleId = await createSaleUsingApi(
			fixture,
			buildCreatePayload(fixture, {
				commissions: buildThreeInstallmentsSellerCommissionsPayload(fixture),
			}),
		);

		await request(app.server)
			.patch(`/organizations/${fixture.org.slug}/sales/${saleId}/status`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({ status: "APPROVED" });

		const sellerInstallments = await prisma.saleCommissionInstallment.findMany({
			where: {
				saleCommission: {
					saleId,
					recipientType: "SELLER",
				},
				originInstallmentId: null,
			},
			orderBy: {
				installmentNumber: "asc",
			},
			select: {
				id: true,
			},
		});

		const cancelResponse = await request(app.server)
			.patch(
				`/organizations/${fixture.org.slug}/sales/${saleId}/commission-installments/${sellerInstallments[1]?.id}/status`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				status: "CANCELED",
				reversalDate: "2026-03-28",
			});

		expect(cancelResponse.statusCode).toBe(204);

		const secondInstallment = await prisma.saleCommissionInstallment.findUnique({
			where: {
				id: sellerInstallments[1]?.id,
			},
			select: {
				status: true,
				amount: true,
			},
		});
		const thirdInstallment = await prisma.saleCommissionInstallment.findUnique({
			where: {
				id: sellerInstallments[2]?.id,
			},
			select: {
				status: true,
				amount: true,
			},
		});
		const reversalMovement = await findLatestInstallmentReversalMovement(
			sellerInstallments[1]?.id ?? "",
		);

		expect(secondInstallment?.status).toBe("CANCELED");
		expect(secondInstallment?.amount).toBe(0);
		expect(thirdInstallment?.status).toBe("CANCELED");
		expect(thirdInstallment?.amount).toBe(0);
		expect(reversalMovement).toBeNull();
	});

	it("should cancel target and pending remaining installments without reversal when automatic calculation is zero", async () => {
		const fixture = await createFixture();
		await prisma.productCommissionReversalRule.create({
			data: {
				productId: fixture.product.id,
				installmentNumber: 2,
				percentage: 700_000,
			},
		});
		const saleId = await createSaleUsingApi(
			fixture,
			buildCreatePayload(fixture, {
				commissions: buildThreeInstallmentsSellerCommissionsPayload(fixture),
			}),
		);

		await request(app.server)
			.patch(`/organizations/${fixture.org.slug}/sales/${saleId}/status`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({ status: "APPROVED" });

		const sellerInstallments = await prisma.saleCommissionInstallment.findMany({
			where: {
				saleCommission: {
					saleId,
					recipientType: "SELLER",
				},
				originInstallmentId: null,
			},
			orderBy: {
				installmentNumber: "asc",
			},
			select: {
				id: true,
			},
		});

		const cancelResponse = await request(app.server)
			.patch(
				`/organizations/${fixture.org.slug}/sales/${saleId}/commission-installments/${sellerInstallments[1]?.id}/status`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				status: "CANCELED",
				reversalDate: "2026-03-28",
			});

		expect(cancelResponse.statusCode).toBe(204);

		const secondInstallment = await prisma.saleCommissionInstallment.findUnique({
			where: {
				id: sellerInstallments[1]?.id,
			},
			select: {
				status: true,
				amount: true,
			},
		});
		const thirdInstallment = await prisma.saleCommissionInstallment.findUnique({
			where: {
				id: sellerInstallments[2]?.id,
			},
			select: {
				status: true,
				amount: true,
			},
		});
		const reversalMovement = await findLatestInstallmentReversalMovement(
			sellerInstallments[1]?.id ?? "",
		);

		expect(secondInstallment?.status).toBe("CANCELED");
		expect(secondInstallment?.amount).toBe(0);
		expect(thirdInstallment?.status).toBe("CANCELED");
		expect(thirdInstallment?.amount).toBe(0);
		expect(reversalMovement).toBeNull();
	});

	it("should apply cancellation cascade and automatic reversal through installment edit patch", async () => {
		const fixture = await createFixture();
		await prisma.productCommissionReversalRule.create({
			data: {
				productId: fixture.product.id,
				installmentNumber: 2,
				percentage: 500_000,
			},
		});
		const saleId = await createSaleUsingApi(
			fixture,
			buildCreatePayload(fixture, {
				commissions: buildThreeInstallmentsSellerCommissionsPayload(fixture),
			}),
		);

		await request(app.server)
			.patch(`/organizations/${fixture.org.slug}/sales/${saleId}/status`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({ status: "APPROVED" });

		const sellerInstallments = await prisma.saleCommissionInstallment.findMany({
			where: {
				saleCommission: {
					saleId,
					recipientType: "SELLER",
				},
				originInstallmentId: null,
			},
			orderBy: {
				installmentNumber: "asc",
			},
			select: {
				id: true,
			},
		});

		await request(app.server)
			.patch(
				`/organizations/${fixture.org.slug}/sales/${saleId}/commission-installments/${sellerInstallments[0]?.id}/status`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				status: "PAID",
				amount: 600,
				paymentDate: "2026-03-20",
			});

		const patchResponse = await request(app.server)
			.patch(
				`/organizations/${fixture.org.slug}/sales/${saleId}/commission-installments/${sellerInstallments[1]?.id}`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				status: "CANCELED",
				reversalDate: "2026-03-29",
			});

		expect(patchResponse.statusCode).toBe(204);

		const secondInstallment = await prisma.saleCommissionInstallment.findUnique({
			where: {
				id: sellerInstallments[1]?.id,
			},
			select: {
				status: true,
				amount: true,
			},
		});
		const thirdInstallment = await prisma.saleCommissionInstallment.findUnique({
			where: {
				id: sellerInstallments[2]?.id,
			},
			select: {
				status: true,
				amount: true,
			},
		});
		const reversalMovement = await findLatestInstallmentReversalMovement(
			sellerInstallments[1]?.id ?? "",
		);

		expect(secondInstallment?.status).toBe("CANCELED");
		expect(secondInstallment?.amount).toBe(0);
		expect(thirdInstallment?.status).toBe("CANCELED");
		expect(thirdInstallment?.amount).toBe(0);
		expect(reversalMovement?.status).toBe("REVERSED");
		expect(reversalMovement?.amount).toBe(-300);
		expect(reversalMovement?.paymentDate?.toISOString().slice(0, 10)).toBe(
			"2026-03-29",
		);
	});

	it("should undo reversal by restoring cancellation cascade snapshots", async () => {
		const fixture = await createFixture();
		await prisma.productCommissionReversalRule.create({
			data: {
				productId: fixture.product.id,
				installmentNumber: 2,
				percentage: 500_000,
			},
		});

		const saleId = await createSaleUsingApi(
			fixture,
			buildCreatePayload(fixture, {
				commissions: buildThreeInstallmentsSellerCommissionsPayload(fixture),
			}),
		);

		await request(app.server)
			.patch(`/organizations/${fixture.org.slug}/sales/${saleId}/status`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({ status: "APPROVED" });

		const sellerInstallments = await prisma.saleCommissionInstallment.findMany({
			where: {
				saleCommission: {
					saleId,
					recipientType: "SELLER",
				},
				originInstallmentId: null,
			},
			orderBy: {
				installmentNumber: "asc",
			},
			select: {
				id: true,
			},
		});

		const originalSecondInstallment =
			await prisma.saleCommissionInstallment.findUnique({
				where: {
					id: sellerInstallments[1]?.id,
				},
				select: {
					status: true,
					amount: true,
					paymentDate: true,
				},
			});
		const originalThirdInstallment =
			await prisma.saleCommissionInstallment.findUnique({
				where: {
					id: sellerInstallments[2]?.id,
				},
				select: {
					status: true,
					amount: true,
					paymentDate: true,
				},
			});

		await request(app.server)
			.patch(
				`/organizations/${fixture.org.slug}/sales/${saleId}/commission-installments/${sellerInstallments[0]?.id}/status`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				status: "PAID",
				amount: 600,
				paymentDate: "2026-03-20",
			});

		const cancelResponse = await request(app.server)
			.patch(
				`/organizations/${fixture.org.slug}/sales/${saleId}/commission-installments/${sellerInstallments[1]?.id}/status`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				status: "CANCELED",
				reversalDate: "2026-03-28",
			});
		expect(cancelResponse.statusCode).toBe(204);

		const reversalMovement = await findLatestInstallmentReversalMovement(
			sellerInstallments[1]?.id ?? "",
		);
		expect(reversalMovement).not.toBeNull();
		if (!reversalMovement) {
			throw new Error("Expected reversal movement to be created");
		}

		const canceledSecondInstallment =
			await prisma.saleCommissionInstallment.findUnique({
				where: {
					id: sellerInstallments[1]?.id,
				},
				select: {
					status: true,
					amount: true,
					reversedFromStatus: true,
					reversedFromAmount: true,
					reversedFromPaymentDate: true,
				},
			});
		const canceledThirdInstallment =
			await prisma.saleCommissionInstallment.findUnique({
				where: {
					id: sellerInstallments[2]?.id,
				},
				select: {
					status: true,
					amount: true,
					reversedFromStatus: true,
					reversedFromAmount: true,
					reversedFromPaymentDate: true,
				},
			});

		expect(canceledSecondInstallment?.status).toBe("CANCELED");
		expect(canceledSecondInstallment?.amount).toBe(0);
		expect(canceledSecondInstallment?.reversedFromStatus).toBe("PENDING");
		expect(canceledSecondInstallment?.reversedFromAmount).toBe(
			originalSecondInstallment?.amount,
		);
		expect(canceledSecondInstallment?.reversedFromPaymentDate).toBeNull();
		expect(canceledThirdInstallment?.status).toBe("CANCELED");
		expect(canceledThirdInstallment?.amount).toBe(0);
		expect(canceledThirdInstallment?.reversedFromStatus).toBe("PENDING");
		expect(canceledThirdInstallment?.reversedFromAmount).toBe(
			originalThirdInstallment?.amount,
		);
		expect(canceledThirdInstallment?.reversedFromPaymentDate).toBeNull();

		const undoResponse = await request(app.server)
			.post(
				`/organizations/${fixture.org.slug}/sales/${saleId}/commission-installments/${reversalMovement.id}/reversal/undo`,
			)
			.set("Authorization", `Bearer ${fixture.token}`);

		expect(undoResponse.statusCode).toBe(204);

		const restoredSecondInstallment =
			await prisma.saleCommissionInstallment.findUnique({
				where: {
					id: sellerInstallments[1]?.id,
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
		const restoredThirdInstallment =
			await prisma.saleCommissionInstallment.findUnique({
				where: {
					id: sellerInstallments[2]?.id,
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
		const removedReversalMovement =
			await prisma.saleCommissionInstallment.findUnique({
				where: {
					id: reversalMovement.id,
				},
				select: {
					id: true,
				},
			});

		expect(restoredSecondInstallment?.status).toBe(
			originalSecondInstallment?.status,
		);
		expect(restoredSecondInstallment?.amount).toBe(
			originalSecondInstallment?.amount,
		);
		expect(restoredSecondInstallment?.paymentDate).toEqual(
			originalSecondInstallment?.paymentDate ?? null,
		);
		expect(restoredSecondInstallment?.reversedFromStatus).toBeNull();
		expect(restoredSecondInstallment?.reversedFromAmount).toBeNull();
		expect(restoredSecondInstallment?.reversedFromPaymentDate).toBeNull();

		expect(restoredThirdInstallment?.status).toBe(
			originalThirdInstallment?.status,
		);
		expect(restoredThirdInstallment?.amount).toBe(
			originalThirdInstallment?.amount,
		);
		expect(restoredThirdInstallment?.paymentDate).toEqual(
			originalThirdInstallment?.paymentDate ?? null,
		);
		expect(restoredThirdInstallment?.reversedFromStatus).toBeNull();
		expect(restoredThirdInstallment?.reversedFromAmount).toBeNull();
		expect(restoredThirdInstallment?.reversedFromPaymentDate).toBeNull();
		expect(removedReversalMovement).toBeNull();
	});

	it("should undo reversal and restore paid target installment amount and payment date", async () => {
		const fixture = await createFixture();
		await prisma.productCommissionReversalRule.create({
			data: {
				productId: fixture.product.id,
				installmentNumber: 2,
				percentage: 500_000,
			},
		});

		const saleId = await createSaleUsingApi(
			fixture,
			buildCreatePayload(fixture, {
				commissions: buildThreeInstallmentsSellerCommissionsPayload(fixture),
			}),
		);

		await request(app.server)
			.patch(`/organizations/${fixture.org.slug}/sales/${saleId}/status`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({ status: "APPROVED" });

		const sellerInstallments = await prisma.saleCommissionInstallment.findMany({
			where: {
				saleCommission: {
					saleId,
					recipientType: "SELLER",
				},
				originInstallmentId: null,
			},
			orderBy: {
				installmentNumber: "asc",
			},
			select: {
				id: true,
			},
		});

		await request(app.server)
			.patch(
				`/organizations/${fixture.org.slug}/sales/${saleId}/commission-installments/${sellerInstallments[0]?.id}/status`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				status: "PAID",
				amount: 600,
				paymentDate: "2026-03-20",
			});

		await request(app.server)
			.patch(
				`/organizations/${fixture.org.slug}/sales/${saleId}/commission-installments/${sellerInstallments[1]?.id}/status`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				status: "PAID",
				amount: 700,
				paymentDate: "2026-03-21",
			});

		const paidSecondInstallment = await prisma.saleCommissionInstallment.findUnique({
			where: {
				id: sellerInstallments[1]?.id,
			},
			select: {
				status: true,
				amount: true,
				paymentDate: true,
			},
		});

		const cancelResponse = await request(app.server)
			.patch(
				`/organizations/${fixture.org.slug}/sales/${saleId}/commission-installments/${sellerInstallments[1]?.id}/status`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				status: "CANCELED",
				reversalDate: "2026-03-28",
			});
		expect(cancelResponse.statusCode).toBe(204);

		const reversalMovement = await findLatestInstallmentReversalMovement(
			sellerInstallments[1]?.id ?? "",
		);
		expect(reversalMovement).not.toBeNull();
		if (!reversalMovement) {
			throw new Error("Expected reversal movement to be created");
		}

		const canceledSecondInstallment =
			await prisma.saleCommissionInstallment.findUnique({
				where: {
					id: sellerInstallments[1]?.id,
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

		expect(canceledSecondInstallment?.status).toBe("CANCELED");
		expect(canceledSecondInstallment?.amount).toBe(0);
		expect(canceledSecondInstallment?.paymentDate).toBeNull();
		expect(canceledSecondInstallment?.reversedFromStatus).toBe("PAID");
		expect(canceledSecondInstallment?.reversedFromAmount).toBe(700);
		expect(
			canceledSecondInstallment?.reversedFromPaymentDate
				?.toISOString()
				.slice(0, 10),
		).toBe("2026-03-21");

		const undoResponse = await request(app.server)
			.post(
				`/organizations/${fixture.org.slug}/sales/${saleId}/commission-installments/${reversalMovement.id}/reversal/undo`,
			)
			.set("Authorization", `Bearer ${fixture.token}`);
		expect(undoResponse.statusCode).toBe(204);

		const restoredSecondInstallment =
			await prisma.saleCommissionInstallment.findUnique({
				where: {
					id: sellerInstallments[1]?.id,
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
		const removedReversalMovement =
			await prisma.saleCommissionInstallment.findUnique({
				where: {
					id: reversalMovement.id,
				},
				select: {
					id: true,
				},
			});

		expect(restoredSecondInstallment?.status).toBe(
			paidSecondInstallment?.status,
		);
		expect(restoredSecondInstallment?.amount).toBe(
			paidSecondInstallment?.amount,
		);
		expect(
			restoredSecondInstallment?.paymentDate?.toISOString().slice(0, 10),
		).toBe(paidSecondInstallment?.paymentDate?.toISOString().slice(0, 10));
		expect(restoredSecondInstallment?.reversedFromStatus).toBeNull();
		expect(restoredSecondInstallment?.reversedFromAmount).toBeNull();
		expect(restoredSecondInstallment?.reversedFromPaymentDate).toBeNull();
		expect(removedReversalMovement).toBeNull();
	});

	it("should keep paid and reversed remaining rows untouched when canceling target installment", async () => {
		const fixture = await createFixture();
		const saleId = await createSaleUsingApi(
			fixture,
			buildCreatePayload(fixture, {
				commissions: buildThreeInstallmentsSellerCommissionsPayload(fixture),
			}),
		);

		await request(app.server)
			.patch(`/organizations/${fixture.org.slug}/sales/${saleId}/status`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({ status: "APPROVED" });

		const sellerInstallments = await prisma.saleCommissionInstallment.findMany({
			where: {
				saleCommission: {
					saleId,
					recipientType: "SELLER",
				},
				originInstallmentId: null,
			},
			orderBy: {
				installmentNumber: "asc",
			},
			select: {
				id: true,
			},
		});

		await request(app.server)
			.patch(
				`/organizations/${fixture.org.slug}/sales/${saleId}/commission-installments/${sellerInstallments[2]?.id}/status`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				status: "PAID",
				amount: 300,
				paymentDate: "2026-03-22",
			});

		const reverseThirdResponse = await request(app.server)
			.post(
				`/organizations/${fixture.org.slug}/sales/${saleId}/commission-installments/${sellerInstallments[2]?.id}/reversal`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				reversalDate: "2026-03-23",
				manualAmount: -100,
			});
		expect(reverseThirdResponse.statusCode).toBe(204);

		const cancelResponse = await request(app.server)
			.patch(
				`/organizations/${fixture.org.slug}/sales/${saleId}/commission-installments/${sellerInstallments[1]?.id}/status`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				status: "CANCELED",
				reversalDate: "2026-03-28",
			});
		expect(cancelResponse.statusCode).toBe(204);

		const thirdInstallment = await prisma.saleCommissionInstallment.findUnique({
			where: {
				id: sellerInstallments[2]?.id,
			},
			select: {
				status: true,
				amount: true,
			},
		});
		const thirdReversalMovement = await findLatestInstallmentReversalMovement(
			sellerInstallments[2]?.id ?? "",
		);

		expect(thirdInstallment?.status).toBe("PAID");
		expect(thirdInstallment?.amount).toBe(300);
		expect(thirdReversalMovement?.status).toBe("REVERSED");
		expect(thirdReversalMovement?.amount).toBe(-100);
	});

	it("should block installment status update when sale is pending", async () => {
		const fixture = await createFixture();
		const saleId = await createSaleUsingApi(
			fixture,
			buildCreatePayload(fixture, {
				commissions: buildCommissionsPayload(fixture),
			}),
		);

		const installments = await prisma.saleCommissionInstallment.findMany({
			where: {
				saleCommission: {
					saleId,
				},
			},
			select: {
				id: true,
			},
		});

		const response = await request(app.server)
			.patch(
				`/organizations/${fixture.org.slug}/sales/${saleId}/commission-installments/${installments[0]?.id}/status`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				status: "PAID",
			});

		expect(response.statusCode).toBe(400);
		expect(response.body.message).toBe(
			"Cannot update commission installments while sale is pending",
		);
	});

	it("should patch commission installment with full edit fields", async () => {
		const fixture = await createFixture();
		const saleId = await createSaleUsingApi(
			fixture,
			buildCreatePayload(fixture, {
				commissions: buildCommissionsPayload(fixture),
			}),
		);

		await request(app.server)
			.patch(`/organizations/${fixture.org.slug}/sales/${saleId}/status`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				status: "APPROVED",
			});

		const installmentsResponse = await request(app.server)
			.get(
				`/organizations/${fixture.org.slug}/sales/${saleId}/commission-installments`,
			)
			.set("Authorization", `Bearer ${fixture.token}`);
		const installment = installmentsResponse.body.installments[0] as {
			id: string;
			saleCommissionId: string;
		};

		const patchResponse = await request(app.server)
			.patch(
				`/organizations/${fixture.org.slug}/sales/${saleId}/commission-installments/${installment.id}`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				percentage: 0.65,
				amount: 820,
				status: "PAID",
				expectedPaymentDate: "2026-05-10",
				paymentDate: "2026-05-12",
			});

		expect(patchResponse.statusCode).toBe(204);

		const updatedInstallment =
			await prisma.saleCommissionInstallment.findUnique({
				where: {
					id: installment.id,
				},
				select: {
					percentage: true,
					amount: true,
					status: true,
					expectedPaymentDate: true,
					paymentDate: true,
				},
			});
		expect(updatedInstallment?.percentage).toBe(6_500);
		expect(updatedInstallment?.amount).toBe(820);
		expect(updatedInstallment?.status).toBe("PAID");
		expect(
			updatedInstallment?.expectedPaymentDate.toISOString().slice(0, 10),
		).toBe("2026-05-10");
		expect(updatedInstallment?.paymentDate?.toISOString().slice(0, 10)).toBe(
			"2026-05-12",
		);

		const updatedCommission = await prisma.saleCommission.findUnique({
			where: {
				id: installment.saleCommissionId,
			},
			select: {
				totalPercentage: true,
			},
		});
		expect(updatedCommission?.totalPercentage).toBe(11_500);
	});

	it("should patch commission installment clearing expected payment date to become no forecast", async () => {
		const fixture = await createFixture();
		const saleId = await createSaleUsingApi(
			fixture,
			buildCreatePayload(fixture, {
				commissions: buildCommissionsPayload(fixture),
			}),
		);

		await request(app.server)
			.patch(`/organizations/${fixture.org.slug}/sales/${saleId}/status`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				status: "APPROVED",
			});

		const installmentsResponse = await request(app.server)
			.get(
				`/organizations/${fixture.org.slug}/sales/${saleId}/commission-installments`,
			)
			.set("Authorization", `Bearer ${fixture.token}`);
		const installment = installmentsResponse.body.installments[0] as {
			id: string;
		};

		const patchResponse = await request(app.server)
			.patch(
				`/organizations/${fixture.org.slug}/sales/${saleId}/commission-installments/${installment.id}`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				expectedPaymentDate: null,
			});

		expect(patchResponse.statusCode).toBe(204);

		const updatedInstallment =
			await prisma.saleCommissionInstallment.findUniqueOrThrow({
				where: {
					id: installment.id,
				},
				select: {
					expectedPaymentDate: true,
				},
			});

		expect(updatedInstallment.expectedPaymentDate).toBeNull();
	});

	it("should clear payment date when installment status is updated to non-paid", async () => {
		const fixture = await createFixture();
		const saleId = await createSaleUsingApi(
			fixture,
			buildCreatePayload(fixture, {
				commissions: buildCommissionsPayload(fixture),
			}),
		);

		await request(app.server)
			.patch(`/organizations/${fixture.org.slug}/sales/${saleId}/status`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				status: "APPROVED",
			});

		const installmentsResponse = await request(app.server)
			.get(
				`/organizations/${fixture.org.slug}/sales/${saleId}/commission-installments`,
			)
			.set("Authorization", `Bearer ${fixture.token}`);
		const installmentId = installmentsResponse.body.installments[0]
			?.id as string;

		await request(app.server)
			.patch(
				`/organizations/${fixture.org.slug}/sales/${saleId}/commission-installments/${installmentId}/status`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				status: "PAID",
				paymentDate: "2026-03-22",
			});

		const patchResponse = await request(app.server)
			.patch(
				`/organizations/${fixture.org.slug}/sales/${saleId}/commission-installments/${installmentId}`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				status: "PENDING",
				paymentDate: "2026-03-30",
			});

		expect(patchResponse.statusCode).toBe(204);

		const installment = await prisma.saleCommissionInstallment.findUnique({
			where: {
				id: installmentId,
			},
			select: {
				status: true,
				paymentDate: true,
			},
		});

		expect(installment?.status).toBe("PENDING");
		expect(installment?.paymentDate).toBeNull();
	});

	it("should apply automatic reversal using product rule on pending installment", async () => {
		const fixture = await createFixture();
		await prisma.productCommissionReversalRule.create({
			data: {
				productId: fixture.product.id,
				installmentNumber: 2,
				percentage: 650_000,
			},
		});

		const saleId = await createSaleUsingApi(
			fixture,
			buildCreatePayload(fixture, {
				commissions: buildCommissionsPayload(fixture),
			}),
		);

		await request(app.server)
			.patch(`/organizations/${fixture.org.slug}/sales/${saleId}/status`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				status: "APPROVED",
			});

		const sellerInstallments = await prisma.saleCommissionInstallment.findMany({
			where: {
				saleCommission: {
					saleId,
					recipientType: "SELLER",
				},
			},
			orderBy: {
				installmentNumber: "asc",
			},
			select: {
				id: true,
			},
		});

		await request(app.server)
			.patch(
				`/organizations/${fixture.org.slug}/sales/${saleId}/commission-installments/${sellerInstallments[0]?.id}/status`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				status: "PAID",
				amount: 900,
				paymentDate: "2026-03-20",
			});

		const reverseResponse = await request(app.server)
			.post(
				`/organizations/${fixture.org.slug}/sales/${saleId}/commission-installments/${sellerInstallments[1]?.id}/reversal`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				reversalDate: "2026-03-25",
			});

		expect(reverseResponse.statusCode).toBe(204);

		const baseInstallment = await prisma.saleCommissionInstallment.findUnique({
			where: {
				id: sellerInstallments[1]?.id,
			},
			select: {
				status: true,
				paymentDate: true,
			},
		});
		const reversalMovement = await findLatestInstallmentReversalMovement(
			sellerInstallments[1]?.id ?? "",
		);

		expect(baseInstallment?.status).toBe("PENDING");
		expect(baseInstallment?.paymentDate).toBeNull();
		expect(reversalMovement?.status).toBe("REVERSED");
		expect(reversalMovement?.amount).toBe(-585);
		expect(reversalMovement?.paymentDate?.toISOString().slice(0, 10)).toBe(
			"2026-03-25",
		);
	});

	it("should apply automatic reversal using parent product rule when child has no local rules", async () => {
		const fixture = await createFixture();
		const suffix = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`;

		const parentProduct = await prisma.product.create({
			data: {
				organizationId: fixture.org.id,
				name: `Parent reversal product ${suffix}`,
				description: "Parent product for reversal rule inheritance",
			},
		});
		const childProduct = await prisma.product.create({
			data: {
				organizationId: fixture.org.id,
				parentId: parentProduct.id,
				name: `Child reversal product ${suffix}`,
				description: "Child product without local reversal rules",
			},
		});

		await prisma.productCommissionReversalRule.create({
			data: {
				productId: parentProduct.id,
				installmentNumber: 2,
				percentage: 650_000,
			},
		});

		const saleId = await createSaleUsingApi(
			fixture,
			buildCreatePayload(fixture, {
				productId: childProduct.id,
				commissions: buildCommissionsPayload(fixture),
			}),
		);

		await request(app.server)
			.patch(`/organizations/${fixture.org.slug}/sales/${saleId}/status`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				status: "APPROVED",
			});

		const sellerInstallments = await prisma.saleCommissionInstallment.findMany({
			where: {
				saleCommission: {
					saleId,
					recipientType: "SELLER",
				},
			},
			orderBy: {
				installmentNumber: "asc",
			},
			select: {
				id: true,
			},
		});

		await request(app.server)
			.patch(
				`/organizations/${fixture.org.slug}/sales/${saleId}/commission-installments/${sellerInstallments[0]?.id}/status`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				status: "PAID",
				amount: 900,
				paymentDate: "2026-03-20",
			});

		const reverseResponse = await request(app.server)
			.post(
				`/organizations/${fixture.org.slug}/sales/${saleId}/commission-installments/${sellerInstallments[1]?.id}/reversal`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				reversalDate: "2026-03-25",
			});

		expect(reverseResponse.statusCode).toBe(204);

		const baseInstallment = await prisma.saleCommissionInstallment.findUnique({
			where: {
				id: sellerInstallments[1]?.id,
			},
			select: {
				status: true,
				paymentDate: true,
			},
		});
		const reversalMovement = await findLatestInstallmentReversalMovement(
			sellerInstallments[1]?.id ?? "",
		);

		expect(baseInstallment?.status).toBe("PENDING");
		expect(baseInstallment?.paymentDate).toBeNull();
		expect(reversalMovement?.status).toBe("REVERSED");
		expect(reversalMovement?.amount).toBe(-585);
		expect(reversalMovement?.paymentDate?.toISOString().slice(0, 10)).toBe(
			"2026-03-25",
		);
	});

	it("should prioritize manual override when rule exists and require negative value", async () => {
		const fixture = await createFixture();
		await prisma.productCommissionReversalRule.create({
			data: {
				productId: fixture.product.id,
				installmentNumber: 2,
				percentage: 650_000,
			},
		});

		const saleId = await createSaleUsingApi(
			fixture,
			buildCreatePayload(fixture, {
				commissions: buildCommissionsPayload(fixture),
			}),
		);

		await request(app.server)
			.patch(`/organizations/${fixture.org.slug}/sales/${saleId}/status`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				status: "APPROVED",
			});

		const installment = await prisma.saleCommissionInstallment.findFirst({
			where: {
				saleCommission: {
					saleId,
					recipientType: "SELLER",
				},
				installmentNumber: 2,
			},
			select: {
				id: true,
			},
		});

		const invalidReverseResponse = await request(app.server)
			.post(
				`/organizations/${fixture.org.slug}/sales/${saleId}/commission-installments/${installment?.id}/reversal`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				reversalDate: "2026-03-25",
				manualAmount: 1234,
			});

		expect(invalidReverseResponse.statusCode).toBe(400);

		const reverseResponse = await request(app.server)
			.post(
				`/organizations/${fixture.org.slug}/sales/${saleId}/commission-installments/${installment?.id}/reversal`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				reversalDate: "2026-03-25",
				manualAmount: -500,
			});

		expect(reverseResponse.statusCode).toBe(204);

		const baseInstallment = await prisma.saleCommissionInstallment.findUnique({
			where: {
				id: installment?.id,
			},
			select: {
				status: true,
				paymentDate: true,
			},
		});
		const reversalMovement = await findLatestInstallmentReversalMovement(
			installment?.id ?? "",
		);

		expect(baseInstallment?.status).toBe("PENDING");
		expect(baseInstallment?.paymentDate).toBeNull();
		expect(reversalMovement?.status).toBe("REVERSED");
		expect(reversalMovement?.amount).toBe(-500);
		expect(reversalMovement?.paymentDate?.toISOString().slice(0, 10)).toBe(
			"2026-03-25",
		);
	});

	it("should require manual amount when no rule exists and require negative value", async () => {
		const fixture = await createFixture();
		const saleId = await createSaleUsingApi(
			fixture,
			buildCreatePayload(fixture, {
				commissions: buildCommissionsPayload(fixture),
			}),
		);

		await request(app.server)
			.patch(`/organizations/${fixture.org.slug}/sales/${saleId}/status`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				status: "APPROVED",
			});

		const installment = await prisma.saleCommissionInstallment.findFirst({
			where: {
				saleCommission: {
					saleId,
					recipientType: "SELLER",
				},
				installmentNumber: 1,
			},
			select: {
				id: true,
			},
		});

		const missingManualAmountResponse = await request(app.server)
			.post(
				`/organizations/${fixture.org.slug}/sales/${saleId}/commission-installments/${installment?.id}/reversal`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				reversalDate: "2026-03-25",
			});

		expect(missingManualAmountResponse.statusCode).toBe(400);

		const invalidManualAmountResponse = await request(app.server)
			.post(
				`/organizations/${fixture.org.slug}/sales/${saleId}/commission-installments/${installment?.id}/reversal`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				reversalDate: "2026-03-25",
				manualAmount: 0,
			});

		expect(invalidManualAmountResponse.statusCode).toBe(400);

		const invalidPositiveManualResponse = await request(app.server)
			.post(
				`/organizations/${fixture.org.slug}/sales/${saleId}/commission-installments/${installment?.id}/reversal`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				reversalDate: "2026-03-25",
				manualAmount: 777,
			});

		expect(invalidPositiveManualResponse.statusCode).toBe(400);

		const applyManualResponse = await request(app.server)
			.post(
				`/organizations/${fixture.org.slug}/sales/${saleId}/commission-installments/${installment?.id}/reversal`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				reversalDate: "2026-03-25",
				manualAmount: -500,
			});

		expect(applyManualResponse.statusCode).toBe(204);

		const baseInstallment = await prisma.saleCommissionInstallment.findUnique({
			where: {
				id: installment?.id,
			},
			select: {
				status: true,
				paymentDate: true,
			},
		});
		const reversalMovement = await findLatestInstallmentReversalMovement(
			installment?.id ?? "",
		);

		expect(baseInstallment?.status).toBe("PENDING");
		expect(baseInstallment?.paymentDate).toBeNull();
		expect(reversalMovement?.status).toBe("REVERSED");
		expect(reversalMovement?.amount).toBe(-500);
		expect(reversalMovement?.paymentDate?.toISOString().slice(0, 10)).toBe(
			"2026-03-25",
		);
	});

	it("should allow multiple linked reversals up to base amount and block excess", async () => {
		const fixture = await createFixture();
		const saleId = await createSaleUsingApi(
			fixture,
			buildCreatePayload(fixture, {
				commissions: buildCommissionsPayload(fixture),
			}),
		);

		await request(app.server)
			.patch(`/organizations/${fixture.org.slug}/sales/${saleId}/status`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				status: "APPROVED",
			});

		const installment = await prisma.saleCommissionInstallment.findFirst({
			where: {
				saleCommission: {
					saleId,
					recipientType: "SELLER",
				},
				installmentNumber: 1,
			},
			select: {
				id: true,
			},
		});

		await request(app.server)
			.patch(
				`/organizations/${fixture.org.slug}/sales/${saleId}/commission-installments/${installment?.id}/status`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				status: "PAID",
				amount: 10_000,
				paymentDate: "2026-03-20",
			});

		const firstReversalResponse = await request(app.server)
			.post(
				`/organizations/${fixture.org.slug}/sales/${saleId}/commission-installments/${installment?.id}/reversal`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				reversalDate: "2026-03-25",
				manualAmount: -4_000,
			});
		expect(firstReversalResponse.statusCode).toBe(204);

		const secondReversalResponse = await request(app.server)
			.post(
				`/organizations/${fixture.org.slug}/sales/${saleId}/commission-installments/${installment?.id}/reversal`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				reversalDate: "2026-03-26",
				manualAmount: -3_000,
			});
		expect(secondReversalResponse.statusCode).toBe(204);

		const thirdReversalResponse = await request(app.server)
			.post(
				`/organizations/${fixture.org.slug}/sales/${saleId}/commission-installments/${installment?.id}/reversal`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				reversalDate: "2026-03-27",
				manualAmount: -3_001,
			});
		expect(thirdReversalResponse.statusCode).toBe(400);
		expect(thirdReversalResponse.body.message).toContain(
			"exceeds the original installment amount",
		);

		const baseInstallment = await prisma.saleCommissionInstallment.findUnique({
			where: {
				id: installment?.id,
			},
			select: {
				status: true,
				amount: true,
			},
		});
		const reversalMovements = await prisma.saleCommissionInstallment.findMany({
			where: {
				originInstallmentId: installment?.id,
				status: "REVERSED",
			},
			orderBy: {
				createdAt: "asc",
			},
			select: {
				amount: true,
			},
		});

		expect(baseInstallment?.status).toBe("PAID");
		expect(baseInstallment?.amount).toBe(10_000);
		expect(reversalMovements).toHaveLength(2);
		expect(reversalMovements.map((row) => row.amount)).toEqual([
			-4_000, -3_000,
		]);
	});

	it("should block reversal over an already reversed movement", async () => {
		const fixture = await createFixture();
		const saleId = await createSaleUsingApi(
			fixture,
			buildCreatePayload(fixture, {
				commissions: buildCommissionsPayload(fixture),
			}),
		);

		await request(app.server)
			.patch(`/organizations/${fixture.org.slug}/sales/${saleId}/status`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				status: "APPROVED",
			});

		const installment = await prisma.saleCommissionInstallment.findFirst({
			where: {
				saleCommission: {
					saleId,
					recipientType: "SELLER",
				},
				installmentNumber: 1,
			},
			select: {
				id: true,
			},
		});

		const reverseResponse = await request(app.server)
			.post(
				`/organizations/${fixture.org.slug}/sales/${saleId}/commission-installments/${installment?.id}/reversal`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				reversalDate: "2026-03-25",
				manualAmount: -500,
			});
		expect(reverseResponse.statusCode).toBe(204);

		const reversalMovement = await findLatestInstallmentReversalMovement(
			installment?.id ?? "",
		);
		expect(reversalMovement).not.toBeNull();
		if (!reversalMovement) {
			throw new Error("Expected reversal movement to be created");
		}

		const nestedReversalResponse = await request(app.server)
			.post(
				`/organizations/${fixture.org.slug}/sales/${saleId}/commission-installments/${reversalMovement.id}/reversal`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				reversalDate: "2026-03-26",
				manualAmount: -100,
			});

		expect(nestedReversalResponse.statusCode).toBe(400);
		expect(nestedReversalResponse.body.message).toContain(
			"original installment",
		);
	});

		it("should allow reversal for paid installments", async () => {
			const fixture = await createFixture();
			await prisma.productCommissionReversalRule.create({
			data: {
				productId: fixture.product.id,
				installmentNumber: 1,
				percentage: 800_000,
			},
		});

		const saleId = await createSaleUsingApi(
			fixture,
			buildCreatePayload(fixture, {
				commissions: buildCommissionsPayload(fixture),
			}),
		);

		await request(app.server)
			.patch(`/organizations/${fixture.org.slug}/sales/${saleId}/status`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				status: "APPROVED",
			});

		const installment = await prisma.saleCommissionInstallment.findFirst({
			where: {
				saleCommission: {
					saleId,
					recipientType: "SELLER",
				},
				installmentNumber: 1,
			},
			select: {
				id: true,
			},
		});

		await request(app.server)
			.patch(
				`/organizations/${fixture.org.slug}/sales/${saleId}/commission-installments/${installment?.id}/status`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				status: "PAID",
				amount: 10_000,
				paymentDate: "2026-03-20",
			});

		const reverseResponse = await request(app.server)
			.post(
				`/organizations/${fixture.org.slug}/sales/${saleId}/commission-installments/${installment?.id}/reversal`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				reversalDate: "2026-03-26",
			});

		expect(reverseResponse.statusCode).toBe(204);

		const baseInstallment = await prisma.saleCommissionInstallment.findUnique({
			where: {
				id: installment?.id,
			},
			select: {
				status: true,
				amount: true,
			},
		});
		const reversalMovement = await findLatestInstallmentReversalMovement(
			installment?.id ?? "",
		);

			expect(baseInstallment?.status).toBe("PAID");
			expect(baseInstallment?.amount).toBe(10_000);
			expect(reversalMovement?.status).toBe("REVERSED");
			expect(reversalMovement?.amount).toBe(-8_000);
		});

			it("should apply full direct reversal on base installment when final reversal reaches total amount with no previous movements", async () => {
				const fixture = await createFixture();
				await prisma.productCommissionReversalRule.create({
					data: {
						productId: fixture.product.id,
					installmentNumber: 2,
					percentage: 800_000,
				},
			});

			const saleId = await createSaleUsingApi(
				fixture,
				buildCreatePayload(fixture, {
					commissions: buildCommissionsPayload(fixture),
				}),
			);

			await request(app.server)
				.patch(`/organizations/${fixture.org.slug}/sales/${saleId}/status`)
				.set("Authorization", `Bearer ${fixture.token}`)
				.send({
					status: "APPROVED",
				});

			const sellerInstallments = await prisma.saleCommissionInstallment.findMany({
				where: {
					saleCommission: {
						saleId,
						recipientType: "SELLER",
					},
					originInstallmentId: null,
				},
				orderBy: {
					installmentNumber: "asc",
				},
				select: {
					id: true,
				},
			});

			await request(app.server)
				.patch(
					`/organizations/${fixture.org.slug}/sales/${saleId}/commission-installments/${sellerInstallments[0]?.id}/status`,
				)
				.set("Authorization", `Bearer ${fixture.token}`)
				.send({
					status: "PAID",
					amount: 10_000,
					paymentDate: "2026-03-20",
				});

			await request(app.server)
				.patch(
					`/organizations/${fixture.org.slug}/sales/${saleId}/commission-installments/${sellerInstallments[1]?.id}/status`,
				)
				.set("Authorization", `Bearer ${fixture.token}`)
				.send({
					status: "PAID",
					amount: 10_000,
					paymentDate: "2026-03-21",
				});

				const reverseResponse = await request(app.server)
					.post(
						`/organizations/${fixture.org.slug}/sales/${saleId}/commission-installments/${sellerInstallments[1]?.id}/reversal`,
					)
				.set("Authorization", `Bearer ${fixture.token}`)
				.send({
					reversalDate: "2026-03-26",
				});

				expect(reverseResponse.statusCode).toBe(204);

				const baseInstallment = await prisma.saleCommissionInstallment.findUnique({
					where: {
						id: sellerInstallments[1]?.id,
					},
					select: {
						status: true,
						amount: true,
						paymentDate: true,
						reversedFromStatus: true,
						reversedFromAmount: true,
					},
				});
				const reversalMovement = await findLatestInstallmentReversalMovement(
					sellerInstallments[1]?.id ?? "",
				);

				expect(baseInstallment?.status).toBe("REVERSED");
				expect(baseInstallment?.amount).toBe(-10_000);
				expect(baseInstallment?.paymentDate?.toISOString().slice(0, 10)).toBe(
					"2026-03-26",
				);
				expect(baseInstallment?.reversedFromStatus).toBe("PAID");
				expect(baseInstallment?.reversedFromAmount).toBe(10_000);
				expect(reversalMovement).toBeNull();
			});

		it("should block reversal when there is a later paid installment", async () => {
			const fixture = await createFixture();
		const saleId = await createSaleUsingApi(
			fixture,
			buildCreatePayload(fixture, {
				commissions: buildCommissionsPayload(fixture),
			}),
		);

		await request(app.server)
			.patch(`/organizations/${fixture.org.slug}/sales/${saleId}/status`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				status: "APPROVED",
			});

		const sellerInstallments = await prisma.saleCommissionInstallment.findMany({
			where: {
				saleCommission: {
					saleId,
					recipientType: "SELLER",
				},
				originInstallmentId: null,
			},
			orderBy: {
				installmentNumber: "asc",
			},
			select: {
				id: true,
			},
		});

		await request(app.server)
			.patch(
				`/organizations/${fixture.org.slug}/sales/${saleId}/commission-installments/${sellerInstallments[0]?.id}/status`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				status: "PAID",
				amount: 5_000,
				paymentDate: "2026-03-20",
			});

		await request(app.server)
			.patch(
				`/organizations/${fixture.org.slug}/sales/${saleId}/commission-installments/${sellerInstallments[1]?.id}/status`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				status: "PAID",
				amount: 5_000,
				paymentDate: "2026-03-21",
			});

		const reverseResponse = await request(app.server)
			.post(
				`/organizations/${fixture.org.slug}/sales/${saleId}/commission-installments/${sellerInstallments[0]?.id}/reversal`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				reversalDate: "2026-03-26",
				manualAmount: -500,
			});

		expect(reverseResponse.statusCode).toBe(400);
		expect(reverseResponse.body.message).toBe(
			"Cannot reverse an installment when a later installment is already paid",
		);

		const reversalMovement = await findLatestInstallmentReversalMovement(
			sellerInstallments[0]?.id ?? "",
		);
		expect(reversalMovement).toBeNull();
	});

	it("should block reversal on pending installment when there is a later paid installment", async () => {
		const fixture = await createFixture();
		const saleId = await createSaleUsingApi(
			fixture,
			buildCreatePayload(fixture, {
				commissions: buildCommissionsPayload(fixture),
			}),
		);

		await request(app.server)
			.patch(`/organizations/${fixture.org.slug}/sales/${saleId}/status`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				status: "APPROVED",
			});

		const sellerInstallments = await prisma.saleCommissionInstallment.findMany({
			where: {
				saleCommission: {
					saleId,
					recipientType: "SELLER",
				},
				originInstallmentId: null,
			},
			orderBy: {
				installmentNumber: "asc",
			},
			select: {
				id: true,
			},
		});

		await request(app.server)
			.patch(
				`/organizations/${fixture.org.slug}/sales/${saleId}/commission-installments/${sellerInstallments[1]?.id}/status`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				status: "PAID",
				amount: 5_000,
				paymentDate: "2026-03-21",
			});

		const reverseResponse = await request(app.server)
			.post(
				`/organizations/${fixture.org.slug}/sales/${saleId}/commission-installments/${sellerInstallments[0]?.id}/reversal`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				reversalDate: "2026-03-26",
				manualAmount: -500,
			});

		expect(reverseResponse.statusCode).toBe(400);
		expect(reverseResponse.body.message).toBe(
			"Cannot reverse an installment when a later installment is already paid",
		);

		const reversalMovement = await findLatestInstallmentReversalMovement(
			sellerInstallments[0]?.id ?? "",
		);
		expect(reversalMovement).toBeNull();
	});

	it("should keep reversed installment status when sale is canceled", async () => {
		const fixture = await createFixture();
		const saleId = await createSaleUsingApi(
			fixture,
			buildCreatePayload(fixture, {
				commissions: buildCommissionsPayload(fixture),
			}),
		);

		await request(app.server)
			.patch(`/organizations/${fixture.org.slug}/sales/${saleId}/status`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				status: "APPROVED",
			});

		const installment = await prisma.saleCommissionInstallment.findFirst({
			where: {
				saleCommission: {
					saleId,
					recipientType: "SELLER",
				},
				installmentNumber: 1,
			},
			select: {
				id: true,
			},
		});

		await request(app.server)
			.post(
				`/organizations/${fixture.org.slug}/sales/${saleId}/commission-installments/${installment?.id}/reversal`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				reversalDate: "2026-03-26",
				manualAmount: -500,
			});

		await request(app.server)
			.patch(`/organizations/${fixture.org.slug}/sales/${saleId}/status`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				status: "CANCELED",
			});

		const reversalMovement = await findLatestInstallmentReversalMovement(
			installment?.id ?? "",
		);
		const baseInstallment = await prisma.saleCommissionInstallment.findUnique({
			where: {
				id: installment?.id,
			},
			select: {
				status: true,
				amount: true,
			},
		});

		expect(baseInstallment?.status).toBe("CANCELED");
		expect(baseInstallment?.amount).toBe(0);
		expect(reversalMovement?.status).toBe("REVERSED");
		expect(reversalMovement?.paymentDate).not.toBeNull();
	});

		it("should create reversal movement and remove only that movement on undo", async () => {
		const fixture = await createFixture();
		const saleId = await createSaleUsingApi(
			fixture,
			buildCreatePayload(fixture, {
				commissions: buildCommissionsPayload(fixture),
			}),
		);

		await request(app.server)
			.patch(`/organizations/${fixture.org.slug}/sales/${saleId}/status`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				status: "APPROVED",
			});

		const installment = await prisma.saleCommissionInstallment.findFirst({
			where: {
				saleCommission: {
					saleId,
					recipientType: "SELLER",
				},
				installmentNumber: 1,
			},
			select: {
				id: true,
			},
		});

		await request(app.server)
			.patch(
				`/organizations/${fixture.org.slug}/sales/${saleId}/commission-installments/${installment?.id}/status`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				status: "PAID",
				amount: 10_000,
				paymentDate: "2026-03-20",
			});

		const reverseResponse = await request(app.server)
			.post(
				`/organizations/${fixture.org.slug}/sales/${saleId}/commission-installments/${installment?.id}/reversal`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				reversalDate: "2026-03-26",
				manualAmount: -500,
			});

		expect(reverseResponse.statusCode).toBe(204);

		const baseInstallment = await prisma.saleCommissionInstallment.findUnique({
			where: {
				id: installment?.id,
			},
			select: {
				status: true,
				amount: true,
				paymentDate: true,
			},
		});
		const reversalMovement = await findLatestInstallmentReversalMovement(
			installment?.id ?? "",
		);
		const futurePendingInstallmentAfterReverse =
			await prisma.saleCommissionInstallment.findFirst({
				where: {
					saleCommission: {
						saleId,
						recipientType: "SELLER",
					},
					originInstallmentId: null,
					installmentNumber: 2,
				},
				select: {
					status: true,
					reversedFromStatus: true,
				},
			});

		expect(baseInstallment?.status).toBe("PAID");
		expect(baseInstallment?.amount).toBe(10_000);
		expect(baseInstallment?.paymentDate?.toISOString().slice(0, 10)).toBe(
			"2026-03-20",
		);
		expect(futurePendingInstallmentAfterReverse?.status).toBe("PENDING");
		expect(futurePendingInstallmentAfterReverse?.reversedFromStatus).toBeNull();
		expect(reversalMovement?.status).toBe("REVERSED");
		expect(reversalMovement?.amount).toBe(-500);
		expect(reversalMovement?.originInstallmentId).toBe(installment?.id);
		expect(reversalMovement?.reversedFromStatus).toBeNull();
		expect(reversalMovement?.reversedFromAmount).toBeNull();
		expect(reversalMovement?.reversedFromPaymentDate).toBeNull();
		expect(reversalMovement).not.toBeNull();
		if (!reversalMovement) {
			throw new Error("Expected reversal movement to be created");
		}

		const undoResponse = await request(app.server)
			.post(
				`/organizations/${fixture.org.slug}/sales/${saleId}/commission-installments/${reversalMovement.id}/reversal/undo`,
			)
			.set("Authorization", `Bearer ${fixture.token}`);

		expect(undoResponse.statusCode).toBe(204);

		const restoredInstallment =
			await prisma.saleCommissionInstallment.findUnique({
				where: {
					id: installment?.id,
				},
				select: {
					status: true,
					amount: true,
					paymentDate: true,
				},
			});
		const removedReversalMovement =
			await prisma.saleCommissionInstallment.findUnique({
				where: {
					id: reversalMovement.id,
				},
				select: {
					id: true,
				},
			});
		const futurePendingInstallmentAfterUndo =
			await prisma.saleCommissionInstallment.findFirst({
				where: {
					saleCommission: {
						saleId,
						recipientType: "SELLER",
					},
					originInstallmentId: null,
					installmentNumber: 2,
				},
				select: {
					status: true,
					reversedFromStatus: true,
				},
			});

		expect(restoredInstallment?.status).toBe("PAID");
		expect(restoredInstallment?.amount).toBe(10_000);
		expect(restoredInstallment?.paymentDate?.toISOString().slice(0, 10)).toBe(
			"2026-03-20",
		);
			expect(futurePendingInstallmentAfterUndo?.status).toBe("PENDING");
			expect(futurePendingInstallmentAfterUndo?.reversedFromStatus).toBeNull();
			expect(removedReversalMovement).toBeNull();
		});

		it("should create reversal movement, cancel future pending installments and restore them on undo", async () => {
			const fixture = await createFixture();
			const saleId = await createSaleUsingApi(
				fixture,
				buildCreatePayload(fixture, {
					commissions: buildThreeInstallmentsSellerCommissionsPayload(fixture),
				}),
			);

			await request(app.server)
				.patch(`/organizations/${fixture.org.slug}/sales/${saleId}/status`)
				.set("Authorization", `Bearer ${fixture.token}`)
				.send({
					status: "APPROVED",
				});

			const installment = await prisma.saleCommissionInstallment.findFirst({
				where: {
					saleCommission: {
						saleId,
						recipientType: "SELLER",
					},
					installmentNumber: 1,
					originInstallmentId: null,
				},
				select: {
					id: true,
				},
			});

			await request(app.server)
				.patch(
					`/organizations/${fixture.org.slug}/sales/${saleId}/commission-installments/${installment?.id}/status`,
				)
				.set("Authorization", `Bearer ${fixture.token}`)
				.send({
					status: "PAID",
					amount: 3_400,
					paymentDate: "2026-03-20",
				});

			const originalFutureInstallment = await prisma.saleCommissionInstallment.findFirst(
				{
					where: {
						saleCommission: {
							saleId,
							recipientType: "SELLER",
						},
						originInstallmentId: null,
						installmentNumber: 2,
					},
					select: {
						amount: true,
					},
				},
			);

			const originalInstallmentTwo =
				await prisma.saleCommissionInstallment.findFirst({
					where: {
						saleCommission: {
							saleId,
							recipientType: "SELLER",
						},
						originInstallmentId: null,
						installmentNumber: 2,
					},
					select: {
						amount: true,
					},
				});
			const originalInstallmentThree =
				await prisma.saleCommissionInstallment.findFirst({
					where: {
						saleCommission: {
							saleId,
							recipientType: "SELLER",
						},
						originInstallmentId: null,
						installmentNumber: 3,
					},
					select: {
						amount: true,
					},
				});

			const reverseResponse = await request(app.server)
				.post(
					`/organizations/${fixture.org.slug}/sales/${saleId}/commission-installments/${installment?.id}/reversal`,
				)
				.set("Authorization", `Bearer ${fixture.token}`)
				.send({
					reversalDate: "2026-03-26",
					manualAmount: -500,
					cancelPendingInstallments: true,
				});

			expect(reverseResponse.statusCode).toBe(204);

			const installmentTwoAfterReverse =
				await prisma.saleCommissionInstallment.findFirst({
					where: {
						saleCommission: {
							saleId,
							recipientType: "SELLER",
						},
						originInstallmentId: null,
						installmentNumber: 2,
					},
					select: {
						status: true,
						amount: true,
						reversedFromStatus: true,
						reversedFromAmount: true,
						reversedFromPaymentDate: true,
					},
				});
			const installmentThreeAfterReverse =
				await prisma.saleCommissionInstallment.findFirst({
					where: {
						saleCommission: {
							saleId,
							recipientType: "SELLER",
						},
						originInstallmentId: null,
						installmentNumber: 3,
					},
					select: {
						status: true,
						amount: true,
						reversedFromStatus: true,
						reversedFromAmount: true,
						reversedFromPaymentDate: true,
					},
				});
			const reversalMovement = await findLatestInstallmentReversalMovement(
				installment?.id ?? "",
			);
			expect(reversalMovement).not.toBeNull();
			if (!reversalMovement) {
				throw new Error("Expected reversal movement to be created");
			}

			expect(installmentTwoAfterReverse?.status).toBe("CANCELED");
			expect(installmentTwoAfterReverse?.amount).toBe(0);
			expect(installmentTwoAfterReverse?.reversedFromStatus).toBe("PENDING");
			expect(installmentTwoAfterReverse?.reversedFromAmount).toBe(
				originalInstallmentTwo?.amount,
			);
			expect(installmentTwoAfterReverse?.reversedFromPaymentDate).toBeNull();
			expect(installmentThreeAfterReverse?.status).toBe("CANCELED");
			expect(installmentThreeAfterReverse?.amount).toBe(0);
			expect(installmentThreeAfterReverse?.reversedFromStatus).toBe("PENDING");
			expect(installmentThreeAfterReverse?.reversedFromAmount).toBe(
				originalInstallmentThree?.amount,
			);
			expect(installmentThreeAfterReverse?.reversedFromPaymentDate).toBeNull();

			const undoResponse = await request(app.server)
				.post(
					`/organizations/${fixture.org.slug}/sales/${saleId}/commission-installments/${reversalMovement.id}/reversal/undo`,
				)
				.set("Authorization", `Bearer ${fixture.token}`);

			expect(undoResponse.statusCode).toBe(204);

			const installmentTwoAfterUndo =
				await prisma.saleCommissionInstallment.findFirst({
					where: {
						saleCommission: {
							saleId,
							recipientType: "SELLER",
						},
						originInstallmentId: null,
						installmentNumber: 2,
					},
					select: {
						status: true,
						amount: true,
						reversedFromStatus: true,
					},
				});
			const installmentThreeAfterUndo =
				await prisma.saleCommissionInstallment.findFirst({
					where: {
						saleCommission: {
							saleId,
							recipientType: "SELLER",
						},
						originInstallmentId: null,
						installmentNumber: 3,
					},
					select: {
						status: true,
						amount: true,
						reversedFromStatus: true,
					},
				});

			expect(installmentTwoAfterUndo?.status).toBe("PENDING");
			expect(installmentTwoAfterUndo?.amount).toBe(originalInstallmentTwo?.amount);
			expect(installmentTwoAfterUndo?.reversedFromStatus).toBeNull();
			expect(installmentThreeAfterUndo?.status).toBe("PENDING");
			expect(installmentThreeAfterUndo?.amount).toBe(
				originalInstallmentThree?.amount,
			);
			expect(installmentThreeAfterUndo?.reversedFromStatus).toBeNull();
		});

		it("should reverse base installment directly on full amount and restore it on undo", async () => {
			const fixture = await createFixture();
			const saleId = await createSaleUsingApi(
				fixture,
				buildCreatePayload(fixture, {
					commissions: buildCommissionsPayload(fixture),
				}),
			);

			await request(app.server)
				.patch(`/organizations/${fixture.org.slug}/sales/${saleId}/status`)
				.set("Authorization", `Bearer ${fixture.token}`)
				.send({
					status: "APPROVED",
				});

			const installment = await prisma.saleCommissionInstallment.findFirst({
				where: {
					saleCommission: {
						saleId,
						recipientType: "SELLER",
					},
					installmentNumber: 1,
				},
				select: {
					id: true,
				},
			});
			const originalFutureInstallment =
				await prisma.saleCommissionInstallment.findFirst({
					where: {
						saleCommission: {
							saleId,
							recipientType: "SELLER",
						},
						originInstallmentId: null,
						installmentNumber: 2,
					},
					select: {
						amount: true,
					},
				});

			await request(app.server)
				.patch(
					`/organizations/${fixture.org.slug}/sales/${saleId}/commission-installments/${installment?.id}/status`,
				)
				.set("Authorization", `Bearer ${fixture.token}`)
				.send({
					status: "PAID",
					amount: 10_000,
					paymentDate: "2026-03-20",
				});

			const reverseResponse = await request(app.server)
				.post(
					`/organizations/${fixture.org.slug}/sales/${saleId}/commission-installments/${installment?.id}/reversal`,
				)
				.set("Authorization", `Bearer ${fixture.token}`)
				.send({
					reversalDate: "2026-03-26",
					manualAmount: -10_000,
					cancelPendingInstallments: true,
				});

			expect(reverseResponse.statusCode).toBe(204);

			const reversedBaseInstallment =
				await prisma.saleCommissionInstallment.findUnique({
					where: {
						id: installment?.id,
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
				installment?.id ?? "",
			);
			const futureInstallmentAfterReverse =
				await prisma.saleCommissionInstallment.findFirst({
					where: {
						saleCommission: {
							saleId,
							recipientType: "SELLER",
						},
						originInstallmentId: null,
						installmentNumber: 2,
					},
					select: {
						status: true,
						amount: true,
						reversedFromStatus: true,
						reversedFromAmount: true,
					},
				});

			expect(reversedBaseInstallment?.status).toBe("REVERSED");
			expect(reversedBaseInstallment?.amount).toBe(-10_000);
			expect(
				reversedBaseInstallment?.paymentDate?.toISOString().slice(0, 10),
			).toBe("2026-03-26");
			expect(reversedBaseInstallment?.reversedFromStatus).toBe("PAID");
			expect(reversedBaseInstallment?.reversedFromAmount).toBe(10_000);
			expect(
				reversedBaseInstallment?.reversedFromPaymentDate
					?.toISOString()
					.slice(0, 10),
			).toBe("2026-03-20");
			expect(futureInstallmentAfterReverse?.status).toBe("CANCELED");
			expect(futureInstallmentAfterReverse?.amount).toBe(0);
			expect(futureInstallmentAfterReverse?.reversedFromStatus).toBe("PENDING");
			expect(futureInstallmentAfterReverse?.reversedFromAmount).toBe(
				originalFutureInstallment?.amount,
			);
			expect(reversalMovement).toBeNull();

			const undoResponse = await request(app.server)
				.post(
					`/organizations/${fixture.org.slug}/sales/${saleId}/commission-installments/${installment?.id}/reversal/undo`,
				)
				.set("Authorization", `Bearer ${fixture.token}`);

			expect(undoResponse.statusCode).toBe(204);

			const restoredBaseInstallment =
				await prisma.saleCommissionInstallment.findUnique({
					where: {
						id: installment?.id,
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
			const futureInstallmentAfterUndo =
				await prisma.saleCommissionInstallment.findFirst({
					where: {
						saleCommission: {
							saleId,
							recipientType: "SELLER",
						},
						originInstallmentId: null,
						installmentNumber: 2,
					},
					select: {
						status: true,
						amount: true,
						reversedFromStatus: true,
					},
				});

			expect(restoredBaseInstallment?.status).toBe("PAID");
			expect(restoredBaseInstallment?.amount).toBe(10_000);
			expect(restoredBaseInstallment?.paymentDate?.toISOString().slice(0, 10)).toBe(
				"2026-03-20",
			);
			expect(restoredBaseInstallment?.reversedFromStatus).toBeNull();
			expect(restoredBaseInstallment?.reversedFromAmount).toBeNull();
			expect(restoredBaseInstallment?.reversedFromPaymentDate).toBeNull();
			expect(futureInstallmentAfterUndo?.status).toBe("PENDING");
			expect(futureInstallmentAfterUndo?.amount).toBe(
				originalFutureInstallment?.amount,
			);
			expect(futureInstallmentAfterUndo?.reversedFromStatus).toBeNull();
		});

		it("should fail undo reversal when no origin snapshot exists", async () => {
			const fixture = await createFixture();
		const saleId = await createSaleUsingApi(
			fixture,
			buildCreatePayload(fixture, {
				commissions: buildCommissionsPayload(fixture),
			}),
		);

		await request(app.server)
			.patch(`/organizations/${fixture.org.slug}/sales/${saleId}/status`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				status: "APPROVED",
			});

		const installment = await prisma.saleCommissionInstallment.findFirst({
			where: {
				saleCommission: {
					saleId,
					recipientType: "SELLER",
				},
				installmentNumber: 1,
			},
			select: {
				id: true,
			},
		});

		await prisma.saleCommissionInstallment.update({
			where: {
				id: installment?.id,
			},
			data: {
				status: "REVERSED",
				amount: -500,
				paymentDate: new Date("2026-03-26T00:00:00.000Z"),
				reversedFromStatus: null,
				reversedFromAmount: null,
				reversedFromPaymentDate: null,
			},
		});

		const undoResponse = await request(app.server)
			.post(
				`/organizations/${fixture.org.slug}/sales/${saleId}/commission-installments/${installment?.id}/reversal/undo`,
			)
			.set("Authorization", `Bearer ${fixture.token}`);

		expect(undoResponse.statusCode).toBe(400);
		expect(undoResponse.body.message).toContain(
			"cannot be restored automatically",
		);
	});

	it("should apply automatic total-paid reversal and block second automatic reversal in same commission", async () => {
		const fixture = await createFixture();

		await prisma.product.update({
			where: {
				id: fixture.product.id,
			},
			data: {
				commissionReversalMode:
					ProductCommissionReversalMode.TOTAL_PAID_PERCENTAGE,
				commissionReversalTotalPercentage: 650_000,
			},
		});

		const saleId = await createSaleUsingApi(
			fixture,
			buildCreatePayload(fixture, {
				commissions: buildCommissionsPayload(fixture),
			}),
		);

		await request(app.server)
			.patch(`/organizations/${fixture.org.slug}/sales/${saleId}/status`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				status: "APPROVED",
			});

		const sellerInstallments = await prisma.saleCommissionInstallment.findMany({
			where: {
				saleCommission: {
					saleId,
					recipientType: "SELLER",
				},
			},
			orderBy: {
				installmentNumber: "asc",
			},
			select: {
				id: true,
			},
		});

		await request(app.server)
			.patch(
				`/organizations/${fixture.org.slug}/sales/${saleId}/commission-installments/${sellerInstallments[0]?.id}/status`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				status: "PAID",
				amount: 900,
				paymentDate: "2026-03-20",
			});

		const firstReverseResponse = await request(app.server)
			.post(
				`/organizations/${fixture.org.slug}/sales/${saleId}/commission-installments/${sellerInstallments[1]?.id}/reversal`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				reversalDate: "2026-03-26",
			});

		expect(firstReverseResponse.statusCode).toBe(204);

		const secondReverseResponse = await request(app.server)
			.post(
				`/organizations/${fixture.org.slug}/sales/${saleId}/commission-installments/${sellerInstallments[0]?.id}/reversal`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				reversalDate: "2026-03-27",
			});

		expect(secondReverseResponse.statusCode).toBe(400);
		expect(secondReverseResponse.body.message).toContain(
			"only be applied once per commission",
		);
	});

	it("should fail when installment patch makes commission total percentage non-positive", async () => {
		const fixture = await createFixture();
		const saleId = await createSaleUsingApi(
			fixture,
			buildCreatePayload(fixture, {
				commissions: buildCommissionsPayload(fixture),
			}),
		);

		await request(app.server)
			.patch(`/organizations/${fixture.org.slug}/sales/${saleId}/status`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				status: "APPROVED",
			});

		const installments = await prisma.saleCommissionInstallment.findMany({
			where: {
				saleCommission: {
					saleId,
					recipientType: "OTHER",
				},
			},
			select: {
				id: true,
			},
		});

		const response = await request(app.server)
			.patch(
				`/organizations/${fixture.org.slug}/sales/${saleId}/commission-installments/${installments[0]?.id}`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				percentage: 0,
			});

		expect(response.statusCode).toBe(400);
		expect(response.body.message).toBe(
			"Commission total percentage must be greater than zero",
		);
	});

	it("should delete installment and renumber remaining installments", async () => {
		const fixture = await createFixture();
		const saleId = await createSaleUsingApi(
			fixture,
			buildCreatePayload(fixture, {
				commissions: buildCommissionsPayload(fixture),
			}),
		);

		await request(app.server)
			.patch(`/organizations/${fixture.org.slug}/sales/${saleId}/status`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				status: "APPROVED",
			});

		const installments = await prisma.saleCommissionInstallment.findMany({
			where: {
				saleCommission: {
					saleId,
					recipientType: "SELLER",
				},
			},
			orderBy: {
				installmentNumber: "asc",
			},
			select: {
				id: true,
				saleCommissionId: true,
			},
		});

		const response = await request(app.server)
			.delete(
				`/organizations/${fixture.org.slug}/sales/${saleId}/commission-installments/${installments[0]?.id}`,
			)
			.set("Authorization", `Bearer ${fixture.token}`);

		expect(response.statusCode).toBe(204);

		const remainingInstallments =
			await prisma.saleCommissionInstallment.findMany({
				where: {
					saleCommissionId: installments[0]?.saleCommissionId,
				},
				orderBy: {
					installmentNumber: "asc",
				},
				select: {
					installmentNumber: true,
					percentage: true,
				},
			});

		expect(remainingInstallments).toHaveLength(1);
		expect(remainingInstallments[0]?.installmentNumber).toBe(1);

		const commission = await prisma.saleCommission.findUnique({
			where: {
				id: installments[0]?.saleCommissionId,
			},
			select: {
				totalPercentage: true,
			},
		});

		expect(commission?.totalPercentage).toBe(
			remainingInstallments[0]?.percentage,
		);
	});

	it("should fail when deleting the last installment of a commission", async () => {
		const fixture = await createFixture();
		const saleId = await createSaleUsingApi(
			fixture,
			buildCreatePayload(fixture, {
				commissions: buildCommissionsPayload(fixture),
			}),
		);

		await request(app.server)
			.patch(`/organizations/${fixture.org.slug}/sales/${saleId}/status`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				status: "APPROVED",
			});

		const singleInstallment = await prisma.saleCommissionInstallment.findFirst({
			where: {
				saleCommission: {
					saleId,
					recipientType: "OTHER",
				},
			},
			select: {
				id: true,
			},
		});

		const response = await request(app.server)
			.delete(
				`/organizations/${fixture.org.slug}/sales/${saleId}/commission-installments/${singleInstallment?.id}`,
			)
			.set("Authorization", `Bearer ${fixture.token}`);

		expect(response.statusCode).toBe(400);
		expect(response.body.message).toBe(
			"Cannot delete the last installment of a commission",
		);
	});

	it("should block installment status update when sale is canceled", async () => {
		const fixture = await createFixture();
		const saleId = await createSaleUsingApi(
			fixture,
			buildCreatePayload(fixture, {
				commissions: buildCommissionsPayload(fixture),
			}),
		);

		await request(app.server)
			.patch(`/organizations/${fixture.org.slug}/sales/${saleId}/status`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				status: "CANCELED",
			});

		const installments = await prisma.saleCommissionInstallment.findMany({
			where: {
				saleCommission: {
					saleId,
				},
			},
			select: {
				id: true,
			},
		});

		const installmentId = installments[0]?.id as string;
		expect(installmentId).toBeTruthy();

		const response = await request(app.server)
			.patch(
				`/organizations/${fixture.org.slug}/sales/${saleId}/commission-installments/${installmentId}/status`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				status: "PAID",
			});

		expect(response.statusCode).toBe(400);
		expect(response.body.message).toBe(
			"Cannot update commission installments for canceled sale",
		);
	});

	it("should patch status with valid transition", async () => {
		const fixture = await createFixture();
		const saleId = await createSaleUsingApi(fixture);

		const approveResponse = await request(app.server)
			.patch(`/organizations/${fixture.org.slug}/sales/${saleId}/status`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				status: "APPROVED",
			});

		expect(approveResponse.statusCode).toBe(204);

		const completeResponse = await request(app.server)
			.patch(`/organizations/${fixture.org.slug}/sales/${saleId}/status`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				status: "COMPLETED",
			});

		expect(completeResponse.statusCode).toBe(204);

		const sale = await prisma.sale.findUnique({
			where: {
				id: saleId,
			},
			select: {
				status: true,
			},
		});

		expect(sale?.status).toBe(SaleStatus.COMPLETED);
	});

	it("should create a linked income transaction when sale is completed and sync is enabled", async () => {
		const fixture = await createFixture();
		const mapping = await createProductSalesTransactionMapping(fixture.org.id);

		await setOrganizationSalesTransactionsSync(fixture.org.id, true);
		await updateProductSalesTransactionMapping({
			productId: fixture.product.id,
			categoryId: mapping.incomeCategory.id,
			costCenterId: mapping.costCenter.id,
		});

		const saleId = await createSaleUsingApi(fixture);
		await patchSaleStatusUsingApi(fixture, saleId, "APPROVED");
		await patchSaleStatusUsingApi(fixture, saleId, "COMPLETED");

		const transaction = await prisma.transaction.findFirst({
			where: {
				saleId,
				organizationId: fixture.org.id,
			},
			select: {
				id: true,
				type: true,
				status: true,
				nature: true,
				totalAmount: true,
				companyId: true,
				unitId: true,
				categoryId: true,
				costCenterId: true,
				dueDate: true,
				expectedPaymentDate: true,
				description: true,
			},
		});

		expect(transaction).not.toBeNull();
		expect(transaction?.type).toBe(TransactionType.INCOME);
		expect(transaction?.status).toBe(TransactionStatus.PENDING);
		expect(transaction?.nature).toBe(TransactionNature.VARIABLE);
		expect(transaction?.totalAmount).toBe(125_000);
		expect(transaction?.companyId).toBe(fixture.company.id);
		expect(transaction?.unitId).toBe(fixture.unit.id);
		expect(transaction?.categoryId).toBe(mapping.incomeCategory.id);
		expect(transaction?.costCenterId).toBe(mapping.costCenter.id);
		expect(transaction?.dueDate.toISOString().slice(0, 10)).toBe(
			transaction?.expectedPaymentDate.toISOString().slice(0, 10),
		);
		expect(transaction?.description).toContain(fixture.product.name);
		expect(transaction?.description).toContain(fixture.customer.name);
		expect(transaction?.description).toContain(saleId);
	});

	it("should not create a linked transaction when sales sync is disabled", async () => {
		const fixture = await createFixture();
		const mapping = await createProductSalesTransactionMapping(fixture.org.id);

		await updateProductSalesTransactionMapping({
			productId: fixture.product.id,
			categoryId: mapping.incomeCategory.id,
			costCenterId: mapping.costCenter.id,
		});

		const saleId = await createSaleUsingApi(fixture);
		await patchSaleStatusUsingApi(fixture, saleId, "APPROVED");
		await patchSaleStatusUsingApi(fixture, saleId, "COMPLETED");

		const linkedTransaction = await prisma.transaction.findFirst({
			where: {
				organizationId: fixture.org.id,
				saleId,
			},
			select: {
				id: true,
			},
		});

		expect(linkedTransaction).toBeNull();
	});

	it("should not create a linked transaction when product has no financial mapping", async () => {
		const fixture = await createFixture();

		await setOrganizationSalesTransactionsSync(fixture.org.id, true);
		const saleId = await createSaleUsingApi(fixture);
		await patchSaleStatusUsingApi(fixture, saleId, "APPROVED");
		await patchSaleStatusUsingApi(fixture, saleId, "COMPLETED");

		const linkedTransaction = await prisma.transaction.findFirst({
			where: {
				organizationId: fixture.org.id,
				saleId,
			},
			select: {
				id: true,
			},
		});

		expect(linkedTransaction).toBeNull();
	});

	it("should sync linked pending transaction when completed sale is updated", async () => {
		const fixture = await createFixture();
		const mapping = await createProductSalesTransactionMapping(fixture.org.id);

		await setOrganizationSalesTransactionsSync(fixture.org.id, true);
		await updateProductSalesTransactionMapping({
			productId: fixture.product.id,
			categoryId: mapping.incomeCategory.id,
			costCenterId: mapping.costCenter.id,
		});

		const saleId = await createSaleUsingApi(fixture);
		await patchSaleStatusUsingApi(fixture, saleId, "APPROVED");
		await patchSaleStatusUsingApi(fixture, saleId, "COMPLETED");

		const updateResponse = await request(app.server)
			.put(`/organizations/${fixture.org.slug}/sales/${saleId}`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send(
				buildCreatePayload(fixture, {
					totalAmount: 240_000,
					companyId: fixture.secondCompany.id,
					unitId: fixture.foreignUnit.id,
					notes: "Venda atualizada após conclusão",
				}),
			);

		expect(updateResponse.statusCode).toBe(204);

		const linkedTransaction = await prisma.transaction.findFirst({
			where: {
				organizationId: fixture.org.id,
				saleId,
			},
			select: {
				status: true,
				totalAmount: true,
				companyId: true,
				unitId: true,
			},
		});

		expect(linkedTransaction?.status).toBe(TransactionStatus.PENDING);
		expect(linkedTransaction?.totalAmount).toBe(240_000);
		expect(linkedTransaction?.companyId).toBe(fixture.secondCompany.id);
		expect(linkedTransaction?.unitId).toBe(fixture.foreignUnit.id);
	});

	it("should cancel linked pending transaction when deleting a sale", async () => {
		const fixture = await createFixture();
		const mapping = await createProductSalesTransactionMapping(fixture.org.id);

		await setOrganizationSalesTransactionsSync(fixture.org.id, true);
		await updateProductSalesTransactionMapping({
			productId: fixture.product.id,
			categoryId: mapping.incomeCategory.id,
			costCenterId: mapping.costCenter.id,
		});

		const saleId = await createSaleUsingApi(fixture);
		await patchSaleStatusUsingApi(fixture, saleId, "APPROVED");
		await patchSaleStatusUsingApi(fixture, saleId, "COMPLETED");

		const linkedTransactionBeforeDelete = await prisma.transaction.findFirst({
			where: {
				organizationId: fixture.org.id,
				saleId,
			},
			select: {
				id: true,
			},
		});
		expect(linkedTransactionBeforeDelete).not.toBeNull();
		const linkedTransactionBeforeDeleteId =
			linkedTransactionBeforeDelete?.id as string;

		const deleteResponse = await request(app.server)
			.delete(`/organizations/${fixture.org.slug}/sales/${saleId}`)
			.set("Authorization", `Bearer ${fixture.token}`);

		expect(deleteResponse.statusCode).toBe(204);

		const linkedTransactionAfterDelete = await prisma.transaction.findUnique({
			where: {
				id: linkedTransactionBeforeDeleteId,
			},
			select: {
				status: true,
				saleId: true,
			},
		});

		expect(linkedTransactionAfterDelete?.status).toBe(
			TransactionStatus.CANCELED,
		);
		expect(linkedTransactionAfterDelete?.saleId).toBeNull();
	});

	it(
		"should not sync linked transactions when they are paid or canceled",
		async () => {
			const fixture = await createFixture();
			const mapping = await createProductSalesTransactionMapping(
				fixture.org.id,
			);

		await setOrganizationSalesTransactionsSync(fixture.org.id, true);
		await updateProductSalesTransactionMapping({
			productId: fixture.product.id,
			categoryId: mapping.incomeCategory.id,
			costCenterId: mapping.costCenter.id,
		});

		const paidSaleId = await createSaleUsingApi(fixture);
		await patchSaleStatusUsingApi(fixture, paidSaleId, "APPROVED");
		await patchSaleStatusUsingApi(fixture, paidSaleId, "COMPLETED");

		const paidTransaction = await prisma.transaction.findFirst({
			where: {
				organizationId: fixture.org.id,
				saleId: paidSaleId,
			},
			select: {
				id: true,
			},
		});
		expect(paidTransaction).not.toBeNull();
		const paidTransactionId = paidTransaction?.id as string;

		await prisma.transaction.update({
			where: {
				id: paidTransactionId,
			},
			data: {
				status: TransactionStatus.PAID,
				totalAmount: 999_999,
			},
		});

		const paidSaleUpdateResponse = await request(app.server)
			.put(`/organizations/${fixture.org.slug}/sales/${paidSaleId}`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send(
				buildCreatePayload(fixture, {
					totalAmount: 111_111,
					notes: "Atualização não deve refletir em transação paga",
				}),
			);

		expect(paidSaleUpdateResponse.statusCode).toBe(204);

		const paidTransactionAfterSaleUpdate = await prisma.transaction.findUnique({
			where: {
				id: paidTransactionId,
			},
			select: {
				status: true,
				totalAmount: true,
			},
		});
		expect(paidTransactionAfterSaleUpdate?.status).toBe(TransactionStatus.PAID);
		expect(paidTransactionAfterSaleUpdate?.totalAmount).toBe(999_999);

		const canceledSaleId = await createSaleUsingApi(
			fixture,
			buildCreatePayload(fixture, {
				saleDate: "2026-03-07",
				totalAmount: 155_000,
			}),
		);
		await patchSaleStatusUsingApi(fixture, canceledSaleId, "APPROVED");
		await patchSaleStatusUsingApi(fixture, canceledSaleId, "COMPLETED");

		const canceledTransaction = await prisma.transaction.findFirst({
			where: {
				organizationId: fixture.org.id,
				saleId: canceledSaleId,
			},
			select: {
				id: true,
			},
		});
		expect(canceledTransaction).not.toBeNull();
		const canceledTransactionId = canceledTransaction?.id as string;

		await prisma.transaction.update({
			where: {
				id: canceledTransactionId,
			},
			data: {
				status: TransactionStatus.CANCELED,
				totalAmount: 888_888,
			},
		});

		const canceledSaleUpdateResponse = await request(app.server)
			.put(`/organizations/${fixture.org.slug}/sales/${canceledSaleId}`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send(
				buildCreatePayload(fixture, {
					saleDate: "2026-03-08",
					totalAmount: 166_000,
					notes: "Atualização não deve refletir em transação cancelada",
				}),
			);

		expect(canceledSaleUpdateResponse.statusCode).toBe(204);

		const canceledTransactionAfterSaleUpdate =
			await prisma.transaction.findUnique({
				where: {
					id: canceledTransactionId,
				},
				select: {
					status: true,
					totalAmount: true,
				},
			});
		expect(canceledTransactionAfterSaleUpdate?.status).toBe(
			TransactionStatus.CANCELED,
		);
			expect(canceledTransactionAfterSaleUpdate?.totalAmount).toBe(888_888);
		},
		15000,
	);

	it("should patch status in bulk for valid transitions", async () => {
		const fixture = await createFixture();
		const firstSaleId = await createSaleUsingApi(fixture);
		const secondSaleId = await createSaleUsingApi(
			fixture,
			buildCreatePayload(fixture, {
				saleDate: "2026-03-05",
				totalAmount: 130_000,
			}),
		);

		const response = await request(app.server)
			.patch(`/organizations/${fixture.org.slug}/sales/status/bulk`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				saleIds: [firstSaleId, secondSaleId],
				status: "APPROVED",
			});

		expect(response.statusCode).toBe(200);
		expect(response.body.updated).toBe(2);

		const sales = await prisma.sale.findMany({
			where: {
				id: {
					in: [firstSaleId, secondSaleId],
				},
			},
			select: {
				id: true,
				status: true,
			},
		});

		expect(sales).toHaveLength(2);
		expect(sales.every((sale) => sale.status === SaleStatus.APPROVED)).toBe(
			true,
		);
	});

	it("should auto activate inactive responsible partners when completing sales in bulk", async () => {
		const fixture = await createFixture();
		const secondInactivePartner = await prisma.partner.create({
			data: {
				name: `Second inactive partner ${Date.now()}`,
				email: `second-inactive-partner-${Date.now()}@example.com`,
				phone: "55999555111",
				documentType: PartnerDocumentType.CPF,
				document: `${Math.floor(Math.random() * 1_000_000_000)}`,
				companyName: "Partner Company",
				state: "RS",
				organizationId: fixture.org.id,
				status: PartnerStatus.INACTIVE,
			},
		});

		const firstSaleId = await createSaleUsingApi(
			fixture,
			buildCreatePayload(fixture, {
				responsible: {
					type: "PARTNER",
					id: fixture.inactivePartner.id,
				},
				unitId: undefined,
			}),
		);
		const secondSaleId = await createSaleUsingApi(
			fixture,
			buildCreatePayload(fixture, {
				saleDate: "2026-03-05",
				responsible: {
					type: "PARTNER",
					id: secondInactivePartner.id,
				},
				unitId: undefined,
			}),
		);

		const response = await request(app.server)
			.patch(`/organizations/${fixture.org.slug}/sales/status/bulk`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				saleIds: [firstSaleId, secondSaleId],
				status: "COMPLETED",
			});

		expect(response.statusCode).toBe(200);
		expect(response.body.updated).toBe(2);

		const partners = await prisma.partner.findMany({
			where: {
				id: {
					in: [fixture.inactivePartner.id, secondInactivePartner.id],
				},
			},
			select: {
				id: true,
				status: true,
			},
		});

		expect(partners).toHaveLength(2);
		expect(partners.every((partner) => partner.status === PartnerStatus.ACTIVE)).toBe(
			true,
		);
	});

	it("should set commission installment amounts to zero when canceling sales in bulk", async () => {
		const fixture = await createFixture();
		const firstSaleId = await createSaleUsingApi(
			fixture,
			buildCreatePayload(fixture, {
				commissions: buildCommissionsPayload(fixture),
			}),
		);
		const secondSaleId = await createSaleUsingApi(
			fixture,
			buildCreatePayload(fixture, {
				saleDate: "2026-03-05",
				commissions: buildThreeInstallmentsSellerCommissionsPayload(fixture),
			}),
		);
		const saleIds = [firstSaleId, secondSaleId];

		const response = await request(app.server)
			.patch(`/organizations/${fixture.org.slug}/sales/status/bulk`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				saleIds,
				status: "CANCELED",
			});

		expect(response.statusCode).toBe(200);
		expect(response.body.updated).toBe(2);

		const installments = await prisma.saleCommissionInstallment.findMany({
			where: {
				saleCommission: {
					saleId: {
						in: saleIds,
					},
				},
				status: {
					not: "REVERSED",
				},
			},
			select: {
				status: true,
				amount: true,
				paymentDate: true,
			},
		});

		expect(installments.length).toBeGreaterThan(0);
		expect(
			installments.every((installment) => installment.status === "CANCELED"),
		).toBe(true);
		expect(installments.every((installment) => installment.amount === 0)).toBe(
			true,
		);
		expect(
			installments.every((installment) => installment.paymentDate === null),
		).toBe(true);
	});

	it("should create linked transactions when completing sales status in bulk", async () => {
		const fixture = await createFixture();
		const mapping = await createProductSalesTransactionMapping(fixture.org.id);

		await setOrganizationSalesTransactionsSync(fixture.org.id, true);
		await updateProductSalesTransactionMapping({
			productId: fixture.product.id,
			categoryId: mapping.incomeCategory.id,
			costCenterId: mapping.costCenter.id,
		});

		const firstSaleId = await createSaleUsingApi(fixture);
		const secondSaleId = await createSaleUsingApi(
			fixture,
			buildCreatePayload(fixture, {
				saleDate: "2026-03-09",
				totalAmount: 140_000,
			}),
		);
		const saleIds = [firstSaleId, secondSaleId];

		const approveResponse = await request(app.server)
			.patch(`/organizations/${fixture.org.slug}/sales/status/bulk`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				saleIds,
				status: "APPROVED",
			});
		expect(approveResponse.statusCode).toBe(200);

		const completeResponse = await request(app.server)
			.patch(`/organizations/${fixture.org.slug}/sales/status/bulk`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				saleIds,
				status: "COMPLETED",
			});
		expect(completeResponse.statusCode).toBe(200);
		expect(completeResponse.body.updated).toBe(2);

		const linkedTransactions = await prisma.transaction.findMany({
			where: {
				organizationId: fixture.org.id,
				saleId: {
					in: saleIds,
				},
			},
			select: {
				saleId: true,
				status: true,
			},
		});

		expect(linkedTransactions).toHaveLength(2);
		expect(
			linkedTransactions.every(
				(transaction) => transaction.status === TransactionStatus.PENDING,
			),
		).toBe(true);
		expect(
			linkedTransactions.map((transaction) => transaction.saleId).sort(),
		).toEqual([...saleIds].sort());
	});

	it("should bulk update commission installments with strict transitions and partial skip", async () => {
		const fixture = await createFixture();
		const saleId = await createSaleUsingApi(
			fixture,
			buildCreatePayload(fixture, {
				commissions: buildThreeInstallmentsSellerCommissionsPayload(fixture),
			}),
		);

		await patchSaleStatusUsingApi(fixture, saleId, "APPROVED");

		const installments = await prisma.saleCommissionInstallment.findMany({
			where: {
				saleCommission: {
					saleId,
					recipientType: "SELLER",
				},
				originInstallmentId: null,
			},
			orderBy: {
				installmentNumber: "asc",
			},
			select: {
				id: true,
			},
		});

		expect(installments).toHaveLength(3);

		await prisma.saleCommissionInstallment.update({
			where: {
				id: installments[0]?.id,
			},
			data: {
				status: "PAID",
				paymentDate: new Date("2026-03-20T00:00:00.000Z"),
			},
		});

		await prisma.saleCommissionInstallment.update({
			where: {
				id: installments[1]?.id,
			},
			data: {
				status: "CANCELED",
				paymentDate: new Date("2026-03-22T00:00:00.000Z"),
			},
		});

		const response = await request(app.server)
			.patch(
				`/organizations/${fixture.org.slug}/commissions/installments/status/bulk`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				installmentIds: installments.map((installment) => installment.id),
				status: "PENDING",
			});

		expect(response.statusCode).toBe(200);
		expect(response.body.updatedCount).toBe(2);
		expect(response.body.skipped).toEqual([
			{
				installmentId: installments[2]?.id,
				reason: "INVALID_STATUS_TRANSITION",
			},
		]);

		const updatedInstallments = await prisma.saleCommissionInstallment.findMany({
			where: {
				id: {
					in: installments
						.map((installment) => installment.id)
						.filter((value): value is string => Boolean(value)),
				},
			},
			orderBy: {
				installmentNumber: "asc",
			},
			select: {
				id: true,
				status: true,
				amount: true,
				paymentDate: true,
				reversedFromStatus: true,
				reversedFromAmount: true,
				reversedFromPaymentDate: true,
			},
		});

		expect(updatedInstallments.map((installment) => installment.status)).toEqual([
			"PENDING",
			"PENDING",
			"PENDING",
		]);
		expect(updatedInstallments[0]?.paymentDate).toBeNull();
		expect(updatedInstallments[1]?.paymentDate).toBeNull();
		expect(updatedInstallments[2]?.paymentDate).toBeNull();
		expect(
			updatedInstallments.every(
				(installment) =>
					installment.reversedFromStatus === null &&
					installment.reversedFromAmount === null &&
					installment.reversedFromPaymentDate === null,
			),
		).toBe(true);
	});

	it("should skip reversed and non-editable sale installments on bulk update", async () => {
		const fixture = await createFixture();
		const editableSaleId = await createSaleUsingApi(
			fixture,
			buildCreatePayload(fixture, {
				commissions: buildThreeInstallmentsSellerCommissionsPayload(fixture),
			}),
		);
		const pendingSaleId = await createSaleUsingApi(
			fixture,
			buildCreatePayload(fixture, {
				saleDate: "2026-03-09",
				commissions: buildCommissionsPayload(fixture),
			}),
		);

		await patchSaleStatusUsingApi(fixture, editableSaleId, "APPROVED");

		const editableInstallments = await prisma.saleCommissionInstallment.findMany({
			where: {
				saleCommission: {
					saleId: editableSaleId,
					recipientType: "SELLER",
				},
				originInstallmentId: null,
			},
			orderBy: {
				installmentNumber: "asc",
			},
			select: {
				id: true,
			},
		});
		const pendingSaleInstallment =
			await prisma.saleCommissionInstallment.findFirst({
				where: {
					saleCommission: {
						saleId: pendingSaleId,
						recipientType: "SELLER",
					},
					originInstallmentId: null,
					installmentNumber: 1,
				},
				select: {
					id: true,
				},
			});

		expect(editableInstallments).toHaveLength(3);
		expect(pendingSaleInstallment?.id).toBeDefined();

		await prisma.saleCommissionInstallment.update({
			where: {
				id: editableInstallments[1]?.id,
			},
			data: {
				status: "PAID",
				paymentDate: new Date("2026-03-18T00:00:00.000Z"),
			},
		});
		await prisma.saleCommissionInstallment.update({
			where: {
				id: editableInstallments[2]?.id,
			},
			data: {
				status: "REVERSED",
				amount: -500,
				paymentDate: new Date("2026-03-19T00:00:00.000Z"),
			},
		});

		const response = await request(app.server)
			.patch(
				`/organizations/${fixture.org.slug}/commissions/installments/status/bulk`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				installmentIds: [
					editableInstallments[0]?.id,
					editableInstallments[1]?.id,
					editableInstallments[2]?.id,
					pendingSaleInstallment?.id,
				],
				status: "PAID",
				paymentDate: "2026-03-24",
			});

		expect(response.statusCode).toBe(200);
		expect(response.body.updatedCount).toBe(1);
		expect(response.body.skipped).toEqual([
			{
				installmentId: editableInstallments[1]?.id,
				reason: "INVALID_STATUS_TRANSITION",
			},
			{
				installmentId: editableInstallments[2]?.id,
				reason: "REVERSED_NOT_ALLOWED",
			},
			{
				installmentId: pendingSaleInstallment?.id,
				reason: "SALE_NOT_EDITABLE",
			},
		]);

		const refreshedEditableInstallments =
			await prisma.saleCommissionInstallment.findMany({
				where: {
					id: {
						in: editableInstallments
							.map((installment) => installment.id)
							.filter((value): value is string => Boolean(value)),
					},
				},
				orderBy: {
					installmentNumber: "asc",
				},
				select: {
					id: true,
					status: true,
					paymentDate: true,
				},
			});
		const refreshedPendingInstallment =
			await prisma.saleCommissionInstallment.findUnique({
				where: {
					id: pendingSaleInstallment?.id,
				},
				select: {
					status: true,
					paymentDate: true,
				},
			});

		expect(refreshedEditableInstallments[0]?.status).toBe("PAID");
		expect(
			refreshedEditableInstallments[0]?.paymentDate?.toISOString().slice(0, 10),
		).toBe("2026-03-24");
		expect(refreshedEditableInstallments[1]?.status).toBe("PAID");
		expect(refreshedEditableInstallments[2]?.status).toBe("REVERSED");
		expect(refreshedPendingInstallment?.status).toBe("PENDING");
	});

	it("should bulk cancel pending installments without cascade and reversal movement", async () => {
		const fixture = await createFixture();
		const saleId = await createSaleUsingApi(
			fixture,
			buildCreatePayload(fixture, {
				commissions: buildThreeInstallmentsSellerCommissionsPayload(fixture),
			}),
		);

		await patchSaleStatusUsingApi(fixture, saleId, "APPROVED");

		const installments = await prisma.saleCommissionInstallment.findMany({
			where: {
				saleCommission: {
					saleId,
					recipientType: "SELLER",
				},
				originInstallmentId: null,
			},
			orderBy: {
				installmentNumber: "asc",
			},
			select: {
				id: true,
			},
		});

		const response = await request(app.server)
			.patch(
				`/organizations/${fixture.org.slug}/commissions/installments/status/bulk`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				installmentIds: [installments[0]?.id, installments[1]?.id],
				status: "CANCELED",
				reversalDate: "2026-03-28",
			});

		expect(response.statusCode).toBe(200);
		expect(response.body.updatedCount).toBe(2);
		expect(response.body.skipped).toEqual([]);

		const refreshedInstallments = await prisma.saleCommissionInstallment.findMany({
			where: {
				id: {
					in: installments
						.map((installment) => installment.id)
						.filter((value): value is string => Boolean(value)),
				},
			},
			orderBy: {
				installmentNumber: "asc",
			},
			select: {
				id: true,
				status: true,
				amount: true,
				paymentDate: true,
				reversedFromStatus: true,
				reversedFromAmount: true,
				reversedFromPaymentDate: true,
			},
		});

		expect(refreshedInstallments[0]?.status).toBe("CANCELED");
		expect(refreshedInstallments[1]?.status).toBe("CANCELED");
		expect(refreshedInstallments[2]?.status).toBe("PENDING");
		expect(refreshedInstallments[0]?.amount).toBe(0);
		expect(refreshedInstallments[1]?.amount).toBe(0);
		expect(
			refreshedInstallments[0]?.paymentDate?.toISOString().slice(0, 10),
		).toBe("2026-03-28");
		expect(
			refreshedInstallments[1]?.paymentDate?.toISOString().slice(0, 10),
		).toBe("2026-03-28");
		expect(refreshedInstallments[2]?.paymentDate).toBeNull();
		expect(
			refreshedInstallments.every(
				(installment) =>
					installment.reversedFromStatus === null &&
					installment.reversedFromAmount === null &&
					installment.reversedFromPaymentDate === null,
			),
		).toBe(true);

		const reversalMovementForFirst = await findLatestInstallmentReversalMovement(
			installments[0]?.id ?? "",
		);
		const reversalMovementForSecond = await findLatestInstallmentReversalMovement(
			installments[1]?.id ?? "",
		);

		expect(reversalMovementForFirst).toBeNull();
		expect(reversalMovementForSecond).toBeNull();
	});

	it("should delete sales in bulk with commissions cascade", async () => {
		const fixture = await createFixture();
		const firstSaleId = await createSaleUsingApi(
			fixture,
			buildCreatePayload(fixture, {
				saleDate: "2026-03-05",
				commissions: buildCommissionsPayload(fixture),
			}),
		);
		const secondSaleId = await createSaleUsingApi(
			fixture,
			buildCreatePayload(fixture, {
				saleDate: "2026-03-06",
				commissions: buildCommissionsPayload(fixture),
			}),
		);

		const saleIds = [firstSaleId, secondSaleId];

		const commissionsBeforeDelete = await prisma.saleCommission.count({
			where: {
				saleId: {
					in: saleIds,
				},
			},
		});
		expect(commissionsBeforeDelete).toBeGreaterThan(0);

		const installmentsBeforeDelete =
			await prisma.saleCommissionInstallment.count({
				where: {
					saleCommission: {
						saleId: {
							in: saleIds,
						},
					},
				},
			});
		expect(installmentsBeforeDelete).toBeGreaterThan(0);

		const response = await request(app.server)
			.patch(`/organizations/${fixture.org.slug}/sales/delete/bulk`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				saleIds,
			});

		expect(response.statusCode).toBe(200);
		expect(response.body.deleted).toBe(2);

		const remainingSales = await prisma.sale.count({
			where: {
				id: {
					in: saleIds,
				},
			},
		});
		expect(remainingSales).toBe(0);

		const commissionsAfterDelete = await prisma.saleCommission.count({
			where: {
				saleId: {
					in: saleIds,
				},
			},
		});
		expect(commissionsAfterDelete).toBe(0);

		const installmentsAfterDelete =
			await prisma.saleCommissionInstallment.count({
				where: {
					saleCommission: {
						saleId: {
							in: saleIds,
						},
					},
				},
			});
		expect(installmentsAfterDelete).toBe(0);
	});

	it("should cancel linked pending transactions when deleting sales in bulk", async () => {
		const fixture = await createFixture();
		const mapping = await createProductSalesTransactionMapping(fixture.org.id);

		await setOrganizationSalesTransactionsSync(fixture.org.id, true);
		await updateProductSalesTransactionMapping({
			productId: fixture.product.id,
			categoryId: mapping.incomeCategory.id,
			costCenterId: mapping.costCenter.id,
		});

		const firstSaleId = await createSaleUsingApi(
			fixture,
			buildCreatePayload(fixture, {
				saleDate: "2026-03-10",
			}),
		);
		const secondSaleId = await createSaleUsingApi(
			fixture,
			buildCreatePayload(fixture, {
				saleDate: "2026-03-11",
			}),
		);
		const saleIds = [firstSaleId, secondSaleId];

		const approveResponse = await request(app.server)
			.patch(`/organizations/${fixture.org.slug}/sales/status/bulk`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				saleIds,
				status: "APPROVED",
			});
		expect(approveResponse.statusCode).toBe(200);

		const completeResponse = await request(app.server)
			.patch(`/organizations/${fixture.org.slug}/sales/status/bulk`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				saleIds,
				status: "COMPLETED",
			});
		expect(completeResponse.statusCode).toBe(200);

		const linkedTransactionIds = (
			await prisma.transaction.findMany({
				where: {
					organizationId: fixture.org.id,
					saleId: {
						in: saleIds,
					},
				},
				select: {
					id: true,
				},
			})
		).map((transaction) => transaction.id);
		expect(linkedTransactionIds).toHaveLength(2);

		const deleteResponse = await request(app.server)
			.patch(`/organizations/${fixture.org.slug}/sales/delete/bulk`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				saleIds,
			});
		expect(deleteResponse.statusCode).toBe(200);
		expect(deleteResponse.body.deleted).toBe(2);

		const linkedTransactionsAfterDelete = await prisma.transaction.findMany({
			where: {
				id: {
					in: linkedTransactionIds,
				},
			},
			select: {
				status: true,
				saleId: true,
			},
		});

		expect(linkedTransactionsAfterDelete).toHaveLength(2);
		expect(
			linkedTransactionsAfterDelete.every(
				(transaction) => transaction.status === TransactionStatus.CANCELED,
			),
		).toBe(true);
		expect(
			linkedTransactionsAfterDelete.every(
				(transaction) => transaction.saleId === null,
			),
		).toBe(true);
	});

	it("should keep all sales when bulk delete contains an invalid id", async () => {
		const fixture = await createFixture();
		const firstSaleId = await createSaleUsingApi(
			fixture,
			buildCreatePayload(fixture, {
				saleDate: "2026-03-05",
			}),
		);
		const secondSaleId = await createSaleUsingApi(
			fixture,
			buildCreatePayload(fixture, {
				saleDate: "2026-03-06",
			}),
		);

		const response = await request(app.server)
			.patch(`/organizations/${fixture.org.slug}/sales/delete/bulk`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				saleIds: [
					firstSaleId,
					secondSaleId,
					"99999999-9999-4999-8999-999999999999",
				],
			});

		expect(response.statusCode).toBe(400);
		expect(response.body.message).toBe("One or more sales were not found");

		const remainingSales = await prisma.sale.count({
			where: {
				id: {
					in: [firstSaleId, secondSaleId],
				},
			},
		});
		expect(remainingSales).toBe(2);
	});

	it("should reject invalid status transition", async () => {
		const fixture = await createFixture();
		const saleId = await createSaleUsingApi(fixture);

		const completeResponse = await request(app.server)
			.patch(`/organizations/${fixture.org.slug}/sales/${saleId}/status`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				status: "COMPLETED",
			});

		expect(completeResponse.statusCode).toBe(204);

		const response = await request(app.server)
			.patch(`/organizations/${fixture.org.slug}/sales/${saleId}/status`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				status: "APPROVED",
			});

		expect(response.statusCode).toBe(400);
		expect(response.body.message).toBe(
			"Cannot change sale status from COMPLETED to APPROVED",
		);
	});

	it("should delete sale", async () => {
		const fixture = await createFixture();
		const saleId = await createSaleUsingApi(
			fixture,
			buildCreatePayload(fixture, {
				commissions: buildCommissionsPayload(fixture),
			}),
		);

		const commissionsBeforeDelete = await prisma.saleCommission.count({
			where: {
				saleId,
			},
		});
		expect(commissionsBeforeDelete).toBeGreaterThan(0);

		const response = await request(app.server)
			.delete(`/organizations/${fixture.org.slug}/sales/${saleId}`)
			.set("Authorization", `Bearer ${fixture.token}`);

		expect(response.statusCode).toBe(204);

		const sale = await prisma.sale.findUnique({
			where: {
				id: saleId,
			},
		});

		expect(sale).toBeNull();

		const commissionsAfterDelete = await prisma.saleCommission.count({
			where: {
				saleId,
			},
		});
		expect(commissionsAfterDelete).toBe(0);
	});

	it("should return not found when sale does not exist", async () => {
		const fixture = await createFixture();

		const response = await request(app.server)
			.get(
				`/organizations/${fixture.org.slug}/sales/11111111-1111-4111-8111-111111111111`,
			)
			.set("Authorization", `Bearer ${fixture.token}`);

		expect(response.statusCode).toBe(400);
		expect(response.body.message).toBe("Sale not found");
	});
});
