import { hash } from "bcryptjs";
import {
	CustomerDocumentType,
	CustomerPersonType,
	CustomerStatus,
	PermissionOverrideEffect,
	Role,
	SaleStatus,
	SellerDocumentType,
	SellerStatus,
} from "generated/prisma/enums";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { getPermissionCatalog } from "@/permissions/service";
import { makeUser } from "../../factories/make-user";
import { createTestApp } from "../../utils/test-app";

let app: Awaited<ReturnType<typeof createTestApp>>;

type CommissionInput = {
	sourceType: "MANUAL" | "PULLED";
	recipientType:
		| "COMPANY"
		| "UNIT"
		| "SELLER"
		| "PARTNER"
		| "SUPERVISOR"
		| "OTHER";
	direction?: "INCOME" | "OUTCOME";
	beneficiaryId?: string;
	beneficiaryLabel?: string;
	startDate: string;
	totalPercentage: number;
	installments: Array<{
		installmentNumber: number;
		percentage: number;
	}>;
};

type Fixture = Awaited<ReturnType<typeof createFixture>>;

const COMMISSION_PERMISSIONS = [
	"sales.commissions.create",
	"sales.commissions.update",
	"sales.commissions.manage",
] as const;

async function authenticate(email: string, password: string) {
	const response = await request(app.server).post("/sessions/password").send({
		email,
		password,
	});

	expect(response.statusCode).toBe(200);
	return response.body.accessToken as string;
}

