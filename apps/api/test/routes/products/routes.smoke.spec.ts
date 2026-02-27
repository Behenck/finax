import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestApp } from "../../utils/test-app";

const UUID_SAMPLE = "11111111-1111-4111-8111-111111111111";

function fillPathParams(path: string) {
	return path
		.replace(/:slug\b/g, "test-org")
		.replace(/:role\b/g, "ADMIN")
		.replace(/:[a-zA-Z]+Id\b/g, UUID_SAMPLE)
		.replace(/:id\b/g, UUID_SAMPLE);
}

let app: Awaited<ReturnType<typeof createTestApp>>;

describe("products routes smoke", () => {
	beforeAll(async () => {
		app = await createTestApp();
	});

	afterAll(async () => {
		await app.close();
	});

	it("DELETE /organizations/:slug/products/:id should be registered", async () => {
		const url = fillPathParams("/organizations/:slug/products/:id");
		const agent = request(app.server);
		const response = await agent.delete(url);

		expect(response.statusCode).not.toBe(404);
		expect(response.statusCode).not.toBe(405);
	});

	it("GET /organizations/:slug/products/:id should be registered", async () => {
		const url = fillPathParams("/organizations/:slug/products/:id");
		const agent = request(app.server);
		const response = await agent.get(url);

		expect(response.statusCode).not.toBe(404);
		expect(response.statusCode).not.toBe(405);
	});

	it("PUT /organizations/:slug/products/:id should be registered", async () => {
		const url = fillPathParams("/organizations/:slug/products/:id");
		const agent = request(app.server);
		const response = await agent.put(url).send({});

		expect(response.statusCode).not.toBe(404);
		expect(response.statusCode).not.toBe(405);
	});

	it("GET /organizations/:slug/products should be registered", async () => {
		const url = fillPathParams("/organizations/:slug/products");
		const agent = request(app.server);
		const response = await agent.get(url);

		expect(response.statusCode).not.toBe(404);
		expect(response.statusCode).not.toBe(405);
	});

	it("POST /organizations/:slug/products should be registered", async () => {
		const url = fillPathParams("/organizations/:slug/products");
		const agent = request(app.server);
		const response = await agent.post(url).send({});

		expect(response.statusCode).not.toBe(404);
		expect(response.statusCode).not.toBe(405);
	});

	it("GET /organizations/:slug/products/:id/commission-scenarios should be registered", async () => {
		const url = fillPathParams(
			"/organizations/:slug/products/:id/commission-scenarios",
		);
		const agent = request(app.server);
		const response = await agent.get(url);

		expect(response.statusCode).not.toBe(404);
		expect(response.statusCode).not.toBe(405);
	});

	it("PUT /organizations/:slug/products/:id/commission-scenarios should be registered", async () => {
		const url = fillPathParams(
			"/organizations/:slug/products/:id/commission-scenarios",
		);
		const agent = request(app.server);
		const response = await agent.put(url).send({});

		expect(response.statusCode).not.toBe(404);
		expect(response.statusCode).not.toBe(405);
	});
});
