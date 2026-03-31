import {
	CustomerDocumentType,
	CustomerPersonType,
	CustomerStatus,
	SaleDynamicFieldType,
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

	const parentProduct = await prisma.product.create({
		data: {
			organizationId: org.id,
			name: `Parent ${suffix}`,
			description: "Parent product",
			isActive: true,
		},
	});

	const childProduct = await prisma.product.create({
		data: {
			organizationId: org.id,
			parentId: parentProduct.id,
			name: `Child ${suffix}`,
			description: "Child product",
			isActive: true,
		},
	});

	const outsideScopeProduct = await prisma.product.create({
		data: {
			organizationId: org.id,
			name: `Outside ${suffix}`,
			description: "Outside scope",
			isActive: true,
		},
	});

	return {
		token,
		org,
		company,
		unit,
		customer,
		seller,
		parentProduct,
		childProduct,
		outsideScopeProduct,
	};
}

async function createRequiredDynamicField(productId: string, label: string) {
	return prisma.productSaleField.create({
		data: {
			productId,
			label,
			labelNormalized: label.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, ""),
			type: SaleDynamicFieldType.TEXT,
			required: true,
			sortOrder: 0,
		},
	});
}

function buildBatchPayload(
	fixture: Awaited<ReturnType<typeof createFixture>>,
	overrides?: Partial<{
		parentProductId: string;
		customerId: string;
		companyId: string;
		unitId: string | undefined;
		responsible: {
			type: "SELLER" | "PARTNER";
			id: string;
		};
		items: Array<{
			productId: string;
			saleDate: string;
			totalAmount: number;
			dynamicFields?: Record<string, unknown>;
		}>;
	}>,
) {
	return {
		parentProductId: overrides?.parentProductId ?? fixture.parentProduct.id,
		customerId: overrides?.customerId ?? fixture.customer.id,
		companyId: overrides?.companyId ?? fixture.company.id,
		unitId: overrides?.unitId ?? fixture.unit.id,
		responsible: overrides?.responsible ?? {
			type: "SELLER" as const,
			id: fixture.seller.id,
		},
		items: overrides?.items ?? [
			{
				productId: fixture.parentProduct.id,
				saleDate: "2026-03-10",
				totalAmount: 150_000,
			},
		],
	};
}

describe("sales batch create", () => {
	beforeAll(async () => {
		app = await createTestApp();
	});

	afterAll(async () => {
		await app.close();
	});

	it("should create a valid batch and persist all sales", async () => {
		const fixture = await createFixture();

		const response = await request(app.server)
			.post(`/organizations/${fixture.org.slug}/sales/batch`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send(
				buildBatchPayload(fixture, {
					items: [
						{
							productId: fixture.parentProduct.id,
							saleDate: "2026-03-10",
							totalAmount: 100_000,
						},
						{
							productId: fixture.childProduct.id,
							saleDate: "2026-03-11",
							totalAmount: 250_000,
						},
					],
				}),
			);

		expect(response.statusCode).toBe(201);
		expect(response.body.createdCount).toBe(2);
		expect(response.body.saleIds).toHaveLength(2);

		const sales = await prisma.sale.findMany({
			where: {
				organizationId: fixture.org.id,
				id: {
					in: response.body.saleIds as string[],
				},
			},
			orderBy: {
				saleDate: "asc",
			},
		});

		expect(sales).toHaveLength(2);
		expect(sales.map((sale) => sale.productId)).toEqual([
			fixture.parentProduct.id,
			fixture.childProduct.id,
		]);

		const historyCount = await prisma.saleHistoryEvent.count({
			where: {
				organizationId: fixture.org.id,
				saleId: {
					in: response.body.saleIds as string[],
				},
			},
		});
		expect(historyCount).toBe(2);
	});

	it("should rollback all items when one item is invalid", async () => {
		const fixture = await createFixture();
		const requiredField = await createRequiredDynamicField(
			fixture.childProduct.id,
			"Canal obrigatório",
		);

		const response = await request(app.server)
			.post(`/organizations/${fixture.org.slug}/sales/batch`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send(
				buildBatchPayload(fixture, {
					items: [
						{
							productId: fixture.childProduct.id,
							saleDate: "2026-03-10",
							totalAmount: 100_000,
							dynamicFields: {
								[requiredField.id]: "Inbound",
							},
						},
						{
							productId: fixture.childProduct.id,
							saleDate: "2026-03-11",
							totalAmount: 250_000,
						},
					],
				}),
			);

		expect(response.statusCode).toBe(400);
		expect(response.body.message).toContain("Item 2:");
		expect(response.body.message).toContain("Canal obrigatório");

		const salesCount = await prisma.sale.count({
			where: {
				organizationId: fixture.org.id,
			},
		});
		expect(salesCount).toBe(0);
	});

	it("should enforce maximum batch size of 50 items", async () => {
		const fixture = await createFixture();

		const items = Array.from({ length: 51 }).map((_, index) => ({
			productId: fixture.parentProduct.id,
			saleDate: `2026-03-${String((index % 28) + 1).padStart(2, "0")}`,
			totalAmount: 100_000 + index,
		}));

		const response = await request(app.server)
			.post(`/organizations/${fixture.org.slug}/sales/batch`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send(
				buildBatchPayload(fixture, {
					items,
				}),
			);

		expect(response.statusCode).toBe(400);

		const salesCount = await prisma.sale.count({
			where: {
				organizationId: fixture.org.id,
			},
		});
		expect(salesCount).toBe(0);
	});

	it("should block item product outside selected parent scope", async () => {
		const fixture = await createFixture();

		const response = await request(app.server)
			.post(`/organizations/${fixture.org.slug}/sales/batch`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send(
				buildBatchPayload(fixture, {
					items: [
						{
							productId: fixture.outsideScopeProduct.id,
							saleDate: "2026-03-10",
							totalAmount: 300_000,
						},
					],
				}),
			);

		expect(response.statusCode).toBe(400);
		expect(response.body.message).toContain("Item 1:");
		expect(response.body.message).toContain("outside selected parent scope");

		const salesCount = await prisma.sale.count({
			where: {
				organizationId: fixture.org.id,
			},
		});
		expect(salesCount).toBe(0);
	});
});
