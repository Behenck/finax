import { hash } from "bcryptjs";
import { PermissionOverrideEffect, Role } from "generated/prisma/enums";
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

async function createSupervisorFixture(organizationId: string, suffix: string) {
	const password = "123456";
	const passwordHash = await hash(password, 6);
	const user = await prisma.user.create({
		data: {
			name: `Supervisor ${suffix}`,
			email: `supervisor-${suffix}@example.com`,
			passwordHash,
			emailVerifiedAt: new Date(),
		},
	});

	const member = await prisma.member.create({
		data: {
			organizationId,
			userId: user.id,
			role: Role.SUPERVISOR,
		},
	});

	return {
		user,
		member,
		password,
	};
}

async function denyViewAllPartners(params: {
	organizationId: string;
	memberId: string;
}) {
	const permission = await prisma.permission.findUnique({
		where: {
			key: "registers.partners.view.all",
		},
		select: {
			id: true,
		},
	});

	if (!permission) {
		throw new Error("Permission registers.partners.view.all not found");
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

async function createPartner(params: {
	organizationId: string;
	suffix: string;
	supervisorId?: string | null;
}) {
	return prisma.partner.create({
		data: {
			name: `Partner ${params.suffix}`,
			email: `partner-${params.suffix}@example.com`,
			phone: "55999999999",
			companyName: `Partner company ${params.suffix}`,
			documentType: "CPF",
			document: `${Math.floor(Math.random() * 1_000_000_000_000)}`,
			country: "BR",
			state: "RS",
			organizationId: params.organizationId,
			supervisorId: params.supervisorId ?? null,
		},
	});
}

describe("partners visibility", () => {
	beforeAll(async () => {
		app = await createTestApp();
	});

	afterAll(async () => {
		await app.close();
	});

	it("should return all partners when member scope is organization wide", async () => {
		const { user, org } = await makeUser();
		const token = await authenticate(user.email, user.password);
		const suffix = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`;

		const firstPartner = await createPartner({
			organizationId: org.id,
			suffix: `${suffix}-all-1`,
		});
		const secondPartner = await createPartner({
			organizationId: org.id,
			suffix: `${suffix}-all-2`,
		});

		const response = await request(app.server)
			.get(`/organizations/${org.slug}/partners`)
			.set("Authorization", `Bearer ${token}`);

		expect(response.statusCode).toBe(200);
		expect(response.body.partners.map((partner: { id: string }) => partner.id)).toEqual(
			expect.arrayContaining([firstPartner.id, secondPartner.id]),
		);
	});

	it("should return only supervised partners and hide other partner details", async () => {
		const { org } = await makeUser();
		const suffix = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
		const supervisor = await createSupervisorFixture(org.id, suffix);
		const token = await authenticate(supervisor.user.email, supervisor.password);
		await denyViewAllPartners({
			organizationId: org.id,
			memberId: supervisor.member.id,
		});

		const visiblePartner = await createPartner({
			organizationId: org.id,
			suffix: `${suffix}-visible`,
			supervisorId: supervisor.user.id,
		});
		const hiddenPartner = await createPartner({
			organizationId: org.id,
			suffix: `${suffix}-hidden`,
		});

		const listResponse = await request(app.server)
			.get(`/organizations/${org.slug}/partners`)
			.set("Authorization", `Bearer ${token}`);

		expect(listResponse.statusCode).toBe(200);
		expect(listResponse.body.partners).toHaveLength(1);
		expect(listResponse.body.partners[0]?.id).toBe(visiblePartner.id);

		const detailResponse = await request(app.server)
			.get(`/organizations/${org.slug}/partners/${hiddenPartner.id}`)
			.set("Authorization", `Bearer ${token}`);

		expect(detailResponse.statusCode).toBe(400);
		expect(detailResponse.body.message).toBe("Partner not found");
	});
});
