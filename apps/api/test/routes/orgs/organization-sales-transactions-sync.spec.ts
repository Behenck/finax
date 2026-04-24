import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { makeUser } from "../../factories/make-user";
import { createTestApp } from "../../utils/test-app";

let app: Awaited<ReturnType<typeof createTestApp>>;

async function createFixture() {
	const { user, org } = await makeUser();

	const loginResponse = await request(app.server)
		.post("/sessions/password")
		.send({
			email: user.email,
			password: user.password,
		});

	expect(loginResponse.statusCode).toBe(200);

	return {
		user,
		org,
		token: loginResponse.body.accessToken as string,
	};
}

describe("organization sales transactions sync", () => {
	beforeAll(async () => {
		app = await createTestApp();
	});

	afterAll(async () => {
		await app.close();
	});

	it("should expose organization preferences in get organization and get me", async () => {
		const fixture = await createFixture();

		const getOrganizationResponse = await request(app.server)
			.get(`/organization/${fixture.org.slug}`)
			.set("Authorization", `Bearer ${fixture.token}`);

		expect(getOrganizationResponse.statusCode).toBe(200);
		expect(
			getOrganizationResponse.body.organization.enableSalesTransactionsSync,
		).toBe(false);
		expect(
			getOrganizationResponse.body.organization
				.preCancellationDelinquencyThreshold,
		).toBeNull();

		const meResponse = await request(app.server)
			.get("/me")
			.set("Authorization", `Bearer ${fixture.token}`);

		expect(meResponse.statusCode).toBe(200);
		expect(meResponse.body.organization.enableSalesTransactionsSync).toBe(
			false,
		);
		expect(
			meResponse.body.organization.preCancellationDelinquencyThreshold,
		).toBeNull();
	});

	it("should persist organization preferences when updating organization", async () => {
		const fixture = await createFixture();

		const updateResponse = await request(app.server)
			.put(`/organization/${fixture.org.slug}`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				name: fixture.org.name,
				domain: null,
				shouldAttachUserByDomain: false,
				enableSalesTransactionsSync: true,
				preCancellationDelinquencyThreshold: 3,
			});

		expect(updateResponse.statusCode).toBe(204);

		const updatedOrganization = await prisma.organization.findUnique({
			where: {
				id: fixture.org.id,
			},
			select: {
				enableSalesTransactionsSync: true,
				preCancellationDelinquencyThreshold: true,
			},
		});

		expect(updatedOrganization?.enableSalesTransactionsSync).toBe(true);
		expect(updatedOrganization?.preCancellationDelinquencyThreshold).toBe(3);

		const getOrganizationResponse = await request(app.server)
			.get(`/organization/${fixture.org.slug}`)
			.set("Authorization", `Bearer ${fixture.token}`);

		expect(getOrganizationResponse.statusCode).toBe(200);
		expect(
			getOrganizationResponse.body.organization.enableSalesTransactionsSync,
		).toBe(true);
		expect(
			getOrganizationResponse.body.organization
				.preCancellationDelinquencyThreshold,
		).toBe(3);
	});

	it("should persist organization preferences when creating organizations", async () => {
		const fixture = await createFixture();
		const suffix = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`;

		const createEnabledResponse = await request(app.server)
			.post("/organizations")
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				name: `Org Enabled ${suffix}`,
				domain: null,
				enableSalesTransactionsSync: true,
				preCancellationDelinquencyThreshold: 4,
			});

		expect(createEnabledResponse.statusCode).toBe(201);

		const enabledOrganization = await prisma.organization.findUnique({
			where: {
				id: createEnabledResponse.body.organizationId,
			},
			select: {
				enableSalesTransactionsSync: true,
				preCancellationDelinquencyThreshold: true,
			},
		});
		expect(enabledOrganization?.enableSalesTransactionsSync).toBe(true);
		expect(enabledOrganization?.preCancellationDelinquencyThreshold).toBe(4);

		const createDefaultResponse = await request(app.server)
			.post("/organizations")
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				name: `Org Default ${suffix}`,
				domain: null,
			});

		expect(createDefaultResponse.statusCode).toBe(201);

		const defaultOrganization = await prisma.organization.findUnique({
			where: {
				id: createDefaultResponse.body.organizationId,
			},
			select: {
				enableSalesTransactionsSync: true,
				preCancellationDelinquencyThreshold: true,
			},
		});
		expect(defaultOrganization?.enableSalesTransactionsSync).toBe(false);
		expect(defaultOrganization?.preCancellationDelinquencyThreshold).toBeNull();
	});
});
