import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createTestApp } from "../utils/test-app";

let app: Awaited<ReturnType<typeof createTestApp>>;
let previousAppWebUrl: string | undefined;
let previousAppWebUrls: string | undefined;

describe("CORS", () => {
	beforeAll(async () => {
		previousAppWebUrl = process.env.APP_WEB_URL;
		previousAppWebUrls = process.env.APP_WEB_URLS;

		process.env.APP_WEB_URL = "https://app.example.com";
		process.env.APP_WEB_URLS =
			"https://app.example.com,https://admin.example.com";

		app = await createTestApp();
	});

	afterAll(async () => {
		await app.close();

		if (previousAppWebUrl === undefined) {
			delete process.env.APP_WEB_URL;
		} else {
			process.env.APP_WEB_URL = previousAppWebUrl;
		}

		if (previousAppWebUrls === undefined) {
			delete process.env.APP_WEB_URLS;
		} else {
			process.env.APP_WEB_URLS = previousAppWebUrls;
		}
	});

	it("allows configured web origins", async () => {
		const response = await request(app.server)
			.get("/health")
			.set("Origin", "https://app.example.com");

		expect(response.headers["access-control-allow-origin"]).toBe(
			"https://app.example.com",
		);
		expect(response.headers["access-control-allow-credentials"]).toBe("true");
	});

	it("does not reflect unknown origins", async () => {
		const response = await request(app.server)
			.get("/health")
			.set("Origin", "https://evil.example.com");

		expect(response.headers["access-control-allow-origin"]).toBeUndefined();
	});
});
