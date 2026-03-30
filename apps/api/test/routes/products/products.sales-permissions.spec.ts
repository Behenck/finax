import { hash } from "bcryptjs";
import { PermissionOverrideEffect, Role } from "generated/prisma/enums";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { getPermissionCatalog } from "@/permissions/service";
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

async function createAdminMemberFixture(
	organizationId: string,
	suffix: string,
) {
	const password = "123456";
	const passwordHash = await hash(password, 6);
	const user = await prisma.user.create({
		data: {
			name: `Products sales member ${suffix}`,
			email: `products-sales-${suffix}@example.com`,
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

describe("products permissions in sales flow", () => {
	beforeAll(async () => {
		app = await createTestApp();
	});

	afterAll(async () => {
		await app.close();
	});

	it("should allow products listing and sale-fields with sales permissions even when products.view is denied", async () => {
		const { org } = await makeUser();
		await getPermissionCatalog();

		const suffix = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
		const adminMember = await createAdminMemberFixture(org.id, suffix);
		const token = await authenticate(adminMember.user.email, adminMember.password);

		const product = await prisma.product.create({
			data: {
				organizationId: org.id,
				name: `Produto ${suffix}`,
				description: "Produto para teste de permissões de venda",
				isActive: true,
			},
		});

		await denyPermission({
			organizationId: org.id,
			memberId: adminMember.member.id,
			permissionKey: "registers.products.view",
		});

		const listResponse = await request(app.server)
			.get(`/organizations/${org.slug}/products`)
			.set("Authorization", `Bearer ${token}`);

		expect(listResponse.statusCode).toBe(200);
		expect(Array.isArray(listResponse.body.products)).toBe(true);

		const saleFieldsResponse = await request(app.server)
			.get(`/organizations/${org.slug}/products/${product.id}/sale-fields`)
			.set("Authorization", `Bearer ${token}`);

		expect(saleFieldsResponse.statusCode).toBe(200);
		expect(Array.isArray(saleFieldsResponse.body.fields)).toBe(true);
	});
});
