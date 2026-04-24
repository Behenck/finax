import { randomUUID } from "node:crypto";
import { hash } from "bcryptjs";
import {
	CustomerDocumentType,
	CustomerPersonType,
	CustomerStatus,
	MemberDataScope,
	PartnerDocumentType,
	PartnerStatus,
	PermissionOverrideEffect,
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
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { makeUser } from "../../factories/make-user";
import { createTestApp } from "../../utils/test-app";

let app: Awaited<ReturnType<typeof createTestApp>>;

const ASSET_TYPE_FIELD_ID = randomUUID();
const COVERAGE_FIELD_ID = randomUUID();
const ASSET_TYPE_PROPERTY_OPTION_ID = randomUUID();
const ASSET_TYPE_VEHICLE_OPTION_ID = randomUUID();
const COVERAGE_INSURED_OPTION_ID = randomUUID();
const COVERAGE_UNINSURED_OPTION_ID = randomUUID();

const dynamicFieldSchema = [
	{
		fieldId: ASSET_TYPE_FIELD_ID,
		label: "Tipo de bem",
		type: "SELECT",
		required: false,
		options: [
			{ id: ASSET_TYPE_PROPERTY_OPTION_ID, label: "Imóvel" },
			{ id: ASSET_TYPE_VEHICLE_OPTION_ID, label: "Veículo" },
		],
	},
	{
		fieldId: COVERAGE_FIELD_ID,
		label: "Cobertura",
		type: "MULTI_SELECT",
		required: false,
		options: [
			{ id: COVERAGE_INSURED_OPTION_ID, label: "Com seguro" },
			{ id: COVERAGE_UNINSURED_OPTION_ID, label: "Sem seguro" },
		],
	},
] as const;

type PartnerDashboardFixture = Awaited<ReturnType<typeof createFixture>>;

type CommissionInstallmentSeed = {
	direction: "INCOME" | "OUTCOME";
	amount: number;
	status: SaleCommissionInstallmentStatus;
	expectedPaymentDate: string;
	paymentDate?: string | null;
	recipientType?: SaleCommissionRecipientType;
	beneficiarySupervisorId?: string | null;
};

async function login(email: string, password: string) {
	const response = await request(app.server).post("/sessions/password").send({
		email,
		password,
	});

	expect(response.statusCode).toBe(200);
	return response.body.accessToken as string;
}

async function createFixture() {
	const { user, org } = await makeUser();
	const token = await login(user.email, user.password);
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

	const parentProduct = await prisma.product.create({
		data: {
			organizationId: org.id,
			name: `Consórcio ${suffix}`,
			description: "Partner dashboard parent product",
			isActive: true,
		},
	});

	const subproductAuto = await prisma.product.create({
		data: {
			organizationId: org.id,
			parentId: parentProduct.id,
			name: `Auto ${suffix}`,
			description: "Partner dashboard child product",
			isActive: true,
		},
	});

	const subproductHeavy = await prisma.product.create({
		data: {
			organizationId: org.id,
			parentId: subproductAuto.id,
			name: `Pesado ${suffix}`,
			description: "Partner dashboard grandchild product",
			isActive: true,
		},
	});

	const subproductProperty = await prisma.product.create({
		data: {
			organizationId: org.id,
			parentId: parentProduct.id,
			name: `Imóvel ${suffix}`,
			description: "Partner dashboard child product",
			isActive: true,
		},
	});

	const seller = await prisma.seller.create({
		data: {
			name: `Seller ${suffix}`,
			email: `seller-${suffix}@example.com`,
			phone: "55999999999",
			documentType: SellerDocumentType.CPF,
			document: `111111111${Math.floor(Math.random() * 9)}`,
			companyName: "Seller Company",
			state: "RS",
			organizationId: org.id,
			status: SellerStatus.ACTIVE,
		},
	});

	const supervisorPassword = "123456";
	const supervisorUser = await prisma.user.create({
		data: {
			name: `Supervisor ${suffix}`,
			email: `supervisor-${suffix}@example.com`,
			passwordHash: await hash(supervisorPassword, 6),
			emailVerifiedAt: new Date(),
		},
	});

	const supervisorMember = await prisma.member.create({
		data: {
			role: Role.SUPERVISOR,
			organizationId: org.id,
			userId: supervisorUser.id,
			salesScope: MemberDataScope.LINKED_ONLY,
			partnersScope: MemberDataScope.LINKED_ONLY,
			customersScope: MemberDataScope.LINKED_ONLY,
			commissionsScope: MemberDataScope.LINKED_ONLY,
		},
	});

	const viewAllPermissions = await prisma.permission.findMany({
		where: {
			key: {
				in: ["sales.view.all", "registers.partners.view.all"],
			},
		},
		select: {
			id: true,
		},
	});

	await prisma.memberPermissionOverride.createMany({
		data: viewAllPermissions.map((permission) => ({
			memberId: supervisorMember.id,
			organizationId: org.id,
			permissionId: permission.id,
			effect: PermissionOverrideEffect.DENY,
		})),
	});
	const supervisorToken = await login(supervisorUser.email, supervisorPassword);

	const partnerAlpha = await prisma.partner.create({
		data: {
			name: `Partner Alpha ${suffix}`,
			email: `partner-alpha-${suffix}@example.com`,
			phone: "55999888888",
			documentType: PartnerDocumentType.CPF,
			document: `222222222${Math.floor(Math.random() * 9)}`,
			companyName: "Alpha Seguros",
			state: "RS",
			organizationId: org.id,
			status: PartnerStatus.ACTIVE,
		},
	});

	const partnerBeta = await prisma.partner.create({
		data: {
			name: `Partner Beta ${suffix}`,
			email: `partner-beta-${suffix}@example.com`,
			phone: "55999777777",
			documentType: PartnerDocumentType.CPF,
			document: `333333333${Math.floor(Math.random() * 9)}`,
			companyName: "Beta Beneficios",
			state: "RS",
			organizationId: org.id,
			status: PartnerStatus.INACTIVE,
		},
	});

	const partnerGamma = await prisma.partner.create({
		data: {
			name: `Partner Gamma ${suffix}`,
			email: `partner-gamma-${suffix}@example.com`,
			phone: "55999666666",
			documentType: PartnerDocumentType.CPF,
			document: `444444444${Math.floor(Math.random() * 9)}`,
			companyName: "Gamma Corretora",
			state: "RS",
			organizationId: org.id,
			status: PartnerStatus.ACTIVE,
		},
	});

	await prisma.partnerSupervisor.createMany({
		data: [partnerAlpha, partnerBeta].map((partner) => ({
			organizationId: org.id,
			partnerId: partner.id,
			supervisorId: supervisorUser.id,
		})),
	});

	return {
		org,
		user,
		token,
		supervisorUser,
		supervisorMember,
		supervisorToken,
		company,
		unit,
		customer,
		parentProduct,
		subproductAuto,
		subproductHeavy,
		subproductProperty,
		seller,
		partnerAlpha,
		partnerBeta,
		partnerGamma,
	};
}

async function createSaleSeed(
	fixture: PartnerDashboardFixture,
	input: {
		saleDate: string;
		totalAmount: number;
		status: SaleStatus;
		responsibleType: SaleResponsibleType;
		responsibleId: string;
		productId?: string;
		dynamicFieldValues?: Record<string, unknown>;
		commissions?: CommissionInstallmentSeed[];
	},
) {
	return prisma.sale.create({
		data: {
			organizationId: fixture.org.id,
			companyId: fixture.company.id,
			unitId: fixture.unit.id,
			customerId: fixture.customer.id,
			productId: input.productId ?? fixture.parentProduct.id,
			saleDate: new Date(`${input.saleDate}T00:00:00.000Z`),
			totalAmount: input.totalAmount,
			status: input.status,
			responsibleType: input.responsibleType,
			responsibleId: input.responsibleId,
			notes: null,
			createdById: fixture.user.id,
			dynamicFieldSchema: dynamicFieldSchema,
			dynamicFieldValues: input.dynamicFieldValues ?? {},
			commissions: input.commissions?.length
				? {
						create: input.commissions.map((commission, index) => {
							const recipientType =
								commission.recipientType ?? SaleCommissionRecipientType.OTHER;

							return {
								sourceType: SaleCommissionSourceType.MANUAL,
								recipientType,
								direction: commission.direction,
								beneficiarySupervisorId:
									recipientType === SaleCommissionRecipientType.SUPERVISOR
										? (commission.beneficiarySupervisorId ?? null)
										: null,
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
							};
						}),
					}
				: undefined,
		},
	});
}

async function seedDashboardData(fixture: PartnerDashboardFixture) {
	const saleAlpha1 = await createSaleSeed(fixture, {
		saleDate: "2026-02-10",
		totalAmount: 100_000,
		status: SaleStatus.COMPLETED,
		responsibleType: SaleResponsibleType.PARTNER,
		responsibleId: fixture.partnerAlpha.id,
		productId: fixture.subproductHeavy.id,
		dynamicFieldValues: {
			[ASSET_TYPE_FIELD_ID]: ASSET_TYPE_PROPERTY_OPTION_ID,
			[COVERAGE_FIELD_ID]: [COVERAGE_INSURED_OPTION_ID],
		},
		commissions: [
			{
				direction: "INCOME",
				amount: 10_000,
				status: SaleCommissionInstallmentStatus.PAID,
				expectedPaymentDate: "2026-02-15",
				paymentDate: "2026-02-15",
			},
			{
				direction: "OUTCOME",
				amount: 3_000,
				status: SaleCommissionInstallmentStatus.PAID,
				expectedPaymentDate: "2026-02-20",
				paymentDate: "2026-02-20",
			},
			{
				direction: "INCOME",
				amount: 4_000,
				status: SaleCommissionInstallmentStatus.PENDING,
				expectedPaymentDate: "2026-04-05",
			},
			{
				direction: "OUTCOME",
				amount: 2_500,
				status: SaleCommissionInstallmentStatus.PENDING,
				expectedPaymentDate: "2026-04-05",
				recipientType: SaleCommissionRecipientType.SUPERVISOR,
				beneficiarySupervisorId: fixture.supervisorMember.id,
			},
			{
				direction: "INCOME",
				amount: 6_000,
				status: SaleCommissionInstallmentStatus.PENDING,
				expectedPaymentDate: "2026-05-10",
			},
		],
	});

	await prisma.saleDelinquency.create({
		data: {
			saleId: saleAlpha1.id,
			organizationId: fixture.org.id,
			dueDate: new Date("2026-03-01T00:00:00.000Z"),
			createdById: fixture.user.id,
		},
	});

	await createSaleSeed(fixture, {
		saleDate: "2026-03-05",
		totalAmount: 50_000,
		status: SaleStatus.APPROVED,
		responsibleType: SaleResponsibleType.PARTNER,
		responsibleId: fixture.partnerAlpha.id,
		productId: fixture.subproductProperty.id,
		dynamicFieldValues: {
			[ASSET_TYPE_FIELD_ID]: ASSET_TYPE_VEHICLE_OPTION_ID,
			[COVERAGE_FIELD_ID]: [
				COVERAGE_INSURED_OPTION_ID,
				COVERAGE_UNINSURED_OPTION_ID,
			],
		},
		commissions: [
			{
				direction: "INCOME",
				amount: 5_000,
				status: SaleCommissionInstallmentStatus.PAID,
				expectedPaymentDate: "2026-03-07",
				paymentDate: "2026-03-07",
			},
		],
	});

	await createSaleSeed(fixture, {
		saleDate: "2026-04-01",
		totalAmount: 80_000,
		status: SaleStatus.PENDING,
		responsibleType: SaleResponsibleType.PARTNER,
		responsibleId: fixture.partnerBeta.id,
		productId: fixture.parentProduct.id,
		dynamicFieldValues: {
			[ASSET_TYPE_FIELD_ID]: ASSET_TYPE_PROPERTY_OPTION_ID,
			[COVERAGE_FIELD_ID]: [COVERAGE_INSURED_OPTION_ID],
		},
	});

	await createSaleSeed(fixture, {
		saleDate: "2025-12-15",
		totalAmount: 70_000,
		status: SaleStatus.COMPLETED,
		responsibleType: SaleResponsibleType.PARTNER,
		responsibleId: fixture.partnerGamma.id,
		productId: fixture.subproductProperty.id,
		dynamicFieldValues: {
			[ASSET_TYPE_FIELD_ID]: ASSET_TYPE_VEHICLE_OPTION_ID,
			[COVERAGE_FIELD_ID]: [COVERAGE_UNINSURED_OPTION_ID],
		},
	});

	await createSaleSeed(fixture, {
		saleDate: "2026-03-10",
		totalAmount: 999_999,
		status: SaleStatus.COMPLETED,
		responsibleType: SaleResponsibleType.SELLER,
		responsibleId: fixture.seller.id,
		productId: fixture.subproductAuto.id,
		dynamicFieldValues: {
			[ASSET_TYPE_FIELD_ID]: ASSET_TYPE_VEHICLE_OPTION_ID,
		},
	});
}

describe("partner sales dashboard", () => {
	beforeAll(async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-04-08T12:00:00.000Z"));
		app = await createTestApp();
	});

	afterAll(async () => {
		await app.close();
		vi.useRealTimers();
	});

	it(
		"should aggregate partner production, commissions, ranking and delinquency",
		async () => {
			const fixture = await createFixture();
			await seedDashboardData(fixture);
			await prisma.organization.update({
				where: {
					id: fixture.org.id,
				},
				data: {
					preCancellationDelinquencyThreshold: 3,
				},
			});

			const delinquentSale = await prisma.sale.findFirst({
				where: {
					organizationId: fixture.org.id,
					responsibleId: fixture.partnerAlpha.id,
					saleDate: new Date("2026-02-10T00:00:00.000Z"),
				},
				select: {
					id: true,
				},
			});

			expect(delinquentSale?.id).toBeTruthy();

			await prisma.saleDelinquency.createMany({
				data: [
					{
						saleId: delinquentSale!.id,
						organizationId: fixture.org.id,
						dueDate: new Date("2026-03-15T00:00:00.000Z"),
						createdById: fixture.user.id,
					},
					{
						saleId: delinquentSale!.id,
						organizationId: fixture.org.id,
						dueDate: new Date("2026-03-20T00:00:00.000Z"),
						createdById: fixture.user.id,
					},
				],
			});

			const response = await request(app.server)
				.get(`/organizations/${fixture.org.slug}/sales/dashboard/partners`)
				.query({
					startDate: "2026-01-01",
					endDate: "2026-04-08",
					inactiveMonths: 3,
					dynamicFieldId: ASSET_TYPE_FIELD_ID,
				})
				.set("Authorization", `Bearer ${fixture.token}`);

			expect(response.statusCode).toBe(200);
			expect(response.body.summary).toEqual({
				totalPartners: 3,
				activePartners: 2,
				inactivePartners: 1,
				producingPartners: 2,
				producingPartnersRatePct: 66.67,
				partnersWithoutProduction: 1,
				totalSales: 3,
				grossAmount: 230_000,
				averageTicket: 76_667,
				averageTicketPerProducingPartner: 115_000,
				commissionReceivedAmount: 15_000,
				commissionPendingAmount: 10_000,
				netRevenueAmount: 12_000,
				delinquentSalesCount: 1,
				delinquentGrossAmount: 100_000,
				delinquencyRateByCountPct: 33.33,
				delinquencyRateByAmountPct: 43.48,
			});
			expect(response.body.period.timelineGranularity).toBe("MONTH");
			expect(response.body.timeline).toEqual([
			{
				label: "01/2026",
				date: expect.stringContaining("2026-01-01"),
				salesCount: 0,
				grossAmount: 0,
				concludedGrossAmount: 0,
				processedGrossAmount: 0,
				concludedAndProcessedGrossAmount: 0,
				canceledGrossAmount: 0,
			},
			{
				label: "02/2026",
				date: expect.stringContaining("2026-02-01"),
				salesCount: 1,
				grossAmount: 100_000,
				concludedGrossAmount: 100_000,
				processedGrossAmount: 0,
				concludedAndProcessedGrossAmount: 100_000,
				canceledGrossAmount: 0,
			},
			{
				label: "03/2026",
				date: expect.stringContaining("2026-03-01"),
				salesCount: 1,
				grossAmount: 50_000,
				concludedGrossAmount: 50_000,
				processedGrossAmount: 0,
				concludedAndProcessedGrossAmount: 50_000,
				canceledGrossAmount: 0,
			},
			{
				label: "04/2026",
				date: expect.stringContaining("2026-04-01"),
				salesCount: 1,
				grossAmount: 80_000,
				concludedGrossAmount: 0,
				processedGrossAmount: 80_000,
				concludedAndProcessedGrossAmount: 80_000,
				canceledGrossAmount: 0,
			},
		]);
		expect(response.body.filters.supervisors).toEqual([
			{
				id: fixture.supervisorUser.id,
				name: fixture.supervisorUser.name,
			},
		]);
		expect(response.body.filters.partners).toHaveLength(3);
		expect(response.body.filters.partners).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: fixture.partnerAlpha.id,
					partnerName: fixture.partnerAlpha.name,
					partnerCompanyName: fixture.partnerAlpha.companyName,
				}),
			]),
		);
		expect(response.body.ranking.slice(0, 3)).toEqual([
			{
				partnerId: fixture.partnerAlpha.id,
				partnerName: fixture.partnerAlpha.name,
				partnerCompanyName: fixture.partnerAlpha.companyName,
				status: "ACTIVE",
				supervisors: [
					{
						id: fixture.supervisorUser.id,
						name: fixture.supervisorUser.name,
					},
				],
				salesCount: 2,
				grossAmount: 150_000,
				averageTicket: 75_000,
				commissionReceivedAmount: 15_000,
				netRevenueAmount: 12_000,
				delinquentSalesCount: 1,
				delinquentGrossAmount: 100_000,
				delinquencyRateByCountPct: 50,
				delinquencyRateByAmountPct: 66.67,
				lastSaleDate: expect.stringContaining("2026-03-05"),
				salesBreakdown: {
					concluded: {
						salesCount: 2,
						grossAmount: 150_000,
					},
					pending: {
						salesCount: 0,
						grossAmount: 0,
					},
					canceled: {
						salesCount: 0,
						grossAmount: 0,
					},
				},
			},
			{
				partnerId: fixture.partnerBeta.id,
				partnerName: fixture.partnerBeta.name,
				partnerCompanyName: fixture.partnerBeta.companyName,
				status: "INACTIVE",
				supervisors: [
					{
						id: fixture.supervisorUser.id,
						name: fixture.supervisorUser.name,
					},
				],
				salesCount: 1,
				grossAmount: 80_000,
				averageTicket: 80_000,
				commissionReceivedAmount: 0,
				netRevenueAmount: 0,
				delinquentSalesCount: 0,
				delinquentGrossAmount: 0,
				delinquencyRateByCountPct: 0,
				delinquencyRateByAmountPct: 0,
				lastSaleDate: expect.stringContaining("2026-04-01"),
				salesBreakdown: {
					concluded: {
						salesCount: 0,
						grossAmount: 0,
					},
					pending: {
						salesCount: 1,
						grossAmount: 80_000,
					},
					canceled: {
						salesCount: 0,
						grossAmount: 0,
					},
				},
			},
			{
				partnerId: fixture.partnerGamma.id,
				partnerName: fixture.partnerGamma.name,
				partnerCompanyName: fixture.partnerGamma.companyName,
				status: "ACTIVE",
				supervisors: [],
				salesCount: 0,
				grossAmount: 0,
				averageTicket: 0,
				commissionReceivedAmount: 0,
				netRevenueAmount: 0,
				delinquentSalesCount: 0,
				delinquentGrossAmount: 0,
				delinquencyRateByCountPct: 0,
				delinquencyRateByAmountPct: 0,
				lastSaleDate: null,
				salesBreakdown: {
					concluded: {
						salesCount: 0,
						grossAmount: 0,
					},
					pending: {
						salesCount: 0,
						grossAmount: 0,
					},
					canceled: {
						salesCount: 0,
						grossAmount: 0,
					},
				},
			},
		]);
		expect(response.body.statusFunnel).toEqual({
			items: [
				{
					status: "PENDING",
					label: "Pendente",
					salesCount: 1,
					grossAmount: 80_000,
				},
				{
					status: "APPROVED",
					label: "Aprovada",
					salesCount: 1,
					grossAmount: 50_000,
				},
				{
					status: "COMPLETED",
					label: "Concluída",
					salesCount: 1,
					grossAmount: 100_000,
				},
				{
					status: "CANCELED",
					label: "Cancelada",
					salesCount: 0,
					grossAmount: 0,
				},
			],
		});
		expect(response.body.pareto).toEqual({
			items: [
				{
					partnerId: fixture.partnerAlpha.id,
					partnerName: fixture.partnerAlpha.name,
					partnerCompanyName: fixture.partnerAlpha.companyName,
					salesCount: 2,
					grossAmount: 150_000,
					cumulativeGrossAmount: 150_000,
					cumulativeGrossPct: 65.22,
					cumulativeSalesPct: 66.67,
				},
				{
					partnerId: fixture.partnerBeta.id,
					partnerName: fixture.partnerBeta.name,
					partnerCompanyName: fixture.partnerBeta.companyName,
					salesCount: 1,
					grossAmount: 80_000,
					cumulativeGrossAmount: 230_000,
					cumulativeGrossPct: 100,
					cumulativeSalesPct: 100,
				},
			],
		});
		expect(response.body.ticketByPartner).toEqual({
			items: [
				{
					partnerId: fixture.partnerBeta.id,
					partnerName: fixture.partnerBeta.name,
					partnerCompanyName: fixture.partnerBeta.companyName,
					salesCount: 1,
					grossAmount: 80_000,
					averageTicket: 80_000,
				},
				{
					partnerId: fixture.partnerAlpha.id,
					partnerName: fixture.partnerAlpha.name,
					partnerCompanyName: fixture.partnerAlpha.companyName,
					salesCount: 2,
					grossAmount: 150_000,
					averageTicket: 75_000,
				},
			],
		});
		expect(response.body.productionHealthTimeline.items).toEqual([
			{
				date: expect.stringContaining("2026-01-01"),
				label: "01/2026",
				producingPartners: 0,
				totalPartners: 3,
				producingRatePct: 0,
			},
			{
				date: expect.stringContaining("2026-02-01"),
				label: "02/2026",
				producingPartners: 1,
				totalPartners: 3,
				producingRatePct: 33.33,
			},
			{
				date: expect.stringContaining("2026-03-01"),
				label: "03/2026",
				producingPartners: 1,
				totalPartners: 3,
				producingRatePct: 33.33,
			},
			{
				date: expect.stringContaining("2026-04-01"),
				label: "04/2026",
				producingPartners: 1,
				totalPartners: 3,
				producingRatePct: 33.33,
			},
		]);
			expect(response.body.commissionBreakdown).toEqual({
				receivedAmount: 15_000,
				pendingAmount: 10_000,
				canceledAmount: 0,
				payablePaidAmount: 3_000,
				payablePendingAmount: 2_500,
				payableCanceledAmount: 0,
				netRevenueAmount: 12_000,
				pendingByPartner: {
					items: [
						{
							partnerId: fixture.partnerAlpha.id,
							partnerName: fixture.partnerAlpha.name,
							partnerCompanyName: fixture.partnerAlpha.companyName,
							status: "ACTIVE",
							supervisors: [
								{
									id: fixture.supervisorUser.id,
									name: fixture.supervisorUser.name,
								},
							],
							salesCount: 2,
							grossAmount: 150_000,
							pendingAmount: 10_000,
							lastSaleDate: expect.stringContaining("2026-03-05"),
						},
					],
				},
			});
			expect(response.body.dynamicFieldBreakdown).toEqual({
			availableFields: [
				{
					fieldId: COVERAGE_FIELD_ID,
					label: "Cobertura",
					type: "MULTI_SELECT",
				},
				{
					fieldId: ASSET_TYPE_FIELD_ID,
					label: "Tipo de bem",
					type: "SELECT",
				},
			],
			selectedFieldId: ASSET_TYPE_FIELD_ID,
			selectedFieldLabel: "Tipo de bem",
			selectedFieldType: "SELECT",
			items: [
				{
					valueId: ASSET_TYPE_PROPERTY_OPTION_ID,
					label: "Imóvel",
					salesCount: 2,
					grossAmount: 180_000,
				},
				{
					valueId: ASSET_TYPE_VEHICLE_OPTION_ID,
					label: "Veículo",
					salesCount: 1,
					grossAmount: 50_000,
				},
			],
		});
		expect(response.body.productBreakdown).toEqual({
			items: [
				{
					valueId: fixture.subproductAuto.id,
					label: `${fixture.parentProduct.name} -> ${fixture.subproductAuto.name}`,
					salesCount: 1,
					grossAmount: 100_000,
				},
				{
					valueId: `ROOT:${fixture.parentProduct.id}`,
					label: `${fixture.parentProduct.name} (Somente produto pai)`,
					salesCount: 1,
					grossAmount: 80_000,
				},
				{
					valueId: fixture.subproductProperty.id,
					label: `${fixture.parentProduct.name} -> ${fixture.subproductProperty.name}`,
					salesCount: 1,
					grossAmount: 50_000,
				},
			],
		});

		const allLevelsResponse = await request(app.server)
			.get(`/organizations/${fixture.org.slug}/sales/dashboard/partners`)
			.query({
				startDate: "2026-01-01",
				endDate: "2026-04-08",
				inactiveMonths: 3,
				productBreakdownDepth: "ALL_LEVELS",
			})
			.set("Authorization", `Bearer ${fixture.token}`);

		expect(allLevelsResponse.statusCode).toBe(200);
		expect(allLevelsResponse.body.productBreakdown).toEqual({
			items: [
				{
					valueId: fixture.subproductHeavy.id,
					label: `${fixture.parentProduct.name} -> ${fixture.subproductAuto.name} -> ${fixture.subproductHeavy.name}`,
					salesCount: 1,
					grossAmount: 100_000,
				},
				{
					valueId: fixture.parentProduct.id,
					label: `${fixture.parentProduct.name} (Somente produto pai)`,
					salesCount: 1,
					grossAmount: 80_000,
				},
				{
					valueId: fixture.subproductProperty.id,
					label: `${fixture.parentProduct.name} -> ${fixture.subproductProperty.name}`,
					salesCount: 1,
					grossAmount: 50_000,
				},
			],
		});
		expect(response.body.delinquencyBreakdown).toEqual({
			totalSales: 1,
			preCancellation: {
				threshold: 3,
				salesCount: 1,
				grossAmount: 100_000,
			},
			buckets: [
				{
					key: "OPEN_COUNT_1",
					label: "1 inadimplência",
					salesCount: 0,
					grossAmount: 0,
				},
				{
					key: "OPEN_COUNT_2",
					label: "2 inadimplências",
					salesCount: 0,
					grossAmount: 0,
				},
				{
					key: "PRE_CANCELLATION",
					label: "Pré-cancelamento",
					salesCount: 1,
					grossAmount: 100_000,
				},
			],
		});
		expect(response.body.recencyBreakdown).toEqual({
			buckets: [
				{
					key: "RANGE_0_30",
					label: "0 a 30 dias",
					partnersCount: 1,
				},
				{
					key: "RANGE_31_60",
					label: "31 a 60 dias",
					partnersCount: 1,
				},
				{
					key: "RANGE_61_90",
					label: "61 a 90 dias",
					partnersCount: 0,
				},
				{
					key: "RANGE_90_PLUS",
					label: "90+ dias",
					partnersCount: 1,
				},
				{
					key: "NO_SALES",
					label: "Sem vendas",
					partnersCount: 0,
				},
			],
		});
		expect(response.body.riskRanking.items.slice(0, 3)).toEqual([
			{
				partnerId: fixture.partnerAlpha.id,
				partnerName: fixture.partnerAlpha.name,
				partnerCompanyName: fixture.partnerAlpha.companyName,
				status: "ACTIVE",
				supervisors: [
					{
						id: fixture.supervisorUser.id,
						name: fixture.supervisorUser.name,
					},
				],
				totalSales: 2,
				grossAmount: 150_000,
				delinquentSalesCount: 1,
				delinquentGrossAmount: 100_000,
				delinquencyRateByCountPct: 50,
				delinquencyRateByAmountPct: 66.67,
				lastSaleDate: expect.stringContaining("2026-03-05"),
			},
			{
				partnerId: fixture.partnerBeta.id,
				partnerName: fixture.partnerBeta.name,
				partnerCompanyName: fixture.partnerBeta.companyName,
				status: "INACTIVE",
				supervisors: [
					{
						id: fixture.supervisorUser.id,
						name: fixture.supervisorUser.name,
					},
				],
				totalSales: 1,
				grossAmount: 80_000,
				delinquentSalesCount: 0,
				delinquentGrossAmount: 0,
				delinquencyRateByCountPct: 0,
				delinquencyRateByAmountPct: 0,
				lastSaleDate: expect.stringContaining("2026-04-01"),
			},
			{
				partnerId: fixture.partnerGamma.id,
				partnerName: fixture.partnerGamma.name,
				partnerCompanyName: fixture.partnerGamma.companyName,
				status: "ACTIVE",
				supervisors: [],
				totalSales: 0,
				grossAmount: 0,
				delinquentSalesCount: 0,
				delinquentGrossAmount: 0,
				delinquencyRateByCountPct: 0,
				delinquencyRateByAmountPct: 0,
				lastSaleDate: expect.stringContaining("2025-12-15"),
			},
		]);
		},
		20_000,
	);

	it("should include canceled sales in timeline series without affecting valid summary", async () => {
		const fixture = await createFixture();
		await seedDashboardData(fixture);

		await createSaleSeed(fixture, {
			saleDate: "2026-03-20",
			totalAmount: 40_000,
			status: SaleStatus.CANCELED,
			responsibleType: SaleResponsibleType.PARTNER,
			responsibleId: fixture.partnerBeta.id,
			productId: fixture.subproductAuto.id,
		});

		const response = await request(app.server)
			.get(`/organizations/${fixture.org.slug}/sales/dashboard/partners`)
			.query({
				startDate: "2026-01-01",
				endDate: "2026-04-08",
				inactiveMonths: 3,
			})
			.set("Authorization", `Bearer ${fixture.token}`);

		expect(response.statusCode).toBe(200);
		expect(response.body.summary.totalSales).toBe(3);
		expect(response.body.summary.grossAmount).toBe(230_000);

		const marchBucket = response.body.timeline.find(
			(item: { label: string }) => item.label === "03/2026",
		);
		expect(marchBucket).toEqual({
			label: "03/2026",
			date: expect.stringContaining("2026-03-01"),
			salesCount: 1,
			grossAmount: 50_000,
			concludedGrossAmount: 50_000,
			processedGrossAmount: 0,
			concludedAndProcessedGrossAmount: 50_000,
			canceledGrossAmount: 40_000,
		});

		const canceledStatus = response.body.statusFunnel.items.find(
			(item: { status: string }) => item.status === "CANCELED",
		);
		expect(canceledStatus).toEqual({
			status: "CANCELED",
			label: "Cancelada",
			salesCount: 1,
			grossAmount: 40_000,
		});
	});

	it("should ignore commission installments when the sale is outside the filtered period", async () => {
		const fixture = await createFixture();
		await seedDashboardData(fixture);

		const response = await request(app.server)
			.get(`/organizations/${fixture.org.slug}/sales/dashboard/partners`)
			.query({
				startDate: "2026-04-01",
				endDate: "2026-04-30",
				inactiveMonths: 3,
				partnerIds: fixture.partnerAlpha.id,
			})
			.set("Authorization", `Bearer ${fixture.token}`);

		expect(response.statusCode).toBe(200);
		expect(response.body.summary.totalSales).toBe(0);
		expect(response.body.summary.grossAmount).toBe(0);
		expect(response.body.summary.commissionReceivedAmount).toBe(0);
		expect(response.body.summary.commissionPendingAmount).toBe(0);
		expect(response.body.summary.netRevenueAmount).toBe(0);
		expect(response.body.commissionBreakdown).toEqual({
			receivedAmount: 0,
			pendingAmount: 0,
			canceledAmount: 0,
			payablePaidAmount: 0,
			payablePendingAmount: 0,
			payableCanceledAmount: 0,
			netRevenueAmount: 0,
			pendingByPartner: {
				items: [],
			},
		});
	});

	it("should filter by supervisor and respect supervisor visibility scopes", async () => {
		const fixture = await createFixture();
		await seedDashboardData(fixture);

		const adminFilteredResponse = await request(app.server)
			.get(`/organizations/${fixture.org.slug}/sales/dashboard/partners`)
			.query({
				startDate: "2026-01-01",
				endDate: "2026-04-08",
				inactiveMonths: 3,
				supervisorId: fixture.supervisorUser.id,
				partnerIds: fixture.partnerBeta.id,
			})
			.set("Authorization", `Bearer ${fixture.token}`);

		expect(adminFilteredResponse.statusCode).toBe(200);
		expect(adminFilteredResponse.body.summary).toEqual({
			totalPartners: 1,
			activePartners: 0,
			inactivePartners: 1,
			producingPartners: 1,
			producingPartnersRatePct: 100,
			partnersWithoutProduction: 0,
			totalSales: 1,
			grossAmount: 80_000,
			averageTicket: 80_000,
			averageTicketPerProducingPartner: 80_000,
			commissionReceivedAmount: 0,
			commissionPendingAmount: 0,
			netRevenueAmount: 0,
			delinquentSalesCount: 0,
			delinquentGrossAmount: 0,
			delinquencyRateByCountPct: 0,
			delinquencyRateByAmountPct: 0,
		});
		expect(adminFilteredResponse.body.ranking).toHaveLength(1);
		expect(adminFilteredResponse.body.ranking[0]).toEqual({
			partnerId: fixture.partnerBeta.id,
			partnerName: fixture.partnerBeta.name,
			partnerCompanyName: fixture.partnerBeta.companyName,
			status: "INACTIVE",
			supervisors: [
				{
					id: fixture.supervisorUser.id,
					name: fixture.supervisorUser.name,
				},
			],
			salesCount: 1,
			grossAmount: 80_000,
			averageTicket: 80_000,
			commissionReceivedAmount: 0,
			netRevenueAmount: 0,
			delinquentSalesCount: 0,
			delinquentGrossAmount: 0,
			delinquencyRateByCountPct: 0,
			delinquencyRateByAmountPct: 0,
			lastSaleDate: expect.stringContaining("2026-04-01"),
			salesBreakdown: {
				concluded: {
					salesCount: 0,
					grossAmount: 0,
				},
				pending: {
					salesCount: 1,
					grossAmount: 80_000,
				},
				canceled: {
					salesCount: 0,
					grossAmount: 0,
				},
			},
		});

		const supervisorResponse = await request(app.server)
			.get(`/organizations/${fixture.org.slug}/sales/dashboard/partners`)
			.query({
				startDate: "2026-01-01",
				endDate: "2026-04-08",
				inactiveMonths: 3,
			})
			.set("Authorization", `Bearer ${fixture.supervisorToken}`);

		expect(supervisorResponse.statusCode).toBe(200);
		expect(supervisorResponse.body.summary.totalPartners).toBe(2);
		expect(supervisorResponse.body.summary.totalSales).toBe(3);
		expect(supervisorResponse.body.filters.partners).toHaveLength(2);
		expect(
			supervisorResponse.body.filters.partners.every(
				(partner: { supervisors: Array<{ id: string }> }) =>
					partner.supervisors.some(
						(supervisor) => supervisor.id === fixture.supervisorUser.id,
					),
			),
		).toBe(true);
	});
});
