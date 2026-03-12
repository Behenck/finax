import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { makeUser } from "../../factories/make-user";
import { createTestApp } from "../../utils/test-app";

let app: Awaited<ReturnType<typeof createTestApp>>;

async function createFixture() {
	const { user, org } = await makeUser();

	const loginResponse = await request(app.server).post("/sessions/password").send({
		email: user.email,
		password: user.password,
	});

	expect(loginResponse.statusCode).toBe(200);

	const token = loginResponse.body.accessToken as string;
	const suffix = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`;

	const product = await prisma.product.create({
		data: {
			organizationId: org.id,
			name: `Produto ${suffix}`,
			description: "Produto para teste de campos dinâmicos",
		},
	});

	return {
		token,
		org,
		product,
	};
}

describe("product sale fields", () => {
	beforeAll(async () => {
		app = await createTestApp();
	});

	afterAll(async () => {
		await app.close();
	});

	it("should replace and list product sale fields", async () => {
		const fixture = await createFixture();

		const replaceResponse = await request(app.server)
			.put(
				`/organizations/${fixture.org.slug}/products/${fixture.product.id}/sale-fields`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				fields: [
					{
						label: "Grupo",
						type: "TEXT",
						required: true,
						options: [],
					},
					{
						label: "Valor fechado",
						type: "CURRENCY",
						required: true,
						options: [],
					},
					{
						label: "Etapa",
						type: "SELECT",
						required: true,
						options: [
							{ label: "Inbound", isDefault: true },
							{ label: "Outbound", isDefault: false },
						],
					},
					{
						label: "Canais",
						type: "MULTI_SELECT",
						required: false,
						options: [
							{ label: "Instagram", isDefault: true },
							{ label: "Indicação", isDefault: true },
						],
					},
				],
			});

		expect(replaceResponse.statusCode).toBe(204);

		const getResponse = await request(app.server)
			.get(
				`/organizations/${fixture.org.slug}/products/${fixture.product.id}/sale-fields`,
			)
			.set("Authorization", `Bearer ${fixture.token}`);

		expect(getResponse.statusCode).toBe(200);
		expect(getResponse.body.fields).toHaveLength(4);
		expect(getResponse.body.fields[0]).toMatchObject({
			label: "Grupo",
			type: "TEXT",
			required: true,
			options: [],
		});
		expect(getResponse.body.fields[2]).toMatchObject({
			label: "Etapa",
			type: "SELECT",
			required: true,
		});
		expect(getResponse.body.fields[2].options).toHaveLength(2);
		expect(getResponse.body.fields[2].options[0]).toMatchObject({
			label: "Inbound",
			isDefault: true,
		});
		expect(getResponse.body.fields[3].options).toEqual([
			expect.objectContaining({
				label: "Instagram",
				isDefault: true,
			}),
			expect.objectContaining({
				label: "Indicação",
				isDefault: true,
			}),
		]);
	});

	it("should reject duplicate field labels ignoring case", async () => {
		const fixture = await createFixture();

		const response = await request(app.server)
			.put(
				`/organizations/${fixture.org.slug}/products/${fixture.product.id}/sale-fields`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				fields: [
					{
						label: "Grupo",
						type: "TEXT",
						required: false,
						options: [],
					},
					{
						label: "grupo",
						type: "NUMBER",
						required: false,
						options: [],
					},
				],
			});

		expect(response.statusCode).toBe(400);
	});

	it("should reject selection field without options", async () => {
		const fixture = await createFixture();

		const response = await request(app.server)
			.put(
				`/organizations/${fixture.org.slug}/products/${fixture.product.id}/sale-fields`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				fields: [
					{
						label: "Etapa",
						type: "SELECT",
						required: true,
						options: [],
					},
				],
			});

		expect(response.statusCode).toBe(400);
	});

	it("should reject more than one default option for single select fields", async () => {
		const fixture = await createFixture();

		const response = await request(app.server)
			.put(
				`/organizations/${fixture.org.slug}/products/${fixture.product.id}/sale-fields`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				fields: [
					{
						label: "Etapa",
						type: "SELECT",
						required: true,
						options: [
							{ label: "Inbound", isDefault: true },
							{ label: "Outbound", isDefault: true },
						],
					},
				],
			});

		expect(response.statusCode).toBe(400);
	});
});
