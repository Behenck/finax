import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
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

describe("permissions catalog modules", () => {
	beforeAll(async () => {
		app = await createTestApp();
	});

	afterAll(async () => {
		await app.close();
	});

	it("should keep sales and commissions grouped in different modules inside sales section", async () => {
		const { user, org } = await makeUser();
		const token = await authenticate(user.email, user.password);

		const response = await request(app.server)
			.get(`/organizations/${org.slug}/permissions/catalog`)
			.set("Authorization", `Bearer ${token}`);

		expect(response.statusCode).toBe(200);

		const permissions = response.body.permissions as Array<{
			key: string;
			module: string;
		}>;

		const salesCommissionsPermissions = permissions.filter((permission) =>
			permission.key.startsWith("sales.commissions."),
		);
		expect(salesCommissionsPermissions.length).toBeGreaterThan(0);
		expect(
			salesCommissionsPermissions.every(
				(permission) => permission.module === "sales.commissions",
			),
		).toBe(true);

		const salesNonCommissionPermissions = permissions.filter(
			(permission) =>
				permission.key.startsWith("sales.") &&
				!permission.key.startsWith("sales.commissions."),
		);
		expect(salesNonCommissionPermissions.length).toBeGreaterThan(0);
		expect(
			salesNonCommissionPermissions.every(
				(permission) => permission.module === "sales",
			),
		).toBe(true);
	});
});
