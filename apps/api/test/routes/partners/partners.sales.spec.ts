import {
	CustomerDocumentType,
	CustomerPersonType,
	CustomerStatus,
	PartnerDocumentType,
	PartnerStatus,
	PermissionOverrideEffect,
	Role,
	SaleResponsibleType,
	SaleStatus,
	SellerDocumentType,
	SellerStatus,
} from "generated/prisma/enums";
import { hash } from "bcryptjs";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { makeUser } from "../../factories/make-user";
import { createTestApp } from "../../utils/test-app";

let app: Awaited<ReturnType<typeof createTestApp>>;

async function authenticate(email: string, password: string) {
	const response = await request(app.server).post("/sessions/password").send({
		email,
		password,
	});

	expect(response.statusCode).toBe(200);
	return response.body.accessToken as string;
}

async function denyPermission(params: {
	organizationId: string;
	memberId: string;
	permissionKey: string;
}) {
	const permission = await prisma.permission.findUnique({
		where: {
			key: params.permissionKey,
		},
		select: {
			id: true,
		},
	});

	if (!permission) {
		throw new Error(`Permission ${params.permissionKey} not found`);
	}

	await prisma.memberPermissionOverride.upsert({
		where: {
			memberId_permissionId: {
				memberId: params.memberId,
				permissionId: permission.id,
			},
		},
		update: {
			effect: PermissionOverrideEffect.DENY,
		},
		create: {
			organizationId: params.organizationId,
			memberId: params.memberId,
			permissionId: permission.id,
			effect: PermissionOverrideEffect.DENY,
		},
	});
}

async function createPartner(organizationId: string, suffix: string) {
	return prisma.partner.create({
		data: {
			name: `Partner ${suffix}`,
			email: `partner-${suffix}@example.com`,
			phone: "55999999999",
			companyName: `Partner company ${suffix}`,
			documentType: PartnerDocumentType.CPF,
			document: `${Math.floor(Math.random() * 1_000_000_000_000)}`,
			country: "BR",
			state: "RS",
			organizationId,
			status: PartnerStatus.ACTIVE,
		},
	});
}

async function createCustomer(organizationId: string, suffix: string) {
	return prisma.customer.create({
		data: {
			organizationId,
			personType: CustomerPersonType.PF,
			name: `Customer ${suffix}`,
			documentType: CustomerDocumentType.CPF,
			documentNumber: `${Math.floor(Math.random() * 1_000_000_000_000)}`,
			status: CustomerStatus.ACTIVE,
		},
	});
}

async function createMember(organizationId: string, suffix: string) {
	const password = "123456";
	const passwordHash = await hash(password, 6);
	const user = await prisma.user.create({
		data: {
			name: `Partner sales member ${suffix}`,
			email: `partner-sales-member-${suffix}@example.com`,
			passwordHash,
			emailVerifiedAt: new Date(),
		},
	});
	const member = await prisma.member.create({
		data: {
			organizationId,
			userId: user.id,
			role: Role.MEMBER,
		},
	});

	return {
		user,
		member,
		password,
	};
}

async function createFixture() {
	const { user, org } = await makeUser();
	const token = await authenticate(user.email, user.password);
	const suffix = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
	const member = await prisma.member.findFirstOrThrow({
		where: {
			organizationId: org.id,
			userId: user.id,
		},
	});

	const company = await prisma.company.create({
		data: {
			name: `Company ${suffix}`,
			organizationId: org.id,
		},
	});
	const product = await prisma.product.create({
		data: {
			name: `Product ${suffix}`,
			description: "Partner sales test product",
			organizationId: org.id,
		},
	});
	const customer = await createCustomer(org.id, `${suffix}-target`);
	const otherCustomer = await createCustomer(org.id, `${suffix}-other`);
	const targetPartner = await createPartner(org.id, `${suffix}-target`);
	const otherPartner = await createPartner(org.id, `${suffix}-other`);
	const seller = await prisma.seller.create({
		data: {
			name: `Seller ${suffix}`,
			email: `seller-${suffix}@example.com`,
			phone: "55999999999",
			documentType: SellerDocumentType.CPF,
			document: `${Math.floor(Math.random() * 1_000_000_000_000)}`,
			companyName: `Seller company ${suffix}`,
			state: "RS",
			organizationId: org.id,
			status: SellerStatus.ACTIVE,
		},
	});

	const targetSale = await prisma.sale.create({
		data: {
			organizationId: org.id,
			companyId: company.id,
			customerId: customer.id,
			productId: product.id,
			saleDate: new Date("2026-03-04T00:00:00.000Z"),
			totalAmount: 120_000,
			status: SaleStatus.COMPLETED,
			responsibleType: SaleResponsibleType.PARTNER,
			responsibleId: targetPartner.id,
			createdById: user.id,
		},
	});
	await prisma.saleDelinquency.create({
		data: {
			organizationId: org.id,
			saleId: targetSale.id,
			dueDate: new Date("2026-04-01T00:00:00.000Z"),
			createdById: user.id,
		},
	});

	const otherPartnerSale = await prisma.sale.create({
		data: {
			organizationId: org.id,
			companyId: company.id,
			customerId: otherCustomer.id,
			productId: product.id,
			saleDate: new Date("2026-03-05T00:00:00.000Z"),
			totalAmount: 80_000,
			status: SaleStatus.COMPLETED,
			responsibleType: SaleResponsibleType.PARTNER,
			responsibleId: otherPartner.id,
			createdById: user.id,
		},
	});
	const sellerSale = await prisma.sale.create({
		data: {
			organizationId: org.id,
			companyId: company.id,
			customerId: otherCustomer.id,
			productId: product.id,
			saleDate: new Date("2026-03-06T00:00:00.000Z"),
			totalAmount: 90_000,
			status: SaleStatus.COMPLETED,
			responsibleType: SaleResponsibleType.SELLER,
			responsibleId: seller.id,
			createdById: user.id,
		},
	});

	return {
		org,
		user,
		member,
		token,
		targetPartner,
		targetSale,
		otherPartnerSale,
		sellerSale,
		customer,
		product,
		company,
	};
}

