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

	return {
		token,
		org,
		company,
		unit,
		suffix,
	};
}

describe("employees crud", () => {
	beforeAll(async () => {
		app = await createTestApp();
	});

	afterAll(async () => {
		await app.close();
	});

	it("should link userId automatically on create when e-mail already exists", async () => {
		const fixture = await createAuthenticatedFixture();
		const linkedUser = await prisma.user.create({
			data: {
				name: `Linked user ${fixture.suffix}`,
				email: `linked-${fixture.suffix}@example.com`,
			},
		});

		const response = await request(app.server)
			.post(`/organizations/${fixture.org.slug}/employees`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				name: "Funcionário A",
				email: `  LINKED-${fixture.suffix}@EXAMPLE.com  `,
				companyId: fixture.company.id,
				unitId: fixture.unit.id,
			});

		expect(response.statusCode).toBe(201);

		const employee = await prisma.employee.findUnique({
			where: {
				id: response.body.employeeId as string,
			},
			select: {
				userId: true,
				email: true,
			},
		});

		expect(employee?.userId).toBe(linkedUser.id);
		expect(employee?.email).toBe(`linked-${fixture.suffix}@example.com`);
	});

	it("should keep userId as null when no user exists with the given e-mail", async () => {
		const fixture = await createAuthenticatedFixture();

		const response = await request(app.server)
			.post(`/organizations/${fixture.org.slug}/employees`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				name: "Funcionário B",
				email: `no-user-${fixture.suffix}@example.com`,
				phone: "(51) 99999-0000",
				companyId: fixture.company.id,
			});

		expect(response.statusCode).toBe(201);

		const employee = await prisma.employee.findUnique({
			where: {
				id: response.body.employeeId as string,
			},
			select: {
				userId: true,
				phone: true,
			},
		});

		expect(employee?.userId).toBeNull();
		expect(employee?.phone).toBe("(51) 99999-0000");
	});

	it("should relink userId automatically on update when e-mail changes", async () => {
		const fixture = await createAuthenticatedFixture();
		const firstUser = await prisma.user.create({
			data: {
				name: `First user ${fixture.suffix}`,
				email: `first-${fixture.suffix}@example.com`,
			},
		});
		const secondUser = await prisma.user.create({
			data: {
				name: `Second user ${fixture.suffix}`,
				email: `second-${fixture.suffix}@example.com`,
			},
		});

		const createResponse = await request(app.server)
			.post(`/organizations/${fixture.org.slug}/employees`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				name: "Funcionário C",
				email: firstUser.email,
				phone: "(51) 98888-1111",
				companyId: fixture.company.id,
			});

		expect(createResponse.statusCode).toBe(201);

		const updateResponse = await request(app.server)
			.put(
				`/organizations/${fixture.org.slug}/employees/${createResponse.body.employeeId}`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				name: "Funcionário C atualizado",
				email: secondUser.email,
				phone: "(51) 97777-2222",
				companyId: fixture.company.id,
			});

		expect(updateResponse.statusCode).toBe(204);

		const employee = await prisma.employee.findUnique({
			where: {
				id: createResponse.body.employeeId as string,
			},
			select: {
				userId: true,
				email: true,
				phone: true,
			},
		});

		expect(employee?.userId).toBe(secondUser.id);
		expect(employee?.email).toBe(secondUser.email);
		expect(employee?.phone).toBe("(51) 97777-2222");
	});

	it("should return 400 when trying to link the same user to another employee in the same organization", async () => {
		const fixture = await createAuthenticatedFixture();
		const linkedUser = await prisma.user.create({
			data: {
				name: `Conflict user ${fixture.suffix}`,
				email: `conflict-${fixture.suffix}@example.com`,
			},
		});

		const firstEmployeeResponse = await request(app.server)
			.post(`/organizations/${fixture.org.slug}/employees`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				name: "Funcionário D1",
				email: linkedUser.email,
				companyId: fixture.company.id,
			});

		expect(firstEmployeeResponse.statusCode).toBe(201);

		const secondEmployeeResponse = await request(app.server)
			.post(`/organizations/${fixture.org.slug}/employees`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				name: "Funcionário D2",
				email: `free-${fixture.suffix}@example.com`,
				companyId: fixture.company.id,
			});

		expect(secondEmployeeResponse.statusCode).toBe(201);

		const updateResponse = await request(app.server)
			.put(
				`/organizations/${fixture.org.slug}/employees/${secondEmployeeResponse.body.employeeId}`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				name: "Funcionário D2 atualizado",
				email: linkedUser.email,
				companyId: fixture.company.id,
			});

		expect(updateResponse.statusCode).toBe(400);
		expect(updateResponse.body.message).toContain("already linked");
	});

	it("should return extended employee fields on GET /organizations/:slug/employees", async () => {
		const fixture = await createAuthenticatedFixture();
		const linkedUser = await prisma.user.create({
			data: {
				name: `Linked employee user ${fixture.suffix}`,
				email: `extended-${fixture.suffix}@example.com`,
				avatarUrl: "https://avatar.example.com/employee.png",
			},
		});
		const linkedMember = await prisma.member.create({
			data: {
				organizationId: fixture.org.id,
				userId: linkedUser.id,
				role: Role.MEMBER,
			},
		});
		await prisma.memberCompanyAccess.create({
			data: {
				memberId: linkedMember.id,
				organizationId: fixture.org.id,
				companyId: fixture.company.id,
				unitId: fixture.unit.id,
			},
		});

		const createResponse = await request(app.server)
			.post(`/organizations/${fixture.org.slug}/employees`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				name: "Funcionário E",
				email: `extended-${fixture.suffix}@example.com`,
				phone: "(51) 95555-3333",
				companyId: fixture.company.id,
				unitId: fixture.unit.id,
				cpf: "111.222.333-44",
				pixKeyType: "EMAIL",
				pixKey: `pix-${fixture.suffix}@example.com`,
				paymentNotes: "Banco XP, ag 0001, cc 99999-1",
				country: "BR",
				state: "RS",
				city: "Porto Alegre",
				street: "Rua Teste",
				zipCode: "90000-000",
				neighborhood: "Centro",
				number: "120",
				complement: "Sala 202",
			});

		expect(createResponse.statusCode).toBe(201);

		const getResponse = await request(app.server)
			.get(`/organizations/${fixture.org.slug}/employees`)
			.set("Authorization", `Bearer ${fixture.token}`);

		expect(getResponse.statusCode).toBe(200);
		expect(getResponse.body.employees).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: createResponse.body.employeeId,
					phone: "(51) 95555-3333",
					cpf: "111.222.333-44",
					pixKeyType: "EMAIL",
					pixKey: `pix-${fixture.suffix}@example.com`,
					paymentNotes: "Banco XP, ag 0001, cc 99999-1",
					country: "BR",
					state: "RS",
					city: "Porto Alegre",
					street: "Rua Teste",
					zipCode: "90000-000",
					neighborhood: "Centro",
					number: "120",
					complement: "Sala 202",
					linkedUser: {
						id: linkedUser.id,
						name: linkedUser.name,
						email: linkedUser.email,
						avatarUrl: linkedUser.avatarUrl,
						membership: {
							id: linkedMember.id,
							role: "MEMBER",
							accesses: [
								{
									companyId: fixture.company.id,
									companyName: fixture.company.name,
									unitId: fixture.unit.id,
									unitName: fixture.unit.name,
								},
							],
						},
					},
				}),
			]),
		);
	});

	it("should return linkedUser as null when employee has no linked user", async () => {
		const fixture = await createAuthenticatedFixture();

		const createResponse = await request(app.server)
			.post(`/organizations/${fixture.org.slug}/employees`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				name: "Funcionário Sem Vínculo",
				email: `no-link-${fixture.suffix}@example.com`,
				companyId: fixture.company.id,
			});

		expect(createResponse.statusCode).toBe(201);

		const getResponse = await request(app.server)
			.get(`/organizations/${fixture.org.slug}/employees`)
			.set("Authorization", `Bearer ${fixture.token}`);

		expect(getResponse.statusCode).toBe(200);
		expect(getResponse.body.employees).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: createResponse.body.employeeId,
					userId: null,
					linkedUser: null,
				}),
			]),
		);
	});

	it("should return linked user membership as null when linked user is not a member of the organization", async () => {
		const fixture = await createAuthenticatedFixture();
		const linkedUser = await prisma.user.create({
			data: {
				name: `Detached user ${fixture.suffix}`,
				email: `detached-${fixture.suffix}@example.com`,
			},
		});

		const createResponse = await request(app.server)
			.post(`/organizations/${fixture.org.slug}/employees`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				name: "Funcionário Sem Membro",
				email: linkedUser.email,
				companyId: fixture.company.id,
			});

		expect(createResponse.statusCode).toBe(201);

		const getResponse = await request(app.server)
			.get(`/organizations/${fixture.org.slug}/employees`)
			.set("Authorization", `Bearer ${fixture.token}`);

		expect(getResponse.statusCode).toBe(200);
		expect(getResponse.body.employees).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: createResponse.body.employeeId,
					userId: linkedUser.id,
					linkedUser: {
						id: linkedUser.id,
						name: linkedUser.name,
						email: linkedUser.email,
						avatarUrl: null,
						membership: null,
					},
				}),
			]),
		);
	});
});