async function createAdminMemberFixture(
	organizationId: string,
	suffix: string,
) {
	const password = "123456";
	const passwordHash = await hash(password, 6);
	const user = await prisma.user.create({
		data: {
			name: `Sales commissions member ${suffix}`,
			email: `sales-commissions-${suffix}@example.com`,
			passwordHash,
			emailVerifiedAt: new Date(),
		},
	});

	const member = await prisma.member.create({
		data: {
			organizationId,
			userId: user.id,
			role: Role.ADMIN,
		},
	});

	return {
		user,
		member,
		password,
	};
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
			organizationId_memberId_permissionId: {
				organizationId: params.organizationId,
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

async function denyPermissions(params: {
	organizationId: string;
	memberId: string;
	permissionKeys: readonly string[];
}) {
	for (const permissionKey of params.permissionKeys) {
		await denyPermission({
			organizationId: params.organizationId,
			memberId: params.memberId,
			permissionKey,
		});
	}
}

async function createFixture() {
	const { org } = await makeUser();
	const suffix = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
	const adminMember = await createAdminMemberFixture(org.id, suffix);
	const token = await authenticate(
		adminMember.user.email,
		adminMember.password,
	);

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

	const product = await prisma.product.create({
		data: {
			organizationId: org.id,
			name: `Product ${suffix}`,
			description: "Product for sales commissions permission tests",
			isActive: true,
		},
	});

	const seller = await prisma.seller.create({
		data: {
			name: `Seller ${suffix}`,
			email: `seller-${suffix}@example.com`,
			phone: "55999999999",
			documentType: SellerDocumentType.CPF,
			document: `888888888${Math.floor(Math.random() * 9)}`,
			companyName: "Seller Company",
			state: "RS",
			organizationId: org.id,
			status: SellerStatus.ACTIVE,
		},
	});

	return {
		org,
		adminMember,
		token,
		company,
		unit,
		customer,
		product,
		seller,
	};
}

function buildCommissionInput(sellerId: string): CommissionInput[] {
	return [
		{
			sourceType: "MANUAL",
			recipientType: "SELLER",
			direction: "OUTCOME",
			beneficiaryId: sellerId,
			startDate: "2026-03-04",
			totalPercentage: 10,
			installments: [
				{
					installmentNumber: 1,
					percentage: 10,
				},
			],
		},
	];
}

function buildSalePayload(params: {
	fixture: Fixture;
	totalAmount?: number;
	commissions?: CommissionInput[];
}) {
	const payload: {
		saleDate: string;
		customerId: string;
		productId: string;
		totalAmount: number;
		responsible: { type: "SELLER"; id: string };
		companyId: string;
		unitId?: string;
		notes?: string;
		commissions?: CommissionInput[];
	} = {
		saleDate: "2026-03-04",
		customerId: params.fixture.customer.id,
		productId: params.fixture.product.id,
		totalAmount: params.totalAmount ?? 120_000,
		responsible: {
			type: "SELLER",
			id: params.fixture.seller.id,
		},
		companyId: params.fixture.company.id,
		unitId: params.fixture.unit.id,
		notes: "Sales commissions permission test",
	};

	if (params.commissions !== undefined) {
		payload.commissions = params.commissions;
	}

	return payload;
}

async function createSale(params: {
	fixture: Fixture;
	token: string;
	totalAmount?: number;
	commissions?: CommissionInput[];
}) {
	return request(app.server)
		.post(`/organizations/${params.fixture.org.slug}/sales`)
		.set("Authorization", `Bearer ${params.token}`)
		.send(
			buildSalePayload({
				fixture: params.fixture,
				totalAmount: params.totalAmount,
				commissions: params.commissions,
			}),
		);
}

async function updateSale(params: {
	fixture: Fixture;
	token: string;
	saleId: string;
	totalAmount?: number;
	commissions?: CommissionInput[];
}) {
	return request(app.server)
		.put(`/organizations/${params.fixture.org.slug}/sales/${params.saleId}`)
		.set("Authorization", `Bearer ${params.token}`)
		.send(
			buildSalePayload({
				fixture: params.fixture,
				totalAmount: params.totalAmount,
				commissions: params.commissions,
			}),
		);
}

describe("sales commissions permission split", () => {
	beforeAll(async () => {
		app = await createTestApp();
		await getPermissionCatalog(prisma);
	});

	afterAll(async () => {
		await app.close();
	});

	it("should return 403 on POST /sales with commissions when member does not have sales.commissions.create", async () => {
		const fixture = await createFixture();
		await denyPermissions({
			organizationId: fixture.org.id,
			memberId: fixture.adminMember.member.id,
			permissionKeys: ["sales.commissions.create"],
		});

		const response = await createSale({
			fixture,
			token: fixture.token,
			commissions: buildCommissionInput(fixture.seller.id),
		});

		expect(response.statusCode).toBe(403);
	});

	it("should allow POST /sales with commissions when member has sales.commissions.create", async () => {
		const fixture = await createFixture();

		const response = await createSale({
			fixture,
			token: fixture.token,
			commissions: buildCommissionInput(fixture.seller.id),
		});

		expect(response.statusCode).toBe(201);
		expect(response.body.saleId).toEqual(expect.any(String));
	});

	it("should return 403 on POST /sales with commissions when member has only legacy sales.commissions.manage", async () => {
		const fixture = await createFixture();
		await denyPermissions({
			organizationId: fixture.org.id,
			memberId: fixture.adminMember.member.id,
			permissionKeys: ["sales.commissions.create", "sales.commissions.update"],
		});

		const response = await createSale({
			fixture,
			token: fixture.token,
			commissions: buildCommissionInput(fixture.seller.id),
		});

		expect(response.statusCode).toBe(403);
	});

	it("should keep allowing POST /sales without commissions even without commission permissions", async () => {
		const fixture = await createFixture();
		await denyPermissions({
			organizationId: fixture.org.id,
			memberId: fixture.adminMember.member.id,
			permissionKeys: COMMISSION_PERMISSIONS,
		});

		const response = await createSale({
			fixture,
			token: fixture.token,
		});

		expect(response.statusCode).toBe(201);
	});

	it("should return 403 on PUT /sales/:id with commissions when member has only sales.commissions.create", async () => {
		const fixture = await createFixture();
		const createdSaleResponse = await createSale({
			fixture,
			token: fixture.token,
		});
		expect(createdSaleResponse.statusCode).toBe(201);
		const saleId = createdSaleResponse.body.saleId as string;

		await denyPermissions({
			organizationId: fixture.org.id,
			memberId: fixture.adminMember.member.id,
			permissionKeys: ["sales.commissions.update"],
		});

		const updateResponse = await updateSale({
			fixture,
			token: fixture.token,
			saleId,
			commissions: [],
		});

		expect(updateResponse.statusCode).toBe(403);
	});

	it("should return 403 on PUT /sales/:id with commissions when member has only sales.commissions.update", async () => {
		const fixture = await createFixture();
		const createdSaleResponse = await createSale({
			fixture,
			token: fixture.token,
		});
		expect(createdSaleResponse.statusCode).toBe(201);
		const saleId = createdSaleResponse.body.saleId as string;

		await denyPermissions({
			organizationId: fixture.org.id,
			memberId: fixture.adminMember.member.id,
			permissionKeys: ["sales.commissions.create"],
		});

		const updateResponse = await updateSale({
			fixture,
			token: fixture.token,
			saleId,
			commissions: [],
		});

		expect(updateResponse.statusCode).toBe(403);
	});

	it("should allow PUT /sales/:id with commissions when member has sales.commissions.create and sales.commissions.update", async () => {
		const fixture = await createFixture();
		const createdSaleResponse = await createSale({
			fixture,
			token: fixture.token,
		});
		expect(createdSaleResponse.statusCode).toBe(201);
		const saleId = createdSaleResponse.body.saleId as string;

		const updateResponse = await updateSale({
			fixture,
			token: fixture.token,
			saleId,
			commissions: buildCommissionInput(fixture.seller.id),
		});

		expect(updateResponse.statusCode).toBe(204);
	});

	it("should return 403 on PUT /sales/:id with commissions when member has only legacy sales.commissions.manage", async () => {
		const fixture = await createFixture();
		const createdSaleResponse = await createSale({
			fixture,
			token: fixture.token,
		});
		expect(createdSaleResponse.statusCode).toBe(201);
		const saleId = createdSaleResponse.body.saleId as string;

		await denyPermissions({
			organizationId: fixture.org.id,
			memberId: fixture.adminMember.member.id,
			permissionKeys: ["sales.commissions.create", "sales.commissions.update"],
		});

		const updateResponse = await updateSale({
			fixture,
			token: fixture.token,
			saleId,
			commissions: buildCommissionInput(fixture.seller.id),
		});

		expect(updateResponse.statusCode).toBe(403);
	});

	it("should allow PUT /sales/:id without commissions and changed totalAmount while sale is pending even without commission permissions", async () => {
		const fixture = await createFixture();
		const createdSaleResponse = await createSale({
			fixture,
			token: fixture.token,
			commissions: buildCommissionInput(fixture.seller.id),
		});
		expect(createdSaleResponse.statusCode).toBe(201);
		const saleId = createdSaleResponse.body.saleId as string;

		await denyPermissions({
			organizationId: fixture.org.id,
			memberId: fixture.adminMember.member.id,
			permissionKeys: COMMISSION_PERMISSIONS,
		});

		const updateResponse = await updateSale({
			fixture,
			token: fixture.token,
			saleId,
			totalAmount: 130_000,
		});

		expect(updateResponse.statusCode).toBe(204);
	});

	it.each([
		SaleStatus.APPROVED,
		SaleStatus.COMPLETED,
	])("should return 403 on PUT without commissions and changed totalAmount when sale status is %s and member has no commission permissions", async (saleStatus) => {
		const fixture = await createFixture();
		const createdSaleResponse = await createSale({
			fixture,
			token: fixture.token,
			commissions: buildCommissionInput(fixture.seller.id),
		});
		expect(createdSaleResponse.statusCode).toBe(201);
		const saleId = createdSaleResponse.body.saleId as string;

		await prisma.sale.update({
			where: {
				id: saleId,
			},
			data: {
				status: saleStatus,
			},
		});

		await denyPermissions({
			organizationId: fixture.org.id,
			memberId: fixture.adminMember.member.id,
			permissionKeys: COMMISSION_PERMISSIONS,
		});

		const updateResponse = await updateSale({
			fixture,
			token: fixture.token,
			saleId,
			totalAmount: 130_000,
		});

		expect(updateResponse.statusCode).toBe(403);
	});
});