function createCurrentMonthDate(day: number) {
	const now = new Date();

	return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), day));
}

function createPreviousMonthDate(day: number) {
	const now = new Date();

	return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, day));
}

async function createListMetricsFixture() {
	const { user, org } = await makeUser();
	const token = await authenticate(user.email, user.password);
	const suffix = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
	const member = await prisma.member.findFirstOrThrow({
		where: {
			organizationId: org.id,
			userId: user.id,
		},
	});

	const company = await prisma.company.create({
		data: {
			name: `Metrics company ${suffix}`,
			organizationId: org.id,
		},
	});
	const product = await prisma.product.create({
		data: {
			name: `Metrics product ${suffix}`,
			description: "Partner list metrics test product",
			organizationId: org.id,
		},
	});
	const customer = await createCustomer(org.id, `${suffix}-metrics`);
	const targetPartner = await createPartner(org.id, `${suffix}-metrics-target`);
	const otherPartner = await createPartner(org.id, `${suffix}-metrics-other`);
	const seller = await prisma.seller.create({
		data: {
			name: `Metrics seller ${suffix}`,
			email: `metrics-seller-${suffix}@example.com`,
			phone: "55999999999",
			documentType: SellerDocumentType.CPF,
			document: `${Math.floor(Math.random() * 1_000_000_000_000)}`,
			companyName: `Metrics seller company ${suffix}`,
			state: "RS",
			organizationId: org.id,
			status: SellerStatus.ACTIVE,
		},
	});

	await prisma.sale.createMany({
		data: [
			{
				organizationId: org.id,
				companyId: company.id,
				customerId: customer.id,
				productId: product.id,
				saleDate: createCurrentMonthDate(3),
				totalAmount: 120_000,
				status: SaleStatus.COMPLETED,
				responsibleType: SaleResponsibleType.PARTNER,
				responsibleId: targetPartner.id,
				createdById: user.id,
			},
			{
				organizationId: org.id,
				companyId: company.id,
				customerId: customer.id,
				productId: product.id,
				saleDate: createCurrentMonthDate(4),
				totalAmount: 50_000,
				status: SaleStatus.PENDING,
				responsibleType: SaleResponsibleType.PARTNER,
				responsibleId: targetPartner.id,
				createdById: user.id,
			},
			{
				organizationId: org.id,
				companyId: company.id,
				customerId: customer.id,
				productId: product.id,
				saleDate: createCurrentMonthDate(5),
				totalAmount: 900_000,
				status: SaleStatus.CANCELED,
				responsibleType: SaleResponsibleType.PARTNER,
				responsibleId: targetPartner.id,
				createdById: user.id,
			},
			{
				organizationId: org.id,
				companyId: company.id,
				customerId: customer.id,
				productId: product.id,
				saleDate: createPreviousMonthDate(6),
				totalAmount: 70_000,
				status: SaleStatus.COMPLETED,
				responsibleType: SaleResponsibleType.PARTNER,
				responsibleId: targetPartner.id,
				createdById: user.id,
			},
			{
				organizationId: org.id,
				companyId: company.id,
				customerId: customer.id,
				productId: product.id,
				saleDate: createCurrentMonthDate(7),
				totalAmount: 80_000,
				status: SaleStatus.COMPLETED,
				responsibleType: SaleResponsibleType.SELLER,
				responsibleId: seller.id,
				createdById: user.id,
			},
			{
				organizationId: org.id,
				companyId: company.id,
				customerId: customer.id,
				productId: product.id,
				saleDate: createCurrentMonthDate(8),
				totalAmount: 30_000,
				status: SaleStatus.APPROVED,
				responsibleType: SaleResponsibleType.PARTNER,
				responsibleId: otherPartner.id,
				createdById: user.id,
			},
		],
	});

	return {
		org,
		member,
		token,
		targetPartner,
		otherPartner,
	};
}

