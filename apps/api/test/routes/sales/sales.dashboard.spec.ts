import {
	CustomerDocumentType,
	CustomerPersonType,
	CustomerStatus,
	PartnerDocumentType,
	PartnerStatus,
	ProductBonusMetric,
	ProductBonusParticipantType,
	ProductBonusPeriodFrequency,
	Role,
	SaleCommissionInstallmentStatus,
	SaleCommissionRecipientType,
	SaleCommissionSourceType,
	SaleResponsibleType,
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

type DashboardFixture = Awaited<ReturnType<typeof createFixture>>;

type CommissionInstallmentSeed = {
	direction: "INCOME" | "OUTCOME";
	amount: number;
	status: SaleCommissionInstallmentStatus;
	expectedPaymentDate: string;
	paymentDate?: string | null;
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

	const unit = await prisma.unit.create({
		data: {
			name: `Unit ${suffix}`,
			companyId: company.id,
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

	const productAlpha = await prisma.product.create({
		data: {
			organizationId: org.id,
			name: `Alpha ${suffix}`,
			description: "Alpha dashboard product",
			isActive: true,
		},
	});

	const productBeta = await prisma.product.create({
		data: {
			organizationId: org.id,
			name: `Beta ${suffix}`,
			description: "Beta dashboard product",
			isActive: true,
		},
	});

	const productGamma = await prisma.product.create({
		data: {
			organizationId: org.id,
			name: `Gamma ${suffix}`,
			description: "Gamma dashboard product",
			isActive: true,
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

	const sellerTwo = await prisma.seller.create({
		data: {
			name: `Seller Two ${suffix}`,
			email: `seller-two-${suffix}@example.com`,
			phone: "55999888888",
			documentType: SellerDocumentType.CPF,
			document: `333333333${Math.floor(Math.random() * 9)}`,
			companyName: "Seller Company",
			state: "RS",
			organizationId: org.id,
			status: SellerStatus.ACTIVE,
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

	const partnerTwo = await prisma.partner.create({
		data: {
			name: `Partner Two ${suffix}`,
			email: `partner-two-${suffix}@example.com`,
			phone: "55999666666",
			documentType: PartnerDocumentType.CPF,
			document: `555555555${Math.floor(Math.random() * 9)}`,
			companyName: "Partner Company",
			state: "RS",
			organizationId: org.id,
			status: PartnerStatus.ACTIVE,
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
			role: Role.SUPERVISOR,
			organizationId: org.id,
			userId: supervisorUser.id,
		},
	});

	return {
		token,
		org,
		user,
		company,
		unit,
		customer,
		productAlpha,
		productBeta,
		productGamma,
		seller,
		sellerTwo,
		partner,
		partnerTwo,
		supervisor,
	};
}

async function createSaleSeed(
	fixture: DashboardFixture,
	input: {
		saleDate: string;
		totalAmount: number;
		status: SaleStatus;
		productId: string;
		responsibleType: SaleResponsibleType;
		responsibleId: string;
		commissions?: CommissionInstallmentSeed[];
	},
) {
	return prisma.sale.create({
		data: {
			organizationId: fixture.org.id,
			companyId: fixture.company.id,
			unitId: fixture.unit.id,
			customerId: fixture.customer.id,
			productId: input.productId,
			saleDate: new Date(`${input.saleDate}T00:00:00.000Z`),
			totalAmount: input.totalAmount,
			status: input.status,
			responsibleType: input.responsibleType,
			responsibleId: input.responsibleId,
			notes: null,
			createdById: fixture.user.id,
			commissions: input.commissions?.length
				? {
						create: input.commissions.map((commission, index) => ({
							sourceType: SaleCommissionSourceType.MANUAL,
							recipientType: SaleCommissionRecipientType.OTHER,
							direction: commission.direction,
							beneficiaryLabel: `${commission.direction} ${index + 1}`,
							startDate: new Date(
								`${commission.expectedPaymentDate}T00:00:00.000Z`,
							),
							totalPercentage: 100_000,
							sortOrder: index,
							installments: {
								create: {
									installmentNumber: 1,
									percentage: 100_000,
									amount: commission.amount,
									status: commission.status,
									expectedPaymentDate: new Date(
										`${commission.expectedPaymentDate}T00:00:00.000Z`,
									),
									paymentDate: commission.paymentDate
										? new Date(`${commission.paymentDate}T00:00:00.000Z`)
										: null,
								},
							},
						})),
					}
				: undefined,
		},
	});
}

async function createBonusInstallmentSeed(
	fixture: DashboardFixture,
	input: {
		productId: string;
		amount: number;
		status: SaleCommissionInstallmentStatus;
		expectedPaymentDate: string;
		paymentDate?: string | null;
	},
) {
	const scenario = await prisma.productBonusScenario.create({
		data: {
			productId: input.productId,
			name: `Bonus ${Date.now()}-${Math.floor(Math.random() * 10_000)}`,
			metric: ProductBonusMetric.SALE_TOTAL,
			targetAmount: 100_000,
			periodFrequency: ProductBonusPeriodFrequency.MONTHLY,
			payoutEnabled: true,
		},
	});

	const settlement = await prisma.bonusSettlement.create({
		data: {
			organizationId: fixture.org.id,
			productId: input.productId,
			periodFrequency: ProductBonusPeriodFrequency.MONTHLY,
			periodYear: 2026,
			periodIndex: 3,
			settledById: fixture.user.id,
			winnersCount: 1,
		},
	});

	const result = await prisma.bonusSettlementResult.create({
		data: {
			settlementId: settlement.id,
			scenarioId: scenario.id,
			participantType: ProductBonusParticipantType.COMPANY,
			beneficiaryCompanyId: fixture.company.id,
			beneficiaryLabel: fixture.company.name,
			achievedAmount: input.amount,
			targetAmount: 100_000,
			payoutEnabled: true,
			payoutAmount: input.amount,
		},
	});

	await prisma.bonusInstallment.create({
		data: {
			organizationId: fixture.org.id,
			settlementId: settlement.id,
			resultId: result.id,
			scenarioId: scenario.id,
			productId: input.productId,
			scenarioName: scenario.name,
			periodFrequency: ProductBonusPeriodFrequency.MONTHLY,
			periodYear: 2026,
			periodIndex: 3,
			recipientType: SaleCommissionRecipientType.COMPANY,
			direction: "INCOME",
			beneficiaryCompanyId: fixture.company.id,
			beneficiaryLabel: fixture.company.name,
			installmentNumber: 1,
			percentage: 100_000,
			amount: input.amount,
			status: input.status,
			expectedPaymentDate: new Date(`${input.expectedPaymentDate}T00:00:00.000Z`),
			paymentDate: input.paymentDate
				? new Date(`${input.paymentDate}T00:00:00.000Z`)
				: null,
		},
	});
}

async function seedDashboardData(fixture: DashboardFixture) {
	await createSaleSeed(fixture, {
		saleDate: "2026-02-05",
		totalAmount: 100_000,
		status: SaleStatus.COMPLETED,
		productId: fixture.productAlpha.id,
		responsibleType: SaleResponsibleType.SELLER,
		responsibleId: fixture.seller.id,
		commissions: [
			{
				direction: "OUTCOME",
				amount: 10_000,
				status: SaleCommissionInstallmentStatus.PENDING,
				expectedPaymentDate: "2026-03-03",
			},
			{
				direction: "INCOME",
				amount: 9_000,
				status: SaleCommissionInstallmentStatus.PENDING,
				expectedPaymentDate: "2026-02-20",
			},
			{
				direction: "OUTCOME",
				amount: 4_000,
				status: SaleCommissionInstallmentStatus.PAID,
				expectedPaymentDate: "2026-02-25",
				paymentDate: "2026-02-27",
			},
		],
	});

	await createSaleSeed(fixture, {
		saleDate: "2026-03-02",
		totalAmount: 150_000,
		status: SaleStatus.APPROVED,
		productId: fixture.productAlpha.id,
		responsibleType: SaleResponsibleType.SELLER,
		responsibleId: fixture.seller.id,
		commissions: [
			{
				direction: "OUTCOME",
				amount: 15_000,
				status: SaleCommissionInstallmentStatus.PAID,
				expectedPaymentDate: "2026-03-08",
				paymentDate: "2026-04-01",
			},
		],
	});

	await createSaleSeed(fixture, {
		saleDate: "2026-03-10",
		totalAmount: 150_000,
		status: SaleStatus.COMPLETED,
		productId: fixture.productBeta.id,
		responsibleType: SaleResponsibleType.SELLER,
		responsibleId: fixture.seller.id,
		commissions: [
			{
				direction: "INCOME",
				amount: 5_000,
				status: SaleCommissionInstallmentStatus.CANCELED,
				expectedPaymentDate: "2026-03-12",
			},
		],
	});

	await createSaleSeed(fixture, {
		saleDate: "2026-03-20",
		totalAmount: 200_000,
		status: SaleStatus.PENDING,
		productId: fixture.productGamma.id,
		responsibleType: SaleResponsibleType.PARTNER,
		responsibleId: fixture.partner.id,
		commissions: [
			{
				direction: "INCOME",
				amount: 30_000,
				status: SaleCommissionInstallmentStatus.PENDING,
				expectedPaymentDate: "2026-04-02",
			},
		],
	});

	await createSaleSeed(fixture, {
		saleDate: "2026-03-25",
		totalAmount: 50_000,
		status: SaleStatus.APPROVED,
		productId: fixture.productAlpha.id,
		responsibleType: SaleResponsibleType.PARTNER,
		responsibleId: fixture.partnerTwo.id,
		commissions: [
			{
				direction: "INCOME",
				amount: 7_000,
				status: SaleCommissionInstallmentStatus.PAID,
				expectedPaymentDate: "2026-03-28",
				paymentDate: "2026-03-30",
			},
		],
	});

	await createSaleSeed(fixture, {
		saleDate: "2026-03-15",
		totalAmount: 500_000,
		status: SaleStatus.CANCELED,
		productId: fixture.productBeta.id,
		responsibleType: SaleResponsibleType.PARTNER,
		responsibleId: fixture.partnerTwo.id,
		commissions: [
			{
				direction: "OUTCOME",
				amount: 9_000,
				status: SaleCommissionInstallmentStatus.CANCELED,
				expectedPaymentDate: "2026-03-18",
			},
		],
	});
}

describe("sales dashboard", () => {
	beforeAll(async () => {
		app = await createTestApp();
	});

	afterAll(async () => {
		await app.close();
	});

	it(
		"should aggregate monthly sales and commissions for the dashboard",
		async () => {
			const fixture = await createFixture();
			await seedDashboardData(fixture);
			await createBonusInstallmentSeed(fixture, {
				productId: fixture.productAlpha.id,
				amount: 99_000,
				status: SaleCommissionInstallmentStatus.PENDING,
				expectedPaymentDate: "2026-03-10",
			});

			const response = await request(app.server)
				.get(`/organizations/${fixture.org.slug}/sales/dashboard`)
				.query({
					month: "2026-03",
				})
				.set("Authorization", `Bearer ${fixture.token}`);

			expect(response.statusCode).toBe(200);
			expect(response.body.period.selectedMonth).toBe("2026-03");
			expect(response.body.period.current.month).toBe("2026-03");
			expect(response.body.period.previous.month).toBe("2026-02");

			expect(response.body.sales.current).toEqual({
				count: 4,
				grossAmount: 550_000,
				averageTicket: 137_500,
			});
			expect(response.body.sales.previous).toEqual({
				count: 1,
				grossAmount: 100_000,
				averageTicket: 100_000,
			});
			expect(response.body.sales.preCancellation).toEqual({
				count: 0,
				threshold: null,
			});

			expect(response.body.sales.byStatus).toEqual({
				PENDING: {
					count: 1,
					amount: 200_000,
				},
				APPROVED: {
					count: 2,
					amount: 200_000,
				},
				COMPLETED: {
					count: 1,
					amount: 150_000,
				},
				CANCELED: {
					count: 1,
					amount: 500_000,
				},
			});

			expect(response.body.sales.timeline).toHaveLength(31);
			expect(
				response.body.sales.timeline.find(
					(item: { date: string }) => item.date.slice(0, 10) === "2026-03-02",
				),
			).toEqual({
				date: expect.stringContaining("2026-03-02"),
				count: 1,
				amount: 150_000,
			});
			expect(
				response.body.sales.timeline.find(
					(item: { date: string }) => item.date.slice(0, 10) === "2026-03-15",
				),
			).toEqual({
				date: expect.stringContaining("2026-03-15"),
				count: 0,
				amount: 0,
			});

			expect(response.body.sales.topProducts).toEqual([
				{
					id: fixture.productAlpha.id,
					name: fixture.productAlpha.name,
					count: 2,
					grossAmount: 200_000,
				},
				{
					id: fixture.productGamma.id,
					name: fixture.productGamma.name,
					count: 1,
					grossAmount: 200_000,
				},
				{
					id: fixture.productBeta.id,
					name: fixture.productBeta.name,
					count: 1,
					grossAmount: 150_000,
				},
			]);

			expect(response.body.sales.topResponsibles).toEqual([
				{
					id: fixture.seller.id,
					type: "SELLER",
					name: fixture.seller.name,
					count: 2,
					grossAmount: 300_000,
				},
				{
					id: fixture.partner.id,
					type: "PARTNER",
					name: fixture.partner.name,
					count: 1,
					grossAmount: 200_000,
				},
				{
					id: fixture.partnerTwo.id,
					type: "PARTNER",
					name: fixture.partnerTwo.name,
					count: 1,
					grossAmount: 50_000,
				},
			]);

			expect(response.body.commissions.reference).toBe("SALE_DATE");
			expect(response.body.commissions.current).toEqual({
				INCOME: {
					total: {
						count: 3,
						amount: 42_000,
					},
					pending: {
						count: 1,
						amount: 30_000,
					},
					paid: {
						count: 1,
						amount: 7_000,
					},
					canceled: {
						count: 1,
						amount: 5_000,
					},
					reversed: {
						count: 0,
						amount: 0,
					},
				},
				OUTCOME: {
					total: {
						count: 1,
						amount: 15_000,
					},
					pending: {
						count: 0,
						amount: 0,
					},
					paid: {
						count: 1,
						amount: 15_000,
					},
					canceled: {
						count: 0,
						amount: 0,
					},
					reversed: {
						count: 0,
						amount: 0,
					},
				},
				netAmount: 27_000,
			});
			expect(response.body.commissions.previous).toEqual({
				INCOME: {
					total: {
						count: 1,
						amount: 9_000,
					},
					pending: {
						count: 1,
						amount: 9_000,
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
				},
				OUTCOME: {
					total: {
						count: 2,
						amount: 14_000,
					},
					pending: {
						count: 1,
						amount: 10_000,
					},
					paid: {
						count: 1,
						amount: 4_000,
					},
					canceled: {
						count: 0,
						amount: 0,
					},
					reversed: {
						count: 0,
						amount: 0,
					},
				},
				netAmount: -5_000,
			});
		},
		20_000,
	);

	it("should return empty summaries and a full monthly timeline when there is no data", async () => {
		const fixture = await createFixture();

		const response = await request(app.server)
			.get(`/organizations/${fixture.org.slug}/sales/dashboard`)
			.query({
				month: "2026-04",
			})
			.set("Authorization", `Bearer ${fixture.token}`);

		expect(response.statusCode).toBe(200);
		expect(response.body.sales.current).toEqual({
			count: 0,
			grossAmount: 0,
			averageTicket: 0,
		});
		expect(response.body.sales.previous).toEqual({
			count: 0,
			grossAmount: 0,
			averageTicket: 0,
		});
		expect(response.body.sales.preCancellation).toEqual({
			count: 0,
			threshold: null,
		});
		expect(response.body.sales.timeline).toHaveLength(30);
		expect(
			response.body.sales.timeline.every(
				(item: { count: number; amount: number }) =>
					item.count === 0 && item.amount === 0,
			),
		).toBe(true);
		expect(response.body.sales.topProducts).toEqual([]);
		expect(response.body.sales.topResponsibles).toEqual([]);
		expect(response.body.commissions.current.netAmount).toBe(0);
		expect(response.body.commissions.previous.netAmount).toBe(0);
	});

	it("should count only sales with open delinquencies at or above the configured threshold", async () => {
		const fixture = await createFixture();
		await seedDashboardData(fixture);

		await prisma.organization.update({
			where: {
				id: fixture.org.id,
			},
			data: {
				preCancellationDelinquencyThreshold: 2,
			},
		});

		const [completedBetaSale, approvedAlphaSale] = await Promise.all([
			prisma.sale.findFirstOrThrow({
				where: {
					organizationId: fixture.org.id,
					productId: fixture.productBeta.id,
					status: "COMPLETED",
				},
				select: {
					id: true,
				},
			}),
			prisma.sale.findFirstOrThrow({
				where: {
					organizationId: fixture.org.id,
					productId: fixture.productAlpha.id,
					status: "APPROVED",
				},
				select: {
					id: true,
				},
			}),
		]);

		await prisma.saleDelinquency.createMany({
			data: [
				{
					saleId: completedBetaSale.id,
					organizationId: fixture.org.id,
					dueDate: new Date("2026-03-05T00:00:00.000Z"),
					createdById: fixture.user.id,
				},
				{
					saleId: completedBetaSale.id,
					organizationId: fixture.org.id,
					dueDate: new Date("2026-03-20T00:00:00.000Z"),
					createdById: fixture.user.id,
				},
				{
					saleId: approvedAlphaSale.id,
					organizationId: fixture.org.id,
					dueDate: new Date("2026-03-08T00:00:00.000Z"),
					createdById: fixture.user.id,
					resolvedAt: new Date("2026-03-12T00:00:00.000Z"),
					resolvedById: fixture.user.id,
				},
				{
					saleId: approvedAlphaSale.id,
					organizationId: fixture.org.id,
					dueDate: new Date("2026-03-18T00:00:00.000Z"),
					createdById: fixture.user.id,
				},
			],
		});

		const response = await request(app.server)
			.get(`/organizations/${fixture.org.slug}/sales/dashboard`)
			.query({
				month: "2026-03",
			})
			.set("Authorization", `Bearer ${fixture.token}`);

		expect(response.statusCode).toBe(200);
		expect(response.body.sales.preCancellation).toEqual({
			count: 1,
			threshold: 2,
		});
	});
});
