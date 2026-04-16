import { hash } from "bcryptjs";
import {
	PartnerDocumentType,
	ProductBonusPeriodFrequency,
	Role,
	SellerDocumentType,
	SellerStatus,
} from "generated/prisma/enums";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { makeUser } from "../../factories/make-user";
import { createTestApp } from "../../utils/test-app";

let app: Awaited<ReturnType<typeof createTestApp>>;

async function createFixture() {
	const { user, org } = await makeUser();

	const loginResponse = await request(app.server).post("/sessions/password").send({
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

	const seller = await prisma.seller.create({
		data: {
			name: `Seller ${suffix}`,
			email: `seller-${suffix}@example.com`,
			phone: "55999999999",
			documentType: SellerDocumentType.CPF,
			document: `000000000${Math.floor(Math.random() * 9)}`,
			companyName: "Seller Co",
			state: "RS",
			organizationId: org.id,
			status: SellerStatus.ACTIVE,
		},
	});

	const partner = await prisma.partner.create({
		data: {
			name: `Partner ${suffix}`,
			email: `partner-${suffix}@example.com`,
			phone: "55999888888",
			documentType: PartnerDocumentType.CPF,
			document: `111111111${Math.floor(Math.random() * 9)}`,
			companyName: "Partner Co",
			state: "RS",
			organizationId: org.id,
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

	const parentProduct = await prisma.product.create({
		data: {
			organizationId: org.id,
			name: `Parent ${suffix}`,
			description: "Parent product",
		},
	});

	const childProduct = await prisma.product.create({
		data: {
			organizationId: org.id,
			name: `Child ${suffix}`,
			description: "Child product",
			parentId: parentProduct.id,
		},
	});

	return {
		user,
		token,
		org,
		company,
		seller,
		partner,
		supervisor,
		parentProduct,
		childProduct,
	};
}

describe("product bonus scenarios", () => {
	beforeAll(async () => {
		app = await createTestApp();
	});

	afterAll(async () => {
		await app.close();
	});

	it("should save and fetch local bonus scenarios", async () => {
		const fixture = await createFixture();

		const saveResponse = await request(app.server)
			.put(
				`/organizations/${fixture.org.slug}/products/${fixture.parentProduct.id}/bonus-scenarios`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				scenarios: [
					{
						name: "Meta mensal",
						metric: "SALE_TOTAL",
						targetAmount: 100_000,
						periodFrequency: "MONTHLY",
						participants: [
							{ type: "COMPANY", valueId: fixture.company.id },
							{ type: "SELLER", valueId: fixture.seller.id },
						],
						payoutEnabled: true,
						payoutTotalPercentage: 5,
						payoutDueDay: 10,
						payoutInstallments: [
							{ installmentNumber: 1, percentage: 3 },
							{ installmentNumber: 2, percentage: 2 },
						],
					},
				],
			});

		expect(saveResponse.statusCode).toBe(204);

		const getResponse = await request(app.server)
			.get(
				`/organizations/${fixture.org.slug}/products/${fixture.parentProduct.id}/bonus-scenarios`,
			)
			.set("Authorization", `Bearer ${fixture.token}`);

		expect(getResponse.statusCode).toBe(200);
		expect(getResponse.body.scenarios).toHaveLength(1);
		expect(getResponse.body.scenarios[0].name).toBe("Meta mensal");
		expect(getResponse.body.scenarios[0].participants).toHaveLength(2);
		expect(getResponse.body.scenarios[0].payoutTotalPercentage).toBe(5);
		expect(getResponse.body.scenarios[0].payoutInstallments).toHaveLength(2);
	});

	it("should inherit parent scenarios when child has no local setup and includeInherited=true", async () => {
		const fixture = await createFixture();

		await request(app.server)
			.put(
				`/organizations/${fixture.org.slug}/products/${fixture.parentProduct.id}/bonus-scenarios`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				scenarios: [
					{
						name: "Meta herdada",
						metric: "SALE_TOTAL",
						targetAmount: 200_000,
						periodFrequency: "MONTHLY",
						participants: [{ type: "PARTNER", valueId: fixture.partner.id }],
						payoutEnabled: false,
						payoutInstallments: [],
					},
				],
			});

		const getWithoutInheritance = await request(app.server)
			.get(
				`/organizations/${fixture.org.slug}/products/${fixture.childProduct.id}/bonus-scenarios`,
			)
			.set("Authorization", `Bearer ${fixture.token}`);
		expect(getWithoutInheritance.statusCode).toBe(200);
		expect(getWithoutInheritance.body.scenarios).toHaveLength(0);

		const getWithInheritance = await request(app.server)
			.get(
				`/organizations/${fixture.org.slug}/products/${fixture.childProduct.id}/bonus-scenarios?includeInherited=true`,
			)
			.set("Authorization", `Bearer ${fixture.token}`);
		expect(getWithInheritance.statusCode).toBe(200);
		expect(getWithInheritance.body.scenarios).toHaveLength(1);
		expect(getWithInheritance.body.scenarios[0].name).toBe("Meta herdada");
	});

	it("should use child local scenarios even when includeInherited=true", async () => {
		const fixture = await createFixture();

		await request(app.server)
			.put(
				`/organizations/${fixture.org.slug}/products/${fixture.parentProduct.id}/bonus-scenarios`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				scenarios: [
					{
						name: "Meta pai",
						metric: "SALE_TOTAL",
						targetAmount: 300_000,
						periodFrequency: "MONTHLY",
						participants: [{ type: "SUPERVISOR", valueId: fixture.supervisor.id }],
						payoutEnabled: false,
						payoutInstallments: [],
					},
				],
			});

		await request(app.server)
			.put(
				`/organizations/${fixture.org.slug}/products/${fixture.childProduct.id}/bonus-scenarios`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				scenarios: [
					{
						name: "Meta filho",
						metric: "SALE_TOTAL",
						targetAmount: 120_000,
						periodFrequency: "MONTHLY",
						participants: [{ type: "SELLER", valueId: fixture.seller.id }],
						payoutEnabled: false,
						payoutInstallments: [],
					},
				],
			});

		const getResponse = await request(app.server)
			.get(
				`/organizations/${fixture.org.slug}/products/${fixture.childProduct.id}/bonus-scenarios?includeInherited=true`,
			)
			.set("Authorization", `Bearer ${fixture.token}`);

		expect(getResponse.statusCode).toBe(200);
		expect(getResponse.body.scenarios).toHaveLength(1);
		expect(getResponse.body.scenarios[0].name).toBe("Meta filho");
	});

	it("should reject payout installments when total percentage does not match", async () => {
		const fixture = await createFixture();

		const response = await request(app.server)
			.put(
				`/organizations/${fixture.org.slug}/products/${fixture.parentProduct.id}/bonus-scenarios`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				scenarios: [
					{
						name: "Meta inválida",
						metric: "SALE_TOTAL",
						targetAmount: 100_000,
						periodFrequency: "MONTHLY",
						participants: [{ type: "COMPANY", valueId: fixture.company.id }],
						payoutEnabled: true,
						payoutTotalPercentage: 5,
						payoutDueDay: 5,
						payoutInstallments: [{ installmentNumber: 1, percentage: 4 }],
					},
				],
			});

		expect(response.statusCode).toBe(400);
	});

	it("should allow idempotent replace after settlements are generated", async () => {
		const fixture = await createFixture();
		const payload = {
			scenarios: [
				{
					name: "Meta apurada",
					metric: "SALE_TOTAL",
					targetAmount: 100_000,
					periodFrequency: "MONTHLY",
					participants: [{ type: "COMPANY", valueId: fixture.company.id }],
					payoutEnabled: true,
					payoutTotalPercentage: 5,
					payoutDueDay: 10,
					payoutInstallments: [{ installmentNumber: 1, percentage: 5 }],
				},
			],
		};

		const initialSaveResponse = await request(app.server)
			.put(
				`/organizations/${fixture.org.slug}/products/${fixture.parentProduct.id}/bonus-scenarios`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send(payload);

		expect(initialSaveResponse.statusCode).toBe(204);

		await prisma.bonusSettlement.create({
			data: {
				organizationId: fixture.org.id,
				productId: fixture.parentProduct.id,
				periodFrequency: ProductBonusPeriodFrequency.MONTHLY,
				periodYear: 2026,
				periodIndex: 1,
				settledById: fixture.user.id,
				winnersCount: 0,
			},
		});

		const idempotentSaveResponse = await request(app.server)
			.put(
				`/organizations/${fixture.org.slug}/products/${fixture.parentProduct.id}/bonus-scenarios`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send(payload);

		expect(idempotentSaveResponse.statusCode).toBe(204);
	});

	it("should replace active scenarios after settlements without deleting history", async () => {
		const fixture = await createFixture();
		const payload = {
			scenarios: [
				{
					name: "Meta travada",
					metric: "SALE_TOTAL",
					targetAmount: 100_000,
					periodFrequency: "MONTHLY",
					participants: [{ type: "COMPANY", valueId: fixture.company.id }],
					payoutEnabled: false,
					payoutInstallments: [],
				},
			],
		};

		const initialSaveResponse = await request(app.server)
			.put(
				`/organizations/${fixture.org.slug}/products/${fixture.parentProduct.id}/bonus-scenarios`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send(payload);

		expect(initialSaveResponse.statusCode).toBe(204);

		const persistedScenario = await prisma.productBonusScenario.findFirstOrThrow({
			where: {
				productId: fixture.parentProduct.id,
				name: "Meta travada",
			},
			select: {
				id: true,
			},
		});

		const settlement = await prisma.bonusSettlement.create({
			data: {
				organizationId: fixture.org.id,
				productId: fixture.parentProduct.id,
				periodFrequency: ProductBonusPeriodFrequency.MONTHLY,
				periodYear: 2026,
				periodIndex: 2,
				settledById: fixture.user.id,
				winnersCount: 0,
			},
		});

		await prisma.bonusSettlementResult.create({
			data: {
				settlementId: settlement.id,
				scenarioId: persistedScenario.id,
				participantType: "COMPANY",
				beneficiaryCompanyId: fixture.company.id,
				beneficiaryLabel: fixture.company.name,
				achievedAmount: 100_000,
				targetAmount: 100_000,
				payoutEnabled: false,
				payoutAmount: 0,
			},
		});

		const changedSaveResponse = await request(app.server)
			.put(
				`/organizations/${fixture.org.slug}/products/${fixture.parentProduct.id}/bonus-scenarios`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				scenarios: [
					{
						...payload.scenarios[0],
						name: "Meta futura",
						targetAmount: 150_000,
					},
				],
			});

		expect(changedSaveResponse.statusCode).toBe(204);

		const historicalResultsCount = await prisma.bonusSettlementResult.count({
			where: {
				scenarioId: persistedScenario.id,
			},
		});
		expect(historicalResultsCount).toBe(1);

		const getResponse = await request(app.server)
			.get(
				`/organizations/${fixture.org.slug}/products/${fixture.parentProduct.id}/bonus-scenarios`,
			)
			.set("Authorization", `Bearer ${fixture.token}`);

		expect(getResponse.statusCode).toBe(200);
		expect(getResponse.body.scenarios).toHaveLength(1);
		expect(getResponse.body.scenarios[0].name).toBe("Meta futura");
		expect(getResponse.body.scenarios[0].targetAmount).toBe(150_000);
	});
});