describe("partner sales detail", () => {
	beforeAll(async () => {
		app = await createTestApp();
	});

	afterAll(async () => {
		await app.close();
	});

	it("should return only sales sold by the selected partner", async () => {
		const fixture = await createFixture();

		const response = await request(app.server)
			.get(
				`/organizations/${fixture.org.slug}/partners/${fixture.targetPartner.id}`,
			)
			.set("Authorization", `Bearer ${fixture.token}`);

		expect(response.statusCode).toBe(200);
		expect(response.body.partner.sales).toHaveLength(1);
		expect(response.body.partner.sales[0]).toMatchObject({
			id: fixture.targetSale.id,
			totalAmount: fixture.targetSale.totalAmount,
			status: SaleStatus.COMPLETED,
			customer: {
				id: fixture.customer.id,
				name: fixture.customer.name,
			},
			product: {
				id: fixture.product.id,
				name: fixture.product.name,
			},
			company: {
				id: fixture.company.id,
				name: fixture.company.name,
			},
			responsible: {
				type: "PARTNER",
				id: fixture.targetPartner.id,
			},
			delinquencySummary: {
				hasOpen: true,
				openCount: 1,
			},
		});
		expect(response.body.partner.sales[0].openDelinquencies).toHaveLength(1);

		const returnedSaleIds = response.body.partner.sales.map(
			(sale: { id: string }) => sale.id,
		);
		expect(returnedSaleIds).not.toContain(fixture.otherPartnerSale.id);
		expect(returnedSaleIds).not.toContain(fixture.sellerSale.id);
	});

	it("should keep partner detail visible and hide sales when member cannot view sales", async () => {
		const fixture = await createFixture();
		const memberFixture = await createMember(
			fixture.org.id,
			`${Date.now()}-${Math.floor(Math.random() * 10_000)}`,
		);
		const memberToken = await authenticate(
			memberFixture.user.email,
			memberFixture.password,
		);
		await denyPermission({
			organizationId: fixture.org.id,
			memberId: memberFixture.member.id,
			permissionKey: "sales.view",
		});

		const response = await request(app.server)
			.get(
				`/organizations/${fixture.org.slug}/partners/${fixture.targetPartner.id}`,
			)
			.set("Authorization", `Bearer ${memberToken}`);

		expect(response.statusCode).toBe(200);
		expect(response.body.partner.id).toBe(fixture.targetPartner.id);
		expect(response.body.partner.sales).toEqual([]);
	});

	it("should return current month sales metrics in partners list", async () => {
		const fixture = await createListMetricsFixture();

		const response = await request(app.server)
			.get(`/organizations/${fixture.org.slug}/partners`)
			.set("Authorization", `Bearer ${fixture.token}`);

		expect(response.statusCode).toBe(200);

		const targetPartner = response.body.partners.find(
			(partner: { id: string }) => partner.id === fixture.targetPartner.id,
		);
		const otherPartner = response.body.partners.find(
			(partner: { id: string }) => partner.id === fixture.otherPartner.id,
		);

		expect(targetPartner).toMatchObject({
			id: fixture.targetPartner.id,
			currentMonthSalesAmount: 170_000,
			currentMonthSalesCount: 2,
		});
		expect(otherPartner).toMatchObject({
			id: fixture.otherPartner.id,
			currentMonthSalesAmount: 30_000,
			currentMonthSalesCount: 1,
		});
	});

	it("should keep partners list visible and zero sales metrics when member cannot view sales", async () => {
		const fixture = await createListMetricsFixture();
		const memberFixture = await createMember(
			fixture.org.id,
			`${Date.now()}-${Math.floor(Math.random() * 10_000)}`,
		);
		const memberToken = await authenticate(
			memberFixture.user.email,
			memberFixture.password,
		);
		await denyPermission({
			organizationId: fixture.org.id,
			memberId: memberFixture.member.id,
			permissionKey: "sales.view",
		});

		const response = await request(app.server)
			.get(`/organizations/${fixture.org.slug}/partners`)
			.set("Authorization", `Bearer ${memberToken}`);

		expect(response.statusCode).toBe(200);

		const targetPartner = response.body.partners.find(
			(partner: { id: string }) => partner.id === fixture.targetPartner.id,
		);

		expect(targetPartner).toMatchObject({
			id: fixture.targetPartner.id,
			currentMonthSalesAmount: 0,
			currentMonthSalesCount: 0,
		});
	});
});
