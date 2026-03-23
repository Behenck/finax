import { MemberDataScope, Role } from "generated/prisma/enums";
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

describe("members partners scope", () => {
	beforeAll(async () => {
		app = await createTestApp();
	});

	afterAll(async () => {
		await app.close();
	});

	it("should update and return partnersScope for a member", async () => {
		const { user, org } = await makeUser();
		const token = await authenticate(user.email, user.password);
		const suffix = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`;

		const targetUser = await prisma.user.create({
			data: {
				name: `Member ${suffix}`,
				email: `member-${suffix}@example.com`,
			},
		});

		const targetMember = await prisma.member.create({
			data: {
				organizationId: org.id,
				userId: targetUser.id,
				role: Role.MEMBER,
			},
		});

		const updateResponse = await request(app.server)
			.put(`/organizations/${org.slug}/members/${targetMember.id}`)
			.set("Authorization", `Bearer ${token}`)
			.send({
				role: Role.MEMBER,
				dataScopes: {
					customersScope: MemberDataScope.ORGANIZATION_ALL,
					salesScope: MemberDataScope.ORGANIZATION_ALL,
					commissionsScope: MemberDataScope.ORGANIZATION_ALL,
					partnersScope: MemberDataScope.LINKED_ONLY,
				},
			});

		expect(updateResponse.statusCode).toBe(204);

		const membersResponse = await request(app.server)
			.get(`/organizations/${org.slug}/members`)
			.set("Authorization", `Bearer ${token}`);

		expect(membersResponse.statusCode).toBe(200);

		const member = membersResponse.body.members.find(
			(item: { id: string }) => item.id === targetMember.id,
		);

		expect(member?.partnersScope).toBe(MemberDataScope.LINKED_ONLY);
	});
});
