import { describe, beforeAll, afterAll, it, expect } from "vitest";
import request from "supertest";
import { createTestApp } from "../../utils/test-app";
import { makeUser } from "../../factories/make-user";

let app: any;

describe("Get me", () => {
	beforeAll(async () => {
		app = await createTestApp();
	});

	afterAll(async () => {
		await app.close();
	});

	it("should request me", async () => {
		const { user, org } = await makeUser();

		const loginResponse = await request(app.server)
			.post("/sessions/password")
			.send({
				email: user.email,
				password: user.password,
			});

		expect(loginResponse.statusCode).toBe(200);

		const accessToken = loginResponse.body.accessToken;

		const meResponse = await request(app.server)
			.get("/me")
			.set("Authorization", `Bearer ${accessToken}`)
			.query({
				slug: org.slug,
			});

		expect(meResponse.statusCode).toBe(200);

		expect(meResponse.body).toHaveProperty("user");
		expect(meResponse.body).toHaveProperty("organization");
		expect(meResponse.body.organization).toHaveProperty(
			"enableSalesTransactionsSync",
		);
		expect(
			typeof meResponse.body.organization.enableSalesTransactionsSync,
		).toBe("boolean");
	});
});
