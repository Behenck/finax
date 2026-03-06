import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { prisma } from "../../lib/prisma";
import { makeUser } from "../../factories/make-user";
import { createTestApp } from "../../utils/test-app";

let app: any;

describe("Patch me password", () => {
	beforeAll(async () => {
		app = await createTestApp();
	});

	afterAll(async () => {
		await app.close();
	});

	it("should update password when current password is valid", async () => {
		const { user } = await makeUser();
		const newPassword = "654321";

		const authResponse = await request(app.server).post("/sessions/password").send({
			email: user.email,
			password: user.password,
		});

		expect(authResponse.statusCode).toBe(200);

		const response = await request(app.server)
			.patch("/me/password")
			.set("Authorization", `Bearer ${authResponse.body.accessToken}`)
			.send({
				currentPassword: user.password,
				newPassword,
			});

		expect(response.statusCode).toBe(204);

		const oldLoginResponse = await request(app.server)
			.post("/sessions/password")
			.send({
				email: user.email,
				password: user.password,
			});

		expect(oldLoginResponse.statusCode).toBe(401);

		const newLoginResponse = await request(app.server)
			.post("/sessions/password")
			.send({
				email: user.email,
				password: newPassword,
			});

		expect(newLoginResponse.statusCode).toBe(200);
	});

	it("should return 400 when current password is invalid", async () => {
		const { user } = await makeUser();

		const authResponse = await request(app.server).post("/sessions/password").send({
			email: user.email,
			password: user.password,
		});

		expect(authResponse.statusCode).toBe(200);

		const response = await request(app.server)
			.patch("/me/password")
			.set("Authorization", `Bearer ${authResponse.body.accessToken}`)
			.send({
				currentPassword: "000000",
				newPassword: "654321",
			});

		expect(response.statusCode).toBe(400);
		expect(response.body.message).toBe("Current password is invalid.");
	});

	it("should return 400 when user does not have local password", async () => {
		const { user } = await makeUser();

		const authResponse = await request(app.server).post("/sessions/password").send({
			email: user.email,
			password: user.password,
		});

		expect(authResponse.statusCode).toBe(200);

		await prisma.user.update({
			where: {
				id: user.id,
			},
			data: {
				passwordHash: null,
			},
		});

		const response = await request(app.server)
			.patch("/me/password")
			.set("Authorization", `Bearer ${authResponse.body.accessToken}`)
			.send({
				currentPassword: user.password,
				newPassword: "654321",
			});

		expect(response.statusCode).toBe(400);
		expect(response.body.message).toBe("User does not have a local password.");
	});

	it("should return 400 when new password is the same as current password", async () => {
		const { user } = await makeUser();

		const authResponse = await request(app.server).post("/sessions/password").send({
			email: user.email,
			password: user.password,
		});

		expect(authResponse.statusCode).toBe(200);

		const response = await request(app.server)
			.patch("/me/password")
			.set("Authorization", `Bearer ${authResponse.body.accessToken}`)
			.send({
				currentPassword: user.password,
				newPassword: user.password,
			});

		expect(response.statusCode).toBe(400);
		expect(response.body.message).toBe(
			"New password must be different from current password.",
		);
	});
});
