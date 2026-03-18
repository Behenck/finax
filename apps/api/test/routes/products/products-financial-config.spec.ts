import { TransactionType } from "generated/prisma/enums";
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

	const costCenter = await prisma.costCenter.create({
		data: {
			name: `Sales Cost Center ${suffix}`,
			organizationId: org.id,
		},
	});

	const foreignOrganization = await prisma.organization.create({
		data: {
			name: `Foreign Org ${suffix}`,
			slug: `foreign-org-${suffix}`,
			ownerId: user.id,
		},
	});

	const foreignCostCenter = await prisma.costCenter.create({
		data: {
			name: `Foreign Cost Center ${suffix}`,
			organizationId: foreignOrganization.id,
		},
	});

	const incomeCategory = await prisma.category.create({
		data: {
			name: `Income Category ${suffix}`,
			color: "#16a34a",
			icon: "wallet",
			type: TransactionType.INCOME,
			organizationId: org.id,
		},
	});

	const outcomeCategory = await prisma.category.create({
		data: {
			name: `Outcome Category ${suffix}`,
			color: "#dc2626",
			icon: "arrow-up",
			type: TransactionType.OUTCOME,
			organizationId: org.id,
		},
	});

	const foreignIncomeCategory = await prisma.category.create({
		data: {
			name: `Foreign Income Category ${suffix}`,
			color: "#16a34a",
			icon: "wallet",
			type: TransactionType.INCOME,
			organizationId: foreignOrganization.id,
		},
	});

	return {
		org,
		token,
		costCenter,
		foreignCostCenter,
		incomeCategory,
		outcomeCategory,
		foreignIncomeCategory,
	};
}

describe("products financial config", () => {
	beforeAll(async () => {
		app = await createTestApp();
	});

	afterAll(async () => {
		await app.close();
	});

	it("should persist sales transaction mapping on create and update", async () => {
		const fixture = await createFixture();

		const createResponse = await request(app.server)
			.post(`/organizations/${fixture.org.slug}/products`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				name: "Produto com mapeamento financeiro",
				description: null,
				parentId: null,
				salesTransactionCategoryId: fixture.incomeCategory.id,
				salesTransactionCostCenterId: fixture.costCenter.id,
			});

		expect(createResponse.statusCode).toBe(201);
		const productId = createResponse.body.productId as string;
		expect(productId).toBeTruthy();

		const getResponse = await request(app.server)
			.get(`/organizations/${fixture.org.slug}/products/${productId}`)
			.set("Authorization", `Bearer ${fixture.token}`);

		expect(getResponse.statusCode).toBe(200);
		expect(getResponse.body.product.salesTransactionCategoryId).toBe(
			fixture.incomeCategory.id,
		);
		expect(getResponse.body.product.salesTransactionCostCenterId).toBe(
			fixture.costCenter.id,
		);

		const listResponse = await request(app.server)
			.get(`/organizations/${fixture.org.slug}/products`)
			.set("Authorization", `Bearer ${fixture.token}`);

		expect(listResponse.statusCode).toBe(200);
		const listedProduct = listResponse.body.products.find(
			(product: { id: string }) => product.id === productId,
		);
		expect(listedProduct).toBeDefined();
		expect(listedProduct.salesTransactionCategoryId).toBe(
			fixture.incomeCategory.id,
		);
		expect(listedProduct.salesTransactionCostCenterId).toBe(
			fixture.costCenter.id,
		);

		const updateResponse = await request(app.server)
			.put(`/organizations/${fixture.org.slug}/products/${productId}`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				name: "Produto com mapeamento financeiro",
				description: null,
				parentId: null,
				isActive: true,
				sortOrder: 0,
				salesTransactionCategoryId: null,
				salesTransactionCostCenterId: null,
			});

		expect(updateResponse.statusCode).toBe(204);

		const getAfterUpdateResponse = await request(app.server)
			.get(`/organizations/${fixture.org.slug}/products/${productId}`)
			.set("Authorization", `Bearer ${fixture.token}`);

		expect(getAfterUpdateResponse.statusCode).toBe(200);
		expect(getAfterUpdateResponse.body.product.salesTransactionCategoryId).toBe(
			null,
		);
		expect(
			getAfterUpdateResponse.body.product.salesTransactionCostCenterId,
		).toBe(null);
	});

	it("should reject non-income category for sales transaction mapping", async () => {
		const fixture = await createFixture();
		const invalidProductName = `Produto inválido OUTCOME ${Date.now()}`;

		const response = await request(app.server)
			.post(`/organizations/${fixture.org.slug}/products`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				name: invalidProductName,
				description: null,
				parentId: null,
				salesTransactionCategoryId: fixture.outcomeCategory.id,
				salesTransactionCostCenterId: fixture.costCenter.id,
			});

		expect(response.statusCode).toBeGreaterThanOrEqual(400);
		if (response.statusCode === 400) {
			expect(response.body.message).toContain("INCOME");
		}

		const productCount = await prisma.product.count({
			where: {
				organizationId: fixture.org.id,
				name: invalidProductName,
			},
		});
		expect(productCount).toBe(0);
	});

	it("should reject category from another organization", async () => {
		const fixture = await createFixture();
		const invalidProductName = `Produto inválido categoria externa ${Date.now()}`;

		const response = await request(app.server)
			.post(`/organizations/${fixture.org.slug}/products`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				name: invalidProductName,
				description: null,
				parentId: null,
				salesTransactionCategoryId: fixture.foreignIncomeCategory.id,
				salesTransactionCostCenterId: fixture.costCenter.id,
			});

		expect(response.statusCode).toBeGreaterThanOrEqual(400);
		if (response.statusCode === 400) {
			expect(response.body.message).toContain("organization");
		}

		const productCount = await prisma.product.count({
			where: {
				organizationId: fixture.org.id,
				name: invalidProductName,
			},
		});
		expect(productCount).toBe(0);
	});

	it("should reject cost center from another organization", async () => {
		const fixture = await createFixture();
		const invalidProductName = `Produto inválido centro externo ${Date.now()}`;

		const response = await request(app.server)
			.post(`/organizations/${fixture.org.slug}/products`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				name: invalidProductName,
				description: null,
				parentId: null,
				salesTransactionCategoryId: fixture.incomeCategory.id,
				salesTransactionCostCenterId: fixture.foreignCostCenter.id,
			});

		expect(response.statusCode).toBeGreaterThanOrEqual(400);
		if (response.statusCode === 400) {
			expect(response.body.message).toContain("organization");
		}

		const productCount = await prisma.product.count({
			where: {
				organizationId: fixture.org.id,
				name: invalidProductName,
			},
		});
		expect(productCount).toBe(0);
	});
});
