import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { makeUser } from "../../factories/make-user";
import { createTestApp } from "../../utils/test-app";

let app: Awaited<ReturnType<typeof createTestApp>>;
let auth: {
	token: string;
	org: {
		id: string;
		slug: string;
	};
};

function buildCategoryPayload(
	overrides: Partial<Record<string, unknown>> = {},
) {
	return {
		name: "Categoria Padrão",
		code: "1.1.01",
		type: "OUTCOME",
		icon: "Wallet",
		color: "#22C55E",
		...overrides,
	};
}

function buildUniqueName(prefix: string) {
	return `${prefix} ${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
}

async function createAuthenticatedFixture() {
	const { user, org } = await makeUser();

	const loginResponse = await request(app.server)
		.post("/sessions/password")
		.send({
			email: user.email,
			password: user.password,
		});

	expect(loginResponse.statusCode).toBe(200);

	return {
		token: loginResponse.body.accessToken as string,
		org: {
			id: org.id,
			slug: org.slug,
		},
	};
}

async function createCategoryRecord(organizationId: string, name: string) {
	return prisma.category.create({
		data: {
			organizationId,
			name,
			code: "1.1.02",
			type: "OUTCOME",
			icon: "Wallet",
			color: "#0EA5E9",
		},
		select: {
			id: true,
		},
	});
}

describe("categories validation", () => {
	beforeAll(async () => {
		app = await createTestApp();
		auth = await createAuthenticatedFixture();
	});

	afterAll(async () => {
		await app.close();
	});

	it("should return 400 on POST when name is an empty string", async () => {
		const response = await request(app.server)
			.post(`/organizations/${auth.org.slug}/categories`)
			.set("Authorization", `Bearer ${auth.token}`)
			.send(buildCategoryPayload({ name: "" }));

		expect(response.statusCode).toBe(400);
	});

	it("should return 400 on POST when name contains only whitespace", async () => {
		const response = await request(app.server)
			.post(`/organizations/${auth.org.slug}/categories`)
			.set("Authorization", `Bearer ${auth.token}`)
			.send(buildCategoryPayload({ name: "   " }));

		expect(response.statusCode).toBe(400);
	});

	it("should create category on POST when name is valid", async () => {
		const createdNameWithSpaces = `  ${buildUniqueName("Categoria válida")}  `;
		const expectedCreatedName = createdNameWithSpaces.trim();

		const response = await request(app.server)
			.post(`/organizations/${auth.org.slug}/categories`)
			.set("Authorization", `Bearer ${auth.token}`)
			.send(
				buildCategoryPayload({
					name: createdNameWithSpaces,
				}),
			);

		expect(response.statusCode).toBe(201);
		expect(response.body.categoryId).toBeTypeOf("string");

		const createdCategory = await prisma.category.findUnique({
			where: {
				id: response.body.categoryId as string,
			},
			select: {
				name: true,
			},
		});

		expect(createdCategory?.name).toBe(expectedCreatedName);
	});

	it("should return 400 on PUT when name is an empty string", async () => {
		const baseCategory = await createCategoryRecord(
			auth.org.id,
			buildUniqueName("Categoria base PUT empty"),
		);

		const response = await request(app.server)
			.put(`/organizations/${auth.org.slug}/categories/${baseCategory.id}`)
			.set("Authorization", `Bearer ${auth.token}`)
			.send(buildCategoryPayload({ name: "" }));

		expect(response.statusCode).toBe(400);
	});

	it("should return 400 on PUT when name contains only whitespace", async () => {
		const baseCategory = await createCategoryRecord(
			auth.org.id,
			buildUniqueName("Categoria base PUT spaces"),
		);

		const response = await request(app.server)
			.put(`/organizations/${auth.org.slug}/categories/${baseCategory.id}`)
			.set("Authorization", `Bearer ${auth.token}`)
			.send(buildCategoryPayload({ name: "   " }));

		expect(response.statusCode).toBe(400);
	});

	it("should update category on PUT when name is valid", async () => {
		const baseCategory = await createCategoryRecord(
			auth.org.id,
			buildUniqueName("Categoria base PUT valid"),
		);

		const updatedNameWithSpaces = `  ${buildUniqueName("Categoria atualizada")}  `;
		const expectedUpdatedName = updatedNameWithSpaces.trim();

		const response = await request(app.server)
			.put(`/organizations/${auth.org.slug}/categories/${baseCategory.id}`)
			.set("Authorization", `Bearer ${auth.token}`)
			.send(
				buildCategoryPayload({
					name: updatedNameWithSpaces,
				}),
			);

		expect(response.statusCode).toBe(204);

		const updatedCategory = await prisma.category.findUnique({
			where: {
				id: baseCategory.id,
			},
			select: {
				name: true,
			},
		});

		expect(updatedCategory?.name).toBe(expectedUpdatedName);
	});
});
