import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { prisma } from "../../lib/prisma";
import { makeUser } from "../../factories/make-user";
import { createTestApp } from "../../utils/test-app";

let app: any;

describe("Patch me", () => {
	beforeAll(async () => {
		app = await createTestApp();
	});

	afterAll(async () => {
		await app.close();
	});

	it("should update current user's name and avatar URL", async () => {
		const { user } = await makeUser();

		const authResponse = await request(app.server).post("/sessions/password").send({
			email: user.email,
			password: user.password,
		});

		expect(authResponse.statusCode).toBe(200);

		const response = await request(app.server)
			.patch("/me")
			.set("Authorization", `Bearer ${authResponse.body.accessToken}`)
			.send({
				name: "Usuário Atualizado",
				avatarUrl: "https://example.com/avatar.png",
			});

		expect(response.statusCode).toBe(200);
		expect(response.body.user.name).toBe("Usuário Atualizado");
		expect(response.body.user.avatarUrl).toBe("https://example.com/avatar.png");

		const updatedUser = await prisma.user.findUnique({
			where: {
				id: user.id,
			},
			select: {
				name: true,
				avatarUrl: true,
			},
		});

		expect(updatedUser?.name).toBe("Usuário Atualizado");
		expect(updatedUser?.avatarUrl).toBe("https://example.com/avatar.png");
	});

	it("should return 400 when avatar URL is invalid", async () => {
		const { user } = await makeUser();

		const authResponse = await request(app.server).post("/sessions/password").send({
			email: user.email,
			password: user.password,
		});

		expect(authResponse.statusCode).toBe(200);

		const response = await request(app.server)
			.patch("/me")
			.set("Authorization", `Bearer ${authResponse.body.accessToken}`)
			.send({
				name: "Usuário Teste",
				avatarUrl: "invalid-url",
			});

		expect(response.statusCode).toBe(400);
	});

	it("should return 401 when token is missing", async () => {
		const response = await request(app.server).patch("/me").send({
			name: "Usuário sem token",
		});

		expect(response.statusCode).toBe(401);
	});
});
