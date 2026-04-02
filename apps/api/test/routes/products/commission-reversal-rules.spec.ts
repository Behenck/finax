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

	const token = loginResponse.body.accessToken as string;
	const suffix = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`;

	const product = await prisma.product.create({
		data: {
			organizationId: org.id,
			name: `Produto estorno ${suffix}`,
			description: "Product for commission reversal rules",
		},
	});

	return {
		token,
		org,
		product,
	};
}

describe("product commission reversal rules", () => {
	beforeAll(async () => {
		app = await createTestApp();
	});

	afterAll(async () => {
		await app.close();
	});

	it("should save and fetch product reversal rules", async () => {
		const fixture = await createFixture();

		const saveResponse = await request(app.server)
			.put(
				`/organizations/${fixture.org.slug}/products/${fixture.product.id}/commission-reversal-rules`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				rules: [
					{
						installmentNumber: 1,
						percentage: 80,
					},
					{
						installmentNumber: 2,
						percentage: 70,
					},
					{
						installmentNumber: 3,
						percentage: 65,
					},
				],
			});

		expect(saveResponse.statusCode).toBe(204);

		const getResponse = await request(app.server)
			.get(
				`/organizations/${fixture.org.slug}/products/${fixture.product.id}/commission-reversal-rules`,
			)
			.set("Authorization", `Bearer ${fixture.token}`);

		expect(getResponse.statusCode).toBe(200);
		expect(getResponse.body).toEqual({
			rules: [
				{
					installmentNumber: 1,
					percentage: 80,
				},
				{
					installmentNumber: 2,
					percentage: 70,
				},
				{
					installmentNumber: 3,
					percentage: 65,
				},
			],
		});
	});

	it("should reject duplicate installment number", async () => {
		const fixture = await createFixture();

		const response = await request(app.server)
			.put(
				`/organizations/${fixture.org.slug}/products/${fixture.product.id}/commission-reversal-rules`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				rules: [
					{
						installmentNumber: 1,
						percentage: 80,
					},
					{
						installmentNumber: 1,
						percentage: 70,
					},
				],
			});

		expect(response.statusCode).toBe(400);
	});

	it("should replace previously saved rules", async () => {
		const fixture = await createFixture();

		await request(app.server)
			.put(
				`/organizations/${fixture.org.slug}/products/${fixture.product.id}/commission-reversal-rules`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				rules: [
					{
						installmentNumber: 1,
						percentage: 80,
					},
				],
			});

		const saveResponse = await request(app.server)
			.put(
				`/organizations/${fixture.org.slug}/products/${fixture.product.id}/commission-reversal-rules`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				rules: [
					{
						installmentNumber: 3,
						percentage: 65,
					},
				],
			});

		expect(saveResponse.statusCode).toBe(204);

		const getResponse = await request(app.server)
			.get(
				`/organizations/${fixture.org.slug}/products/${fixture.product.id}/commission-reversal-rules`,
			)
			.set("Authorization", `Bearer ${fixture.token}`);

		expect(getResponse.statusCode).toBe(200);
		expect(getResponse.body).toEqual({
			rules: [
				{
					installmentNumber: 3,
					percentage: 65,
				},
			],
		});
	});

	it("should inherit rules from parent when product has no local rules", async () => {
		const fixture = await createFixture();
		const suffix = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`;

		const parentProduct = await prisma.product.create({
			data: {
				organizationId: fixture.org.id,
				name: `Produto pai estorno ${suffix}`,
				description: "Parent product for reversal rules inheritance",
			},
		});

		const childProduct = await prisma.product.create({
			data: {
				organizationId: fixture.org.id,
				parentId: parentProduct.id,
				name: `Produto filho estorno ${suffix}`,
				description: "Child product for reversal rules inheritance",
			},
		});

		const saveResponse = await request(app.server)
			.put(
				`/organizations/${fixture.org.slug}/products/${parentProduct.id}/commission-reversal-rules`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				rules: [
					{
						installmentNumber: 1,
						percentage: 80,
					},
					{
						installmentNumber: 2,
						percentage: 70,
					},
				],
			});

		expect(saveResponse.statusCode).toBe(204);

		const directGetResponse = await request(app.server)
			.get(
				`/organizations/${fixture.org.slug}/products/${childProduct.id}/commission-reversal-rules`,
			)
			.set("Authorization", `Bearer ${fixture.token}`);

		expect(directGetResponse.statusCode).toBe(200);
		expect(directGetResponse.body).toEqual({
			rules: [],
		});

		const inheritedGetResponse = await request(app.server)
			.get(
				`/organizations/${fixture.org.slug}/products/${childProduct.id}/commission-reversal-rules?includeInherited=true`,
			)
			.set("Authorization", `Bearer ${fixture.token}`);

		expect(inheritedGetResponse.statusCode).toBe(200);
		expect(inheritedGetResponse.body).toEqual({
			rules: [
				{
					installmentNumber: 1,
					percentage: 80,
				},
				{
					installmentNumber: 2,
					percentage: 70,
				},
			],
		});
	});
});
