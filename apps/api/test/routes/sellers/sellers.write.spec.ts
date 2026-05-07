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

describe("seller write routes", () => {
	beforeAll(async () => {
		app = await createTestApp();
	});

	afterAll(async () => {
		await app.close();
	});

	it("should create a seller without email and document fields", async () => {
		const { user, org } = await makeUser();
		const token = await authenticate(user.email, user.password);

		const response = await request(app.server)
			.post(`/organizations/${org.slug}/sellers`)
			.set("Authorization", `Bearer ${token}`)
			.send({
				name: "Vendedor Sem Documento",
				email: "",
				phone: "55999999999",
				companyName: "Empresa Sem Documento LTDA",
				documentType: undefined,
				document: "",
				country: "BR",
				state: "RS",
			});

		expect(response.statusCode).toBe(201);
		expect(response.body.sellerId).toEqual(expect.any(String));

		const seller = await prisma.seller.findUnique({
			where: {
				id: response.body.sellerId as string,
			},
		});

		expect(seller).not.toBeNull();
		expect(seller?.email).toBeNull();
		expect(seller?.documentType).toBeNull();
		expect(seller?.document).toBeNull();

		const listResponse = await request(app.server)
			.get(`/organizations/${org.slug}/sellers`)
			.set("Authorization", `Bearer ${token}`);

		expect(listResponse.statusCode).toBe(200);
		expect(listResponse.body.sellers).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: response.body.sellerId,
					email: null,
					documentType: null,
					document: null,
				}),
			]),
		);

		const detailsResponse = await request(app.server)
			.get(`/organizations/${org.slug}/sellers/${response.body.sellerId}`)
			.set("Authorization", `Bearer ${token}`);

		expect(detailsResponse.statusCode).toBe(200);
		expect(detailsResponse.body.seller).toEqual(
			expect.objectContaining({
				id: response.body.sellerId,
				email: null,
				documentType: null,
				document: null,
			}),
		);
	});

	it("should update a seller clearing email and document fields", async () => {
		const { user, org } = await makeUser();
		const token = await authenticate(user.email, user.password);
		const suffix = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`;

		const seller = await prisma.seller.create({
			data: {
				name: `Seller ${suffix}`,
				email: `seller-${suffix}@example.com`,
				phone: "55999999999",
				companyName: `Empresa ${suffix}`,
				documentType: "CPF",
				document: `${Math.floor(Math.random() * 1_000_000_000_000)}`,
				country: "BR",
				state: "RS",
				organizationId: org.id,
			},
		});

		const response = await request(app.server)
			.put(`/organizations/${org.slug}/sellers/${seller.id}`)
			.set("Authorization", `Bearer ${token}`)
			.send({
				name: `Seller ${suffix}`,
				email: "",
				phone: "55999999999",
				companyName: `Empresa ${suffix}`,
				documentType: "CPF",
				document: "",
				country: "BR",
				state: "SC",
			});

		expect(response.statusCode).toBe(204);

		const updatedSeller = await prisma.seller.findUnique({
			where: {
				id: seller.id,
			},
		});

		expect(updatedSeller).not.toBeNull();
		expect(updatedSeller?.email).toBeNull();
		expect(updatedSeller?.documentType).toBeNull();
		expect(updatedSeller?.document).toBeNull();
		expect(updatedSeller?.state).toBe("SC");
	});
});
