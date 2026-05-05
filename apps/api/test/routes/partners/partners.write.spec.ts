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

describe("partner write routes", () => {
	beforeAll(async () => {
		app = await createTestApp();
	});

	afterAll(async () => {
		await app.close();
	});

	it("should create a partner requiring only company name", async () => {
		const { user, org } = await makeUser();
		const token = await authenticate(user.email, user.password);

		const response = await request(app.server)
			.post(`/organizations/${org.slug}/partners`)
			.set("Authorization", `Bearer ${token}`)
			.send({
				name: "",
				email: "",
				phone: "",
				companyName: "Parceiro Sem Contato LTDA",
				documentType: "CNPJ",
				document: "",
				country: "BR",
				state: "RS",
			});

		expect(response.statusCode).toBe(201);
		expect(response.body.partnerId).toEqual(expect.any(String));

		const partner = await prisma.partner.findUnique({
			where: {
				id: response.body.partnerId,
			},
		});

		expect(partner).not.toBeNull();
		expect(partner?.companyName).toBe("Parceiro Sem Contato LTDA");
		expect(partner?.name).toBeNull();
		expect(partner?.email).toBeNull();
		expect(partner?.phone).toBeNull();
		expect(partner?.documentType).toBeNull();
		expect(partner?.document).toBeNull();
	});

	it("should update a partner clearing optional contact and document fields", async () => {
		const { user, org } = await makeUser();
		const token = await authenticate(user.email, user.password);
		const suffix = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`;

		const partner = await prisma.partner.create({
			data: {
				name: `Partner ${suffix}`,
				email: `partner-${suffix}@example.com`,
				phone: "55999999999",
				companyName: `Partner company ${suffix}`,
				documentType: "CPF",
				document: `${Math.floor(Math.random() * 1_000_000_000_000)}`,
				country: "BR",
				state: "RS",
				organizationId: org.id,
			},
		});

		const response = await request(app.server)
			.put(`/organizations/${org.slug}/partners/${partner.id}`)
			.set("Authorization", `Bearer ${token}`)
			.send({
				name: "",
				email: "",
				phone: "",
				companyName: "Empresa Atualizada LTDA",
				documentType: "CPF",
				document: "",
				country: "BR",
				state: "SC",
			});

		expect(response.statusCode).toBe(204);

		const updatedPartner = await prisma.partner.findUnique({
			where: {
				id: partner.id,
			},
		});

		expect(updatedPartner).not.toBeNull();
		expect(updatedPartner?.companyName).toBe("Empresa Atualizada LTDA");
		expect(updatedPartner?.state).toBe("SC");
		expect(updatedPartner?.name).toBeNull();
		expect(updatedPartner?.email).toBeNull();
		expect(updatedPartner?.phone).toBeNull();
		expect(updatedPartner?.documentType).toBeNull();
		expect(updatedPartner?.document).toBeNull();
	});
});
