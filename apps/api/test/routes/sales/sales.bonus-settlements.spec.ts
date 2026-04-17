import { hash } from "bcryptjs";
import {
	CustomerDocumentType,
	CustomerPersonType,
	CustomerStatus,
	PartnerDocumentType,
	Role,
	SaleCommissionDirection,
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

type Fixture = Awaited<ReturnType<typeof createFixture>>;

async function createFixture() {
	const { user, org } = await makeUser();
	const suffix = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`;

	const loginResponse = await request(app.server)
		.post("/sessions/password")
		.send({
			email: user.email,
			password: user.password,
		});
	expect(loginResponse.statusCode).toBe(200);

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
			documentNumber: `999999999${Math.floor(Math.random() * 9)}`,
			status: CustomerStatus.ACTIVE,
		},
	});

	const parentProduct = await prisma.product.create({
		data: {
			organizationId: org.id,
			name: `Parent Product ${suffix}`,
			description: "Parent product for bonus settlement tests",
		},
	});

	const childProduct = await prisma.product.create({
		data: {
			organizationId: org.id,
			name: `Child Product ${suffix}`,
			description: "Child product for bonus settlement tests",
			parentId: parentProduct.id,
		},
	});

	const seller = await prisma.seller.create({
		data: {
			name: `Seller ${suffix}`,
			email: `seller-${suffix}@example.com`,
			phone: "55999999999",
			documentType: SellerDocumentType.CPF,
			document: `111111111${Math.floor(Math.random() * 9)}`,
			companyName: "Seller Co",
			state: "RS",
			organizationId: org.id,
			status: SellerStatus.ACTIVE,
		},
	});

	const supervisorPasswordHash = await hash("123456", 6);
	const supervisorUser = await prisma.user.create({
		data: {
			name: `Supervisor ${suffix}`,
			email: `supervisor-${suffix}@example.com`,
			passwordHash: supervisorPasswordHash,
			emailVerifiedAt: new Date(),
		},
	});
	const supervisor = await prisma.member.create({
		data: {
			organizationId: org.id,
			userId: supervisorUser.id,
			role: Role.SUPERVISOR,
		},
	});

	const partner = await prisma.partner.create({
		data: {
			name: `Partner ${suffix}`,
			email: `partner-${suffix}@example.com`,
			phone: "55999888888",
			documentType: PartnerDocumentType.CPF,
			document: `222222222${Math.floor(Math.random() * 9)}`,
			companyName: "Partner Co",
			state: "RS",
			organizationId: org.id,
		},
	});

	await prisma.partnerSupervisor.create({
		data: {
			organizationId: org.id,
			partnerId: partner.id,
			supervisorId: supervisorUser.id,
		},
	});

	return {
		token: loginResponse.body.accessToken as string,
		user,
		org,
		company,
		unit,
		customer,
		parentProduct,
		childProduct,
		seller,
		supervisor,
		partner,
	};
}

async function createCompletedSale(params: {
	fixture: Fixture;
	productId: string;
	totalAmount: number;
	saleDate: string;
	responsibleType: SaleResponsibleType;
	responsibleId: string;
}) {
	return prisma.sale.create({
		data: {
			organizationId: params.fixture.org.id,
			companyId: params.fixture.company.id,
			unitId: params.fixture.unit.id,
			customerId: params.fixture.customer.id,
			productId: params.productId,
			saleDate: new Date(`${params.saleDate}T00:00:00.000Z`),
			totalAmount: params.totalAmount,
			status: SaleStatus.COMPLETED,
			responsibleType: params.responsibleType,
			responsibleId: params.responsibleId,
			createdById: params.fixture.user.id,
		},
		select: {
			id: true,
		},
	});
}

async function saveBonusScenario(params: {
	fixture: Fixture;
	productId: string;
	targetAmount: number;
	payoutEnabled?: boolean;
}) {
	const response = await request(app.server)
		.put(
			`/organizations/${params.fixture.org.slug}/products/${params.productId}/bonus-scenarios`,
		)
		.set("Authorization", `Bearer ${params.fixture.token}`)
		.send({
			scenarios: [
				{
					name: "Meta mensal",
					metric: "SALE_TOTAL",
					targetAmount: params.targetAmount,
					periodFrequency: "MONTHLY",
					participants: [
						{ type: "COMPANY", valueId: params.fixture.company.id },
						{ type: "SELLER", valueId: params.fixture.seller.id },
						{ type: "PARTNER", valueId: params.fixture.partner.id },
						{ type: "SUPERVISOR", valueId: params.fixture.supervisor.id },
					],
					payoutEnabled: params.payoutEnabled ?? true,
					payoutTotalPercentage:
						params.payoutEnabled === false ? undefined : 10,
					payoutDueDay: params.payoutEnabled === false ? undefined : 31,
					payoutInstallments:
						params.payoutEnabled === false
							? []
							: [
									{ installmentNumber: 1, percentage: 6 },
									{ installmentNumber: 2, percentage: 4 },
								],
				},
			],
		});

	expect(response.statusCode).toBe(204);
}

describe("sales bonus settlements", () => {
	beforeAll(async () => {
		app = await createTestApp();
	});

	afterAll(async () => {
		await app.close();
	});

	it("should settle bonus scenarios, include child product sales, and generate installments", async () => {
		const fixture = await createFixture();
		await saveBonusScenario({
			fixture,
			productId: fixture.parentProduct.id,
			targetAmount: 100_000,
		});

		await createCompletedSale({
			fixture,
			productId: fixture.parentProduct.id,
			totalAmount: 150_000,
			saleDate: "2026-03-05",
			responsibleType: SaleResponsibleType.SELLER,
			responsibleId: fixture.seller.id,
		});
		await createCompletedSale({
			fixture,
			productId: fixture.childProduct.id,
			totalAmount: 100_000,
			saleDate: "2026-03-12",
			responsibleType: SaleResponsibleType.PARTNER,
			responsibleId: fixture.partner.id,
		});
		await createCompletedSale({
			fixture,
			productId: fixture.parentProduct.id,
			totalAmount: 50_000,
			saleDate: "2026-03-20",
			responsibleType: SaleResponsibleType.PARTNER,
			responsibleId: fixture.partner.id,
		});

		const settleResponse = await request(app.server)
			.post(`/organizations/${fixture.org.slug}/commissions/bonus-settlements`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				productId: fixture.parentProduct.id,
				periodFrequency: "MONTHLY",
				periodYear: 2026,
				periodIndex: 3,
				settledAt: "2026-03-30",
			});

		expect(settleResponse.statusCode).toBe(201);
		expect(settleResponse.body.winnersCount).toBe(4);
		expect(settleResponse.body.resultsCount).toBe(4);
		expect(settleResponse.body.installmentsCount).toBe(8);

		const installments = await prisma.bonusInstallment.findMany({
			where: {
				settlementId: settleResponse.body.settlementId as string,
			},
			orderBy: [{ installmentNumber: "asc" }, { expectedPaymentDate: "asc" }],
			select: {
				installmentNumber: true,
				expectedPaymentDate: true,
				amount: true,
			},
		});

		expect(installments).toHaveLength(8);
		expect(
			installments.some(
				(installment) =>
					installment.installmentNumber === 1 &&
					installment.expectedPaymentDate.toISOString().slice(0, 10) ===
						"2026-03-31",
			),
		).toBe(true);
		expect(
			installments.some(
				(installment) =>
					installment.installmentNumber === 2 &&
					installment.expectedPaymentDate.toISOString().slice(0, 10) ===
						"2026-04-30",
			),
		).toBe(true);
		expect(installments.every((installment) => installment.amount >= 0)).toBe(
			true,
		);
	});

	it("should preview bonus winners without creating settlement records", async () => {
		const fixture = await createFixture();
		await saveBonusScenario({
			fixture,
			productId: fixture.parentProduct.id,
			targetAmount: 100_000,
		});

		await createCompletedSale({
			fixture,
			productId: fixture.childProduct.id,
			totalAmount: 150_000,
			saleDate: "2026-03-05",
			responsibleType: SaleResponsibleType.SELLER,
			responsibleId: fixture.seller.id,
		});

		const beforeCounts = await Promise.all([
			prisma.bonusSettlement.count(),
			prisma.bonusSettlementResult.count(),
			prisma.bonusInstallment.count(),
		]);

		const previewResponse = await request(app.server)
			.post(
				`/organizations/${fixture.org.slug}/commissions/bonus-settlements/preview`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				productId: fixture.parentProduct.id,
				periodFrequency: "MONTHLY",
				periodYear: 2026,
				periodIndex: 3,
				settledAt: "2026-03-30",
			});

		expect(previewResponse.statusCode).toBe(200);
		expect(previewResponse.body.isSettled).toBe(false);
		expect(previewResponse.body.settlementId).toBeNull();
		expect(previewResponse.body.product.id).toBe(fixture.parentProduct.id);
		expect(previewResponse.body.salesCount).toBe(1);
		expect(previewResponse.body.salesTotalAmount).toBe(150_000);
		expect(previewResponse.body.scenariosCount).toBe(1);
		expect(previewResponse.body.winnersCount).toBe(2);
		expect(previewResponse.body.installmentsCount).toBe(4);
		expect(
			previewResponse.body.winners.map(
				(winner: { beneficiaryLabel: string }) => winner.beneficiaryLabel,
			),
		).toEqual(
			expect.arrayContaining([fixture.company.name, fixture.seller.name]),
		);
		expect(previewResponse.body.winners[0].payoutInstallments[0]).toMatchObject(
			{
				installmentNumber: 1,
				amount: expect.any(Number),
				expectedPaymentDate: "2026-03-31T00:00:00.000Z",
			},
		);

		const afterCounts = await Promise.all([
			prisma.bonusSettlement.count(),
			prisma.bonusSettlementResult.count(),
			prisma.bonusInstallment.count(),
		]);
		expect(afterCounts).toEqual(beforeCounts);
	});

	it("should use the same winner calculation for preview and settlement", async () => {
		const fixture = await createFixture();
		await saveBonusScenario({
			fixture,
			productId: fixture.parentProduct.id,
			targetAmount: 100_000,
		});

		await createCompletedSale({
			fixture,
			productId: fixture.parentProduct.id,
			totalAmount: 120_000,
			saleDate: "2026-03-10",
			responsibleType: SaleResponsibleType.PARTNER,
			responsibleId: fixture.partner.id,
		});

		const requestPayload = {
			productId: fixture.parentProduct.id,
			periodFrequency: "MONTHLY",
			periodYear: 2026,
			periodIndex: 3,
			settledAt: "2026-03-30",
		};

		const previewResponse = await request(app.server)
			.post(
				`/organizations/${fixture.org.slug}/commissions/bonus-settlements/preview`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send(requestPayload);
		expect(previewResponse.statusCode).toBe(200);

		const settleResponse = await request(app.server)
			.post(`/organizations/${fixture.org.slug}/commissions/bonus-settlements`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send(requestPayload);
		expect(settleResponse.statusCode).toBe(201);
		expect(settleResponse.body.winnersCount).toBe(
			previewResponse.body.winnersCount,
		);
		expect(settleResponse.body.installmentsCount).toBe(
			previewResponse.body.installmentsCount,
		);
	});

	it("should preview an empty winners list when no participant reaches the target", async () => {
		const fixture = await createFixture();
		await saveBonusScenario({
			fixture,
			productId: fixture.parentProduct.id,
			targetAmount: 1_000_000,
			payoutEnabled: false,
		});

		await createCompletedSale({
			fixture,
			productId: fixture.parentProduct.id,
			totalAmount: 20_000,
			saleDate: "2026-03-08",
			responsibleType: SaleResponsibleType.SELLER,
			responsibleId: fixture.seller.id,
		});

		const previewResponse = await request(app.server)
			.post(
				`/organizations/${fixture.org.slug}/commissions/bonus-settlements/preview`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				productId: fixture.parentProduct.id,
				periodFrequency: "MONTHLY",
				periodYear: 2026,
				periodIndex: 3,
			});

		expect(previewResponse.statusCode).toBe(200);
		expect(previewResponse.body.winnersCount).toBe(0);
		expect(previewResponse.body.installmentsCount).toBe(0);
		expect(previewResponse.body.winners).toEqual([]);
	});

	it("should preview an already settled cycle as read-only context", async () => {
		const fixture = await createFixture();
		await saveBonusScenario({
			fixture,
			productId: fixture.parentProduct.id,
			targetAmount: 100_000,
		});

		const requestPayload = {
			productId: fixture.parentProduct.id,
			periodFrequency: "MONTHLY",
			periodYear: 2026,
			periodIndex: 3,
		};

		const settleResponse = await request(app.server)
			.post(`/organizations/${fixture.org.slug}/commissions/bonus-settlements`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send(requestPayload);
		expect(settleResponse.statusCode).toBe(201);

		const previewResponse = await request(app.server)
			.post(
				`/organizations/${fixture.org.slug}/commissions/bonus-settlements/preview`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send(requestPayload);
		expect(previewResponse.statusCode).toBe(200);
		expect(previewResponse.body.isSettled).toBe(true);
		expect(previewResponse.body.settlementId).toBe(
			settleResponse.body.settlementId,
		);
	});

	it("should block duplicate settlement for same product and cycle", async () => {
		const fixture = await createFixture();
		await saveBonusScenario({
			fixture,
			productId: fixture.parentProduct.id,
			targetAmount: 100_000,
		});

		await createCompletedSale({
			fixture,
			productId: fixture.parentProduct.id,
			totalAmount: 120_000,
			saleDate: "2026-03-10",
			responsibleType: SaleResponsibleType.SELLER,
			responsibleId: fixture.seller.id,
		});

		const firstResponse = await request(app.server)
			.post(`/organizations/${fixture.org.slug}/commissions/bonus-settlements`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				productId: fixture.parentProduct.id,
				periodFrequency: "MONTHLY",
				periodYear: 2026,
				periodIndex: 3,
			});
		expect(firstResponse.statusCode).toBe(201);

		const secondResponse = await request(app.server)
			.post(`/organizations/${fixture.org.slug}/commissions/bonus-settlements`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				productId: fixture.parentProduct.id,
				periodFrequency: "MONTHLY",
				periodYear: 2026,
				periodIndex: 3,
			});
		expect(secondResponse.statusCode).toBe(400);
	});

	it("should register settlement with zero winners and no bonus installments", async () => {
		const fixture = await createFixture();
		await saveBonusScenario({
			fixture,
			productId: fixture.parentProduct.id,
			targetAmount: 1_000_000,
			payoutEnabled: false,
		});

		await createCompletedSale({
			fixture,
			productId: fixture.parentProduct.id,
			totalAmount: 20_000,
			saleDate: "2026-03-08",
			responsibleType: SaleResponsibleType.SELLER,
			responsibleId: fixture.seller.id,
		});

		const settleResponse = await request(app.server)
			.post(`/organizations/${fixture.org.slug}/commissions/bonus-settlements`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				productId: fixture.parentProduct.id,
				periodFrequency: "MONTHLY",
				periodYear: 2026,
				periodIndex: 3,
			});

		expect(settleResponse.statusCode).toBe(201);
		expect(settleResponse.body.winnersCount).toBe(0);
		expect(settleResponse.body.resultsCount).toBe(0);
		expect(settleResponse.body.installmentsCount).toBe(0);
	});

	it("should return mixed commission rows with BONUS and allow pending -> canceled transition", async () => {
		const fixture = await createFixture();
		await saveBonusScenario({
			fixture,
			productId: fixture.parentProduct.id,
			targetAmount: 100_000,
		});

		const sale = await prisma.sale.create({
			data: {
				organizationId: fixture.org.id,
				companyId: fixture.company.id,
				unitId: fixture.unit.id,
				customerId: fixture.customer.id,
				productId: fixture.parentProduct.id,
				saleDate: new Date("2026-03-11T00:00:00.000Z"),
				totalAmount: 100_000,
				status: SaleStatus.COMPLETED,
				responsibleType: SaleResponsibleType.SELLER,
				responsibleId: fixture.seller.id,
				createdById: fixture.user.id,
			},
			select: {
				id: true,
			},
		});

		const saleCommission = await prisma.saleCommission.create({
			data: {
				saleId: sale.id,
				sourceType: SaleCommissionSourceType.MANUAL,
				recipientType: SaleCommissionRecipientType.SELLER,
				direction: SaleCommissionDirection.OUTCOME,
				beneficiarySellerId: fixture.seller.id,
				beneficiaryLabel: "Seller",
				startDate: new Date("2026-03-11T00:00:00.000Z"),
				totalPercentage: 50_000,
				sortOrder: 0,
			},
			select: {
				id: true,
			},
		});

		await prisma.saleCommissionInstallment.create({
			data: {
				saleCommissionId: saleCommission.id,
				installmentNumber: 1,
				percentage: 50_000,
				amount: 5_000,
				status: SaleCommissionInstallmentStatus.PENDING,
				expectedPaymentDate: new Date("2026-04-10T00:00:00.000Z"),
			},
		});

		await createCompletedSale({
			fixture,
			productId: fixture.parentProduct.id,
			totalAmount: 150_000,
			saleDate: "2026-03-14",
			responsibleType: SaleResponsibleType.SELLER,
			responsibleId: fixture.seller.id,
		});

		const settleResponse = await request(app.server)
			.post(`/organizations/${fixture.org.slug}/commissions/bonus-settlements`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				productId: fixture.parentProduct.id,
				periodFrequency: "MONTHLY",
				periodYear: 2026,
				periodIndex: 3,
			});
		expect(settleResponse.statusCode).toBe(201);

		const listResponse = await request(app.server)
			.get(`/organizations/${fixture.org.slug}/commissions/installments`)
			.set("Authorization", `Bearer ${fixture.token}`);
		expect(listResponse.statusCode).toBe(200);
		expect(listResponse.body.items.length).toBeGreaterThan(0);
		expect(
			listResponse.body.items.some(
				(item: { sourceType: string }) => item.sourceType === "BONUS",
			),
		).toBe(true);

		const bonusRow = listResponse.body.items.find(
			(item: { sourceType: string }) => item.sourceType === "BONUS",
		) as
			| {
					id: string;
					saleId: string | null;
					bonusContext: { scenarioName: string } | null;
			  }
			| undefined;
		expect(bonusRow).toBeDefined();
		expect(bonusRow?.saleId).toBeNull();
		expect(bonusRow?.bonusContext?.scenarioName).toBe("Meta mensal");

		const cancelResponse = await request(app.server)
			.patch(
				`/organizations/${fixture.org.slug}/commissions/bonus-installments/${bonusRow?.id}/status`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				status: "CANCELED",
				paymentDate: "2026-04-05",
			});
		expect(cancelResponse.statusCode).toBe(204);

		const canceledInstallment = await prisma.bonusInstallment.findUnique({
			where: {
				id: bonusRow?.id,
			},
			select: {
				status: true,
				amount: true,
			},
		});
		expect(canceledInstallment?.status).toBe("CANCELED");
		expect(canceledInstallment?.amount).toBe(0);

		const invalidTransitionResponse = await request(app.server)
			.patch(
				`/organizations/${fixture.org.slug}/commissions/bonus-installments/${bonusRow?.id}/status`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				status: "PAID",
				paymentDate: "2026-04-06",
			});
		expect(invalidTransitionResponse.statusCode).toBe(400);
	});
});
