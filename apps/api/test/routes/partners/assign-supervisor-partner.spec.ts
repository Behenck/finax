import { Role } from "generated/prisma/enums";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { makeUser } from "../../factories/make-user";
import { createTestApp } from "../../utils/test-app";

let app: Awaited<ReturnType<typeof createTestApp>>;

async function createAuthenticatedFixture() {
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

	return {
		token,
		org,
		suffix,
	};
}

async function createPartner(organizationId: string, suffix: string) {
	return prisma.partner.create({
		data: {
			name: `Partner ${suffix}`,
			email: `partner-${suffix}@example.com`,
			phone: "55999999999",
			companyName: `Partner company ${suffix}`,
			documentType: "CPF",
			document: `${Math.floor(Math.random() * 1_000_000_000_000)}`,
			country: "BR",
			state: "RS",
			organizationId,
		},
	});
}

describe("assign supervisor to partner", () => {
	beforeAll(async () => {
		app = await createTestApp();
	});

	afterAll(async () => {
		await app.close();
	});

	it("should assign supervisor members to partner", async () => {
		const fixture = await createAuthenticatedFixture();
		const partner = await createPartner(fixture.org.id, fixture.suffix);

		const supervisorUser = await prisma.user.create({
			data: {
				name: `Supervisor ${fixture.suffix}`,
				email: `supervisor-${fixture.suffix}@example.com`,
			},
		});

		await prisma.member.create({
			data: {
				organizationId: fixture.org.id,
				userId: supervisorUser.id,
				role: Role.SUPERVISOR,
			},
		});

		const secondSupervisorUser = await prisma.user.create({
			data: {
				name: `Supervisor 2 ${fixture.suffix}`,
				email: `supervisor-2-${fixture.suffix}@example.com`,
			},
		});

		await prisma.member.create({
			data: {
				organizationId: fixture.org.id,
				userId: secondSupervisorUser.id,
				role: Role.SUPERVISOR,
			},
		});

		const response = await request(app.server)
			.patch(
				`/organizations/${fixture.org.slug}/partners/${partner.id}/assign-supervisor`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				supervisorIds: [supervisorUser.id, secondSupervisorUser.id],
			});

		expect(response.statusCode).toBe(204);

		const partnerSupervisors = await prisma.partnerSupervisor.findMany({
			where: {
				partnerId: partner.id,
			},
			select: {
				supervisorId: true,
			},
			orderBy: {
				supervisorId: "asc",
			},
		});

		expect(partnerSupervisors.map((link) => link.supervisorId).sort()).toEqual(
			[supervisorUser.id, secondSupervisorUser.id].sort(),
		);
	});

	it("should remove supervisors when supervisorIds is empty", async () => {
		const fixture = await createAuthenticatedFixture();
		const partner = await createPartner(fixture.org.id, fixture.suffix);

		const supervisorUser = await prisma.user.create({
			data: {
				name: `Supervisor remove ${fixture.suffix}`,
				email: `supervisor-remove-${fixture.suffix}@example.com`,
			},
		});

		await prisma.member.create({
			data: {
				organizationId: fixture.org.id,
				userId: supervisorUser.id,
				role: Role.SUPERVISOR,
			},
		});

		await prisma.partnerSupervisor.create({
			data: {
				organizationId: fixture.org.id,
				partnerId: partner.id,
				supervisorId: supervisorUser.id,
			},
		});

		const response = await request(app.server)
			.patch(
				`/organizations/${fixture.org.slug}/partners/${partner.id}/assign-supervisor`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				supervisorIds: [],
			});

		expect(response.statusCode).toBe(204);

		const partnerSupervisors = await prisma.partnerSupervisor.findMany({
			where: {
				partnerId: partner.id,
			},
		});

		expect(partnerSupervisors).toHaveLength(0);
	});

	it("should return 400 when supervisor does not have SUPERVISOR role in organization", async () => {
		const fixture = await createAuthenticatedFixture();
		const partner = await createPartner(fixture.org.id, fixture.suffix);

		const adminUser = await prisma.user.create({
			data: {
				name: `Admin user ${fixture.suffix}`,
				email: `admin-user-${fixture.suffix}@example.com`,
			},
		});

		await prisma.member.create({
			data: {
				organizationId: fixture.org.id,
				userId: adminUser.id,
				role: Role.ADMIN,
			},
		});

		const response = await request(app.server)
			.patch(
				`/organizations/${fixture.org.slug}/partners/${partner.id}/assign-supervisor`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				supervisorIds: [adminUser.id],
			});

		expect(response.statusCode).toBe(400);
		expect(response.body.message).toBe(
			"One or more supervisors were not found",
		);
	});
});
