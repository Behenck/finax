import { hash } from "bcryptjs";
import {
	PartnerDocumentType,
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
			name: `Second Company ${suffix}`,
			organizationId: org.id,
		},
	});

	const unit = await prisma.unit.create({
		data: {
			name: `Unit ${suffix}`,
			companyId: company.id,
		},
	});

	const secondUnit = await prisma.unit.create({
		data: {
			name: `Unit B ${suffix}`,
			companyId: secondCompany.id,
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

	const product = await prisma.product.create({
		data: {
			organizationId: org.id,
			name: `Product ${suffix}`,
			description: "Product for commission tests",
		},
	});

	return {
		token,
		org,
		product,
		company,
		secondCompany,
		unit,
		secondUnit,
		seller,
		partner,
		supervisor,
	};
}

describe("product commission scenarios", () => {
	beforeAll(async () => {
		app = await createTestApp();
	});

	afterAll(async () => {
		await app.close();
	});

	it("should save and fetch scenarios", async () => {
		const fixture = await createFixture();

		const payload = {
			scenarios: [
				{
					name: "Venda padrão",
					conditions: [],
					commissions: [
						{
							recipientType: "COMPANY",
							beneficiaryId: fixture.company.id,
							totalPercentage: 5,
							installments: [
								{ installmentNumber: 1, percentage: 1 },
								{ installmentNumber: 2, percentage: 1.5 },
								{ installmentNumber: 3, percentage: 1.5 },
								{ installmentNumber: 4, percentage: 1 },
							],
						},
						{
							recipientType: "SELLER",
							beneficiaryId: fixture.seller.id,
							totalPercentage: 1,
							installments: [
								{ installmentNumber: 1, percentage: 0.25 },
								{ installmentNumber: 2, percentage: 0.25 },
								{ installmentNumber: 3, percentage: 0.25 },
								{ installmentNumber: 4, percentage: 0.25 },
							],
						},
					],
				},
				{
					name: "Cenário unidade + vendedor",
					conditions: [
						{ type: "UNIT", valueId: fixture.unit.id },
						{ type: "PARTNER", valueId: fixture.partner.id },
						{ type: "SELLER", valueId: fixture.seller.id },
					],
					commissions: [
						{
							recipientType: "SUPERVISOR",
							beneficiaryId: fixture.supervisor.id,
							totalPercentage: 1,
							installments: [{ installmentNumber: 1, percentage: 1 }],
						},
					],
				},
			],
		};

		const saveResponse = await request(app.server)
			.put(
				`/organizations/${fixture.org.slug}/products/${fixture.product.id}/commission-scenarios`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send(payload);

		expect(saveResponse.statusCode).toBe(204);

		const getResponse = await request(app.server)
			.get(
				`/organizations/${fixture.org.slug}/products/${fixture.product.id}/commission-scenarios`,
			)
			.set("Authorization", `Bearer ${fixture.token}`);

		expect(getResponse.statusCode).toBe(200);
		expect(getResponse.body.scenarios).toHaveLength(2);
		expect(getResponse.body.scenarios[0].commissions).toHaveLength(2);
		expect(getResponse.body.scenarios[1].conditions).toHaveLength(3);
		expect(getResponse.body.scenarios[0].commissions[0].totalPercentage).toBe(
			5,
		);
	});

	it("should reject non-default scenario without condition", async () => {
		const fixture = await createFixture();

		const response = await request(app.server)
			.put(
				`/organizations/${fixture.org.slug}/products/${fixture.product.id}/commission-scenarios`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				scenarios: [
					{
						name: "Venda padrão",
						conditions: [],
						commissions: [
							{
								recipientType: "COMPANY",
								beneficiaryId: fixture.company.id,
								totalPercentage: 1,
								installments: [{ installmentNumber: 1, percentage: 1 }],
							},
						],
					},
					{
						name: "Cenário inválido",
						conditions: [],
						commissions: [
							{
								recipientType: "UNIT",
								beneficiaryId: fixture.unit.id,
								totalPercentage: 1,
								installments: [{ installmentNumber: 1, percentage: 1 }],
							},
						],
					},
				],
			});

		expect(response.statusCode).toBe(400);
	});

	it("should accept linked company, unit, seller and partner conditions and persist on fetch", async () => {
		const fixture = await createFixture();

		const saveResponse = await request(app.server)
			.put(
				`/organizations/${fixture.org.slug}/products/${fixture.product.id}/commission-scenarios`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				scenarios: [
					{
						name: "Venda padrão",
						conditions: [
							{
								type: "COMPANY",
								valueId: null,
							},
							{
								type: "UNIT",
								valueId: null,
							},
							{
								type: "SELLER",
								valueId: null,
							},
							{
								type: "PARTNER",
								valueId: null,
							},
						],
						commissions: [
							{
								recipientType: "COMPANY",
								beneficiaryId: fixture.company.id,
								totalPercentage: 1,
								installments: [{ installmentNumber: 1, percentage: 1 }],
							},
						],
					},
				],
			});

		expect(saveResponse.statusCode).toBe(204);

		const getResponse = await request(app.server)
			.get(
				`/organizations/${fixture.org.slug}/products/${fixture.product.id}/commission-scenarios`,
			)
			.set("Authorization", `Bearer ${fixture.token}`);

		expect(getResponse.statusCode).toBe(200);
		expect(getResponse.body.scenarios[0].conditions).toEqual([
			{
				type: "COMPANY",
				valueId: null,
			},
			{
				type: "UNIT",
				valueId: null,
			},
			{
				type: "SELLER",
				valueId: null,
			},
			{
				type: "PARTNER",
				valueId: null,
			},
		]);
	});

	it("should accept linked partner, seller and supervisor recipients without beneficiary id", async () => {
		const fixture = await createFixture();

		const saveResponse = await request(app.server)
			.put(
				`/organizations/${fixture.org.slug}/products/${fixture.product.id}/commission-scenarios`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				scenarios: [
					{
						name: "Venda padrão",
						conditions: [],
						commissions: [
							{
								recipientType: "PARTNER",
								totalPercentage: 1,
								installments: [{ installmentNumber: 1, percentage: 1 }],
							},
							{
								recipientType: "SELLER",
								totalPercentage: 1,
								installments: [{ installmentNumber: 1, percentage: 1 }],
							},
							{
								recipientType: "SUPERVISOR",
								totalPercentage: 1,
								installments: [{ installmentNumber: 1, percentage: 1 }],
							},
						],
					},
				],
			});

		expect(saveResponse.statusCode).toBe(204);

		const getResponse = await request(app.server)
			.get(
				`/organizations/${fixture.org.slug}/products/${fixture.product.id}/commission-scenarios`,
			)
			.set("Authorization", `Bearer ${fixture.token}`);

		expect(getResponse.statusCode).toBe(200);
		expect(getResponse.body.scenarios[0].commissions[0].recipientType).toBe(
			"PARTNER",
		);
		expect(getResponse.body.scenarios[0].commissions[0].beneficiaryId).toBe(
			undefined,
		);
		expect(getResponse.body.scenarios[0].commissions[0].beneficiaryLabel).toBe(
			"Parceiro vinculado",
		);
		expect(getResponse.body.scenarios[0].commissions[1].recipientType).toBe(
			"SELLER",
		);
		expect(getResponse.body.scenarios[0].commissions[1].beneficiaryId).toBe(
			undefined,
		);
		expect(getResponse.body.scenarios[0].commissions[1].beneficiaryLabel).toBe(
			"Vendedor vinculado",
		);
		expect(getResponse.body.scenarios[0].commissions[2].recipientType).toBe(
			"SUPERVISOR",
		);
		expect(getResponse.body.scenarios[0].commissions[2].beneficiaryId).toBe(
			undefined,
		);
		expect(getResponse.body.scenarios[0].commissions[2].beneficiaryLabel).toBe(
			"Supervisor vinculado",
		);
	});

	it("should reject commission installments when total does not match", async () => {
		const fixture = await createFixture();

		const response = await request(app.server)
			.put(
				`/organizations/${fixture.org.slug}/products/${fixture.product.id}/commission-scenarios`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				scenarios: [
					{
						name: "Venda padrão",
						conditions: [],
						commissions: [
							{
								recipientType: "COMPANY",
								beneficiaryId: fixture.company.id,
								totalPercentage: 5,
								installments: [
									{ installmentNumber: 1, percentage: 1 },
									{ installmentNumber: 2, percentage: 1 },
								],
							},
						],
					},
				],
			});

		expect(response.statusCode).toBe(400);
	});

	it("should reject OTHER recipient without beneficiary label", async () => {
		const fixture = await createFixture();

		const response = await request(app.server)
			.put(
				`/organizations/${fixture.org.slug}/products/${fixture.product.id}/commission-scenarios`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				scenarios: [
					{
						name: "Venda padrão",
						conditions: [],
						commissions: [
							{
								recipientType: "OTHER",
								totalPercentage: 1,
								installments: [{ installmentNumber: 1, percentage: 1 }],
							},
						],
					},
				],
			});

		expect(response.statusCode).toBe(400);
	});

	it("should accept installments with zero percentage when totals match", async () => {
		const fixture = await createFixture();

		const response = await request(app.server)
			.put(
				`/organizations/${fixture.org.slug}/products/${fixture.product.id}/commission-scenarios`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				scenarios: [
					{
						name: "Venda padrão",
						conditions: [],
						commissions: [
							{
								recipientType: "UNIT",
								beneficiaryId: fixture.unit.id,
								totalPercentage: 1,
								installments: [
									{ installmentNumber: 1, percentage: 0.5 },
									{ installmentNumber: 2, percentage: 0 },
									{ installmentNumber: 3, percentage: 0.5 },
								],
							},
						],
					},
				],
			});

		expect(response.statusCode).toBe(204);
	});

	it("should accept duplicated condition types in a scenario", async () => {
		const fixture = await createFixture();

		const response = await request(app.server)
			.put(
				`/organizations/${fixture.org.slug}/products/${fixture.product.id}/commission-scenarios`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				scenarios: [
					{
						name: "Venda padrão",
						conditions: [],
						commissions: [
							{
								recipientType: "COMPANY",
								beneficiaryId: fixture.company.id,
								totalPercentage: 1,
								installments: [{ installmentNumber: 1, percentage: 1 }],
							},
						],
					},
					{
						name: "Cenário com condição duplicada",
						conditions: [
							{ type: "UNIT", valueId: fixture.unit.id },
							{ type: "UNIT", valueId: fixture.secondUnit.id },
						],
						commissions: [
							{
								recipientType: "SUPERVISOR",
								beneficiaryId: fixture.supervisor.id,
								totalPercentage: 1,
								installments: [{ installmentNumber: 1, percentage: 1 }],
							},
						],
					},
				],
			});

		expect(response.statusCode).toBe(204);
	});

	it("should accept empty scenarios list", async () => {
		const fixture = await createFixture();

		const response = await request(app.server)
			.put(
				`/organizations/${fixture.org.slug}/products/${fixture.product.id}/commission-scenarios`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				scenarios: [],
			});

		expect(response.statusCode).toBe(204);
	});
});
