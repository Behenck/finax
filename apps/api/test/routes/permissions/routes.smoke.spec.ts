import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createTestApp } from "../../utils/test-app";

const UUID_SAMPLE = "11111111-1111-4111-8111-111111111111";

function fillPathParams(path: string) {
	return path
		.replace(/:slug\b/g, "test-org")
		.replace(/:[a-zA-Z]+Id\b/g, UUID_SAMPLE)
		.replace(/:id\b/g, UUID_SAMPLE);
}

let app: Awaited<ReturnType<typeof createTestApp>>;

describe("permissions routes smoke", () => {
	beforeAll(async () => {
		app = await createTestApp();
	});

	afterAll(async () => {
		await app.close();
	});

	it("GET /organizations/:slug/permissions/catalog should be registered", async () => {
		const url = fillPathParams("/organizations/:slug/permissions/catalog");
		const response = await request(app.server).get(url);

		expect(response.statusCode).not.toBe(404);
		expect(response.statusCode).not.toBe(405);
	});

	it("GET /organizations/:slug/members/:memberId/permissions should be registered", async () => {
		const url = fillPathParams(
			"/organizations/:slug/members/:memberId/permissions",
		);
		const response = await request(app.server).get(url);

		expect(response.statusCode).not.toBe(404);
		expect(response.statusCode).not.toBe(405);
	});

	it("PUT /organizations/:slug/members/:memberId/permissions should be registered", async () => {
		const url = fillPathParams(
			"/organizations/:slug/members/:memberId/permissions",
		);
		const response = await request(app.server).put(url).send({});

		expect(response.statusCode).not.toBe(404);
		expect(response.statusCode).not.toBe(405);
	});
});
