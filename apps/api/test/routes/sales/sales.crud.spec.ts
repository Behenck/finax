import {
	CustomerDocumentType,
	CustomerPersonType,
	CustomerStatus,
	PartnerDocumentType,
	PartnerStatus,
	SaleStatus,
	SellerDocumentType,
	SellerStatus,
} from "generated/prisma/enums";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { makeUser } from "../../factories/make-user";
import { createTestApp } from "../../utils/test-app";

let app: Awaited<ReturnType<typeof createTestApp>>;

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
	beneficiaryId?: string;
	beneficiaryLabel?: string;
	startDate: string;
	totalPercentage: number;
	installments: Array<{
		installmentNumber: number;
		percentage: number;
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

	return {
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
		expect(commissions[1]?.beneficiaryLabel).toBe("Bônus Operacional");
		expect(commissions[1]?.installments.map((item) => item.amount)).toEqual([
			625,
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
				paymentDate: true,
			},
		});

		expect(installments.length).toBeGreaterThan(0);
		expect(installments.every((installment) => installment.status === "CANCELED")).toBe(
			true,
		);
		expect(
			installments.every((installment) => installment.paymentDate === null),
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
		expect(response.body.installments[0].expectedPaymentDate).toContain(
			"2026-03-10",
		);
		expect(response.body.installments[1].expectedPaymentDate).toContain(
			"2026-04-10",
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

		const installmentId = installmentsResponse.body.installments[0]?.id as string;
		expect(installmentId).toBeTruthy();

		const patchResponse = await request(app.server)
			.patch(
				`/organizations/${fixture.org.slug}/sales/${saleId}/commission-installments/${installmentId}/status`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				status: "PAID",
				paymentDate: "2026-03-21",
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
		expect(installment?.paymentDate?.toISOString().slice(0, 10)).toBe(
			"2026-03-21",
		);
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

		const installmentId = installmentsResponse.body.installments[0]?.id as string;

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

	it("should reject invalid status transition", async () => {
		const fixture = await createFixture();
		const saleId = await createSaleUsingApi(fixture);

		const response = await request(app.server)
			.patch(`/organizations/${fixture.org.slug}/sales/${saleId}/status`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				status: "COMPLETED",
			});

		expect(response.statusCode).toBe(400);
		expect(response.body.message).toBe(
			"Cannot change sale status from PENDING to COMPLETED",
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
