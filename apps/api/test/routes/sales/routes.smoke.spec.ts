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

describe("sales routes smoke", () => {
	beforeAll(async () => {
		app = await createTestApp();
	});

	afterAll(async () => {
		await app.close();
	});

	it("DELETE /organizations/:slug/sales/:saleId should be registered", async () => {
		const url = fillPathParams("/organizations/:slug/sales/:saleId");
		const agent = request(app.server);
		const response = await agent.delete(url);

		expect(response.statusCode).not.toBe(404);
		expect(response.statusCode).not.toBe(405);
	});

	it("GET /organizations/:slug/sales/:saleId should be registered", async () => {
		const url = fillPathParams("/organizations/:slug/sales/:saleId");
		const agent = request(app.server);
		const response = await agent.get(url);

		expect(response.statusCode).not.toBe(404);
		expect(response.statusCode).not.toBe(405);
	});

	it("GET /organizations/:slug/sales/:saleId/history should be registered", async () => {
		const url = fillPathParams("/organizations/:slug/sales/:saleId/history");
		const agent = request(app.server);
		const response = await agent.get(url);

		expect(response.statusCode).not.toBe(404);
		expect(response.statusCode).not.toBe(405);
	});

	it("PUT /organizations/:slug/sales/:saleId should be registered", async () => {
		const url = fillPathParams("/organizations/:slug/sales/:saleId");
		const agent = request(app.server);
		const response = await agent.put(url).send({});

		expect(response.statusCode).not.toBe(404);
		expect(response.statusCode).not.toBe(405);
	});

	it("PATCH /organizations/:slug/sales/:saleId/status should be registered", async () => {
		const url = fillPathParams("/organizations/:slug/sales/:saleId/status");
		const agent = request(app.server);
		const response = await agent.patch(url).send({});

		expect(response.statusCode).not.toBe(404);
		expect(response.statusCode).not.toBe(405);
	});

	it("PATCH /organizations/:slug/sales/status/bulk should be registered", async () => {
		const url = fillPathParams("/organizations/:slug/sales/status/bulk");
		const agent = request(app.server);
		const response = await agent.patch(url).send({});

		expect(response.statusCode).not.toBe(404);
		expect(response.statusCode).not.toBe(405);
	});

	it("GET /organizations/:slug/sales/:saleId/commission-installments should be registered", async () => {
		const url = fillPathParams(
			"/organizations/:slug/sales/:saleId/commission-installments",
		);
		const agent = request(app.server);
		const response = await agent.get(url);

		expect(response.statusCode).not.toBe(404);
		expect(response.statusCode).not.toBe(405);
	});

	it("GET /organizations/:slug/commissions/installments should be registered", async () => {
		const url = fillPathParams("/organizations/:slug/commissions/installments");
		const agent = request(app.server);
		const response = await agent.get(url);

		expect(response.statusCode).not.toBe(404);
		expect(response.statusCode).not.toBe(405);
	});

	it("PATCH /organizations/:slug/sales/:saleId/commission-installments/:installmentId/status should be registered", async () => {
		const url = fillPathParams(
			"/organizations/:slug/sales/:saleId/commission-installments/:installmentId/status",
		);
		const agent = request(app.server);
		const response = await agent.patch(url).send({});

		expect(response.statusCode).not.toBe(404);
		expect(response.statusCode).not.toBe(405);
	});

	it("PATCH /organizations/:slug/sales/:saleId/commission-installments/:installmentId should be registered", async () => {
		const url = fillPathParams(
			"/organizations/:slug/sales/:saleId/commission-installments/:installmentId",
		);
		const agent = request(app.server);
		const response = await agent.patch(url).send({});

		expect(response.statusCode).not.toBe(404);
		expect(response.statusCode).not.toBe(405);
	});

	it("DELETE /organizations/:slug/sales/:saleId/commission-installments/:installmentId should be registered", async () => {
		const url = fillPathParams(
			"/organizations/:slug/sales/:saleId/commission-installments/:installmentId",
		);
		const agent = request(app.server);
		const response = await agent.delete(url);

		expect(response.statusCode).not.toBe(404);
		expect(response.statusCode).not.toBe(405);
	});

	it("GET /organizations/:slug/sales should be registered", async () => {
		const url = fillPathParams("/organizations/:slug/sales");
		const agent = request(app.server);
		const response = await agent.get(url);

		expect(response.statusCode).not.toBe(404);
		expect(response.statusCode).not.toBe(405);
	});

	it("POST /organizations/:slug/sales should be registered", async () => {
		const url = fillPathParams("/organizations/:slug/sales");
		const agent = request(app.server);
		const response = await agent.post(url).send({});

		expect(response.statusCode).not.toBe(404);
		expect(response.statusCode).not.toBe(405);
	});
});
