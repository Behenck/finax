import { hash } from "bcryptjs";
import { Role } from "generated/prisma/enums";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
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

describe("revoke invite", () => {
	beforeAll(async () => {
		app = await createTestApp();
	});

	afterAll(async () => {
		await app.close();
	});

	it("should delete an invite from the organization", async () => {
		const password = "123456";
		const passwordHash = await hash(password, 6);
		const user = await prisma.user.create({
			data: {
				name: "Invite Owner",
				email: `owner-${Date.now()}@example.com`,
				passwordHash,
				emailVerifiedAt: new Date(),
			},
		});

		const organization = await prisma.organization.create({
			data: {
				name: `Organization ${Date.now()}`,
				slug: `organization-${Date.now()}`,
				ownerId: user.id,
			},
		});

		await prisma.member.create({
			data: {
				organizationId: organization.id,
				userId: user.id,
				role: Role.ADMIN,
			},
		});

		const invite = await prisma.invite.create({
			data: {
				organizationId: organization.id,
				email: `invite-${Date.now()}@example.com`,
				role: Role.MEMBER,
				authorId: user.id,
			},
		});

		const token = await authenticate(user.email, password);

		const response = await request(app.server)
			.delete(`/organizations/${organization.slug}/invites/${invite.id}`)
			.set("Authorization", `Bearer ${token}`);

		expect(response.statusCode).toBe(204);

		const deletedInvite = await prisma.invite.findUnique({
			where: {
				id: invite.id,
			},
		});

		expect(deletedInvite).toBeNull();
	});
});
