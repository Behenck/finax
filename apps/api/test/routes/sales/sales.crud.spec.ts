import { prisma } from "@/lib/prisma";
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

	it("should list sales with summary names", async () => {
		const fixture = await createFixture();

		const firstSaleId = await createSaleUsingApi(fixture);

		await createSaleUsingApi(
			fixture,
			buildCreatePayload(fixture, {
				responsible: {
					type: "PARTNER",
					id: fixture.partner.id,
				},
				notes: "Venda por parceiro",
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
	});

	it("should get sale by id", async () => {
		const fixture = await createFixture();
		const saleId = await createSaleUsingApi(fixture);

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
		const saleId = await createSaleUsingApi(fixture);

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

