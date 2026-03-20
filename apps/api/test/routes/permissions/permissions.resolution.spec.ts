import { hash } from "bcryptjs";
import { Role } from "generated/prisma/enums";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { makeUser } from "../../factories/make-user";
import { createTestApp } from "../../utils/test-app";

let app: Awaited<ReturnType<typeof createTestApp>>;

const MEMBER_PRESET_KEYS = ["sales.view", "settings.members.view"] as const;

async function authenticate(email: string, password: string) {
	const response = await request(app.server).post("/sessions/password").send({
		email,
		password,
	});

	expect(response.statusCode).toBe(200);
	return response.body.accessToken as string;
}

async function createOrganizationMember(params: {
	organizationId: string;
	role: (typeof Role)[keyof typeof Role];
	email: string;
	password: string;
}) {
	const passwordHash = await hash(params.password, 6);
	const user = await prisma.user.create({
		data: {
			name: params.email.split("@")[0] ?? params.email,
			email: params.email,
			passwordHash,
			emailVerifiedAt: new Date(),
		},
	});

	const member = await prisma.member.create({
		data: {
			organizationId: params.organizationId,
			userId: user.id,
			role: params.role,
		},
	});

	return {
		user,
		member,
	};
}

async function replaceRolePresetForTest(params: {
	organizationId: string;
	role: (typeof Role)[keyof typeof Role];
	allowedPermissionKeys: readonly string[];
}) {
	const activePermissions = await prisma.permission.findMany({
		where: {
			isActive: true,
		},
		select: {
			id: true,
			key: true,
		},
	});

	const activePermissionIds = activePermissions.map((permission) => permission.id);
	const permissionIdByKey = new Map(
		activePermissions.map((permission) => [permission.key, permission.id]),
	);

	const rows = activePermissions.map((permission) => ({
		organizationId: params.organizationId,
		role: params.role,
		permissionId: permission.id,
		allowed: false,
	}));

	await prisma.organizationRolePermission.createMany({
		data: rows,
		skipDuplicates: true,
	});

	await prisma.organizationRolePermission.updateMany({
		where: {
			organizationId: params.organizationId,
			role: params.role,
			permissionId: {
				in: activePermissionIds,
			},
		},
		data: {
			allowed: false,
		},
	});

	const allowedPermissionIds = params.allowedPermissionKeys
		.map((permissionKey) => permissionIdByKey.get(permissionKey))
		.filter((permissionId): permissionId is string => Boolean(permissionId));

	if (allowedPermissionIds.length > 0) {
		await prisma.organizationRolePermission.updateMany({
			where: {
				organizationId: params.organizationId,
				role: params.role,
				permissionId: {
					in: allowedPermissionIds,
				},
			},
			data: {
				allowed: true,
			},
		});
	}
}

describe("permissions resolution", () => {
	beforeAll(async () => {
		app = await createTestApp();
	});

	afterAll(async () => {
		await app.close();
	});

	it("should apply role preset and member overrides to effective permissions", async () => {
		const { user: ownerUser, org } = await makeUser();
		const ownerToken = await authenticate(ownerUser.email, ownerUser.password);
		const suffix = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`;

		const catalogResponse = await request(app.server)
			.get(`/organizations/${org.slug}/permissions/catalog`)
			.set("Authorization", `Bearer ${ownerToken}`);
		expect(catalogResponse.statusCode).toBe(200);

		await replaceRolePresetForTest({
			organizationId: org.id,
			role: Role.MEMBER,
			allowedPermissionKeys: MEMBER_PRESET_KEYS,
		});

		const memberPassword = "123456";
		const createdMember = await createOrganizationMember({
			organizationId: org.id,
			role: Role.MEMBER,
			email: `member-permissions-${suffix}@example.com`,
			password: memberPassword,
		});
		const memberToken = await authenticate(
			createdMember.user.email,
			memberPassword,
		);

		const memberMeResponse = await request(app.server)
			.get("/me")
			.set("Authorization", `Bearer ${memberToken}`);

		expect(memberMeResponse.statusCode).toBe(200);
		expect(memberMeResponse.body.effectivePermissions).toEqual(
			[...MEMBER_PRESET_KEYS].sort((first, second) =>
				first.localeCompare(second),
			),
		);

		const memberCatalogForbiddenResponse = await request(app.server)
			.get(`/organizations/${org.slug}/permissions/catalog`)
			.set("Authorization", `Bearer ${memberToken}`);

		expect(memberCatalogForbiddenResponse.statusCode).toBe(403);

		const overrideResponse = await request(app.server)
			.put(`/organizations/${org.slug}/members/${createdMember.member.id}/permissions`)
			.set("Authorization", `Bearer ${ownerToken}`)
			.send({
				overrides: [
					{
						permissionKey: "settings.permissions.manage",
						effect: "ALLOW",
					},
					{
						permissionKey: "sales.view",
						effect: "DENY",
					},
				],
			});

		expect(overrideResponse.statusCode).toBe(204);

		const memberPermissionsResponse = await request(app.server)
			.get(`/organizations/${org.slug}/members/${createdMember.member.id}/permissions`)
			.set("Authorization", `Bearer ${ownerToken}`);

		expect(memberPermissionsResponse.statusCode).toBe(200);
		expect(memberPermissionsResponse.body.effectivePermissions).toContain(
			"settings.permissions.manage",
		);
		expect(memberPermissionsResponse.body.effectivePermissions).toContain(
			"settings.members.view",
		);
		expect(memberPermissionsResponse.body.effectivePermissions).not.toContain(
			"sales.view",
		);

		const memberCatalogAllowedResponse = await request(app.server)
			.get(`/organizations/${org.slug}/permissions/catalog`)
			.set("Authorization", `Bearer ${memberToken}`);

		expect(memberCatalogAllowedResponse.statusCode).toBe(200);

		const memberMeAfterOverrideResponse = await request(app.server)
			.get("/me")
			.set("Authorization", `Bearer ${memberToken}`);

		expect(memberMeAfterOverrideResponse.statusCode).toBe(200);
		expect(memberMeAfterOverrideResponse.body.effectivePermissions).toContain(
			"settings.permissions.manage",
		);
		expect(memberMeAfterOverrideResponse.body.effectivePermissions).not.toContain(
			"sales.view",
		);
	});
});
