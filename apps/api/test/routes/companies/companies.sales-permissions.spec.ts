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
			name: `Companies sales member ${suffix}`,
			email: `companies-sales-${suffix}@example.com`,
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

describe("companies permissions in sales flow", () => {
	beforeAll(async () => {
		app = await createTestApp();
	});

	afterAll(async () => {
		await app.close();
	});

	it("should allow listing scoped companies with sales permissions even when companies.view is denied", async () => {
		const { org } = await makeUser();
		await getPermissionCatalog();

		const suffix = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
		const adminMember = await createAdminMemberFixture(org.id, suffix);
		const token = await authenticate(adminMember.user.email, adminMember.password);

		const allowedCompany = await prisma.company.create({
			data: {
				organizationId: org.id,
				name: `Empresa ${suffix}`,
			},
		});
		await prisma.unit.create({
			data: {
				companyId: allowedCompany.id,
				name: `Unidade ${suffix}`,
			},
		});

		await denyPermission({
			organizationId: org.id,
			memberId: adminMember.member.id,
			permissionKey: "registers.companies.view",
		});
		await prisma.memberCompanyAccess.create({
			data: {
				organizationId: org.id,
				memberId: adminMember.member.id,
				companyId: allowedCompany.id,
				unitId: null,
			},
		});

		const listResponse = await request(app.server)
			.get(`/organizations/${org.slug}/companies`)
			.set("Authorization", `Bearer ${token}`);

		expect(listResponse.statusCode).toBe(200);
		expect(Array.isArray(listResponse.body.companies)).toBe(true);
		expect(listResponse.body.companies).toHaveLength(1);
		expect(listResponse.body.companies[0]?.id).toBe(allowedCompany.id);
	});

	it("should list only member scoped companies for sales flow when companies.view is denied", async () => {
		const { org } = await makeUser();
		await getPermissionCatalog();

		const suffix = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
		const adminMember = await createAdminMemberFixture(org.id, suffix);
		const token = await authenticate(adminMember.user.email, adminMember.password);

		const allowedCompany = await prisma.company.create({
			data: {
				organizationId: org.id,
				name: `Empresa permitida ${suffix}`,
			},
		});
		const deniedCompany = await prisma.company.create({
			data: {
				organizationId: org.id,
				name: `Empresa bloqueada ${suffix}`,
			},
		});
		const allowedUnit = await prisma.unit.create({
			data: {
				companyId: allowedCompany.id,
				name: `Unidade permitida ${suffix}`,
			},
		});
		await prisma.unit.create({
			data: {
				companyId: deniedCompany.id,
				name: `Unidade bloqueada ${suffix}`,
			},
		});

		await denyPermission({
			organizationId: org.id,
			memberId: adminMember.member.id,
			permissionKey: "registers.companies.view",
		});

		await prisma.memberCompanyAccess.create({
			data: {
				organizationId: org.id,
				memberId: adminMember.member.id,
				companyId: allowedCompany.id,
				unitId: allowedUnit.id,
			},
		});

		const listResponse = await request(app.server)
			.get(`/organizations/${org.slug}/companies`)
			.set("Authorization", `Bearer ${token}`);

		expect(listResponse.statusCode).toBe(200);
		expect(listResponse.body.companies).toHaveLength(1);
		expect(listResponse.body.companies[0]?.id).toBe(allowedCompany.id);
		expect(listResponse.body.companies[0]?.units).toHaveLength(1);
		expect(listResponse.body.companies[0]?.units[0]?.id).toBe(allowedUnit.id);
	});

	it("should return no companies when member has sales permissions but no company access and companies.view is denied", async () => {
		const { org } = await makeUser();
		await getPermissionCatalog();

		const suffix = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
		const adminMember = await createAdminMemberFixture(org.id, suffix);
		const token = await authenticate(adminMember.user.email, adminMember.password);

		await prisma.company.create({
			data: {
				organizationId: org.id,
				name: `Empresa ${suffix}`,
			},
		});

		await denyPermission({
			organizationId: org.id,
			memberId: adminMember.member.id,
			permissionKey: "registers.companies.view",
		});

		const listResponse = await request(app.server)
			.get(`/organizations/${org.slug}/companies`)
			.set("Authorization", `Bearer ${token}`);

		expect(listResponse.statusCode).toBe(200);
		expect(listResponse.body.companies).toEqual([]);
	});
});
