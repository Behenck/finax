import { hash } from "bcryptjs";
import {
	CustomerDocumentType,
	CustomerPersonType,
	CustomerResponsibleType,
	CustomerStatus,
	PartnerDocumentType,
	PartnerStatus,
	PermissionOverrideEffect,
	Role,
} from "generated/prisma/enums";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
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

async function createSupervisorFixture(organizationId: string, suffix: string) {
	const password = "123456";
	const passwordHash = await hash(password, 6);
	const user = await prisma.user.create({
		data: {
			name: `Supervisor ${suffix}`,
			email: `customers-supervisor-${suffix}@example.com`,
			passwordHash,
			emailVerifiedAt: new Date(),
		},
	});

	const member = await prisma.member.create({
		data: {
			organizationId,
			userId: user.id,
			role: Role.SUPERVISOR,
		},
	});

	return {
		user,
		member,
		password,
	};
}

async function denyPermission(params: {
	organizationId: string;
	memberId: string;
	permissionKey: string;
}) {
	const permission = await prisma.permission.findUnique({
		where: {
			key: params.permissionKey,
		},
		select: {
			id: true,
		},
	});

	if (!permission) {
		throw new Error(`Permission ${params.permissionKey} not found`);
	}

	await prisma.memberPermissionOverride.upsert({
		where: {
			memberId_permissionId: {
				memberId: params.memberId,
				permissionId: permission.id,
			},
		},
		update: {
			effect: PermissionOverrideEffect.DENY,
		},
		create: {
			organizationId: params.organizationId,
			memberId: params.memberId,
			permissionId: permission.id,
			effect: PermissionOverrideEffect.DENY,
		},
	});
}

async function createPartner(params: {
	organizationId: string;
	suffix: string;
	supervisorId?: string | null;
}) {
	const partner = await prisma.partner.create({
		data: {
			name: `Partner ${params.suffix}`,
			email: `customers-partner-${params.suffix}@example.com`,
			phone: "55999999999",
			documentType: PartnerDocumentType.CPF,
			document: `${Math.floor(Math.random() * 1_000_000_000_000)}`,
			companyName: `Partner company ${params.suffix}`,
			state: "RS",
			country: "BR",
			status: PartnerStatus.ACTIVE,
			organizationId: params.organizationId,
		},
	});

	if (params.supervisorId) {
		await prisma.partnerSupervisor.create({
			data: {
				organizationId: params.organizationId,
				partnerId: partner.id,
				supervisorId: params.supervisorId,
			},
		});
	}

	return partner;
}

async function createCustomer(params: {
	organizationId: string;
	partnerId: string;
	suffix: string;
}) {
	return prisma.customer.create({
		data: {
			organizationId: params.organizationId,
			personType: CustomerPersonType.PF,
			name: `Customer ${params.suffix}`,
			documentType: CustomerDocumentType.CPF,
			documentNumber: `${Math.floor(Math.random() * 1_000_000_000_000)}`,
			status: CustomerStatus.ACTIVE,
			responsibleType: CustomerResponsibleType.PARTNER,
			responsibleId: params.partnerId,
		},
	});
}

async function createVisibilityFixture() {
	const { org } = await makeUser();
	const suffix = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
	const supervisor = await createSupervisorFixture(org.id, suffix);
	const token = await authenticate(supervisor.user.email, supervisor.password);

	const visiblePartner = await createPartner({
		organizationId: org.id,
		suffix: `${suffix}-visible`,
		supervisorId: supervisor.user.id,
	});
	const hiddenPartner = await createPartner({
		organizationId: org.id,
		suffix: `${suffix}-hidden`,
	});

	const visibleCustomer = await createCustomer({
		organizationId: org.id,
		partnerId: visiblePartner.id,
		suffix: `${suffix}-visible`,
	});
	const hiddenCustomer = await createCustomer({
		organizationId: org.id,
		partnerId: hiddenPartner.id,
		suffix: `${suffix}-hidden`,
	});

	return {
		org,
		supervisor,
		token,
		visibleCustomer,
		hiddenCustomer,
	};
}

describe("customers visibility by supervisor linked partner", () => {
	beforeAll(async () => {
		app = await createTestApp();
	});

	afterAll(async () => {
		await app.close();
	});

	it("should return only linked partner customers for supervisor without customers.view.all", async () => {
		const fixture = await createVisibilityFixture();

		await denyPermission({
			organizationId: fixture.org.id,
			memberId: fixture.supervisor.member.id,
			permissionKey: "registers.customers.view.all",
		});

		const listResponse = await request(app.server)
			.get(`/organizations/${fixture.org.slug}/customers`)
			.set("Authorization", `Bearer ${fixture.token}`);

		expect(listResponse.statusCode).toBe(200);
		expect(listResponse.body.customers).toHaveLength(1);
		expect(listResponse.body.customers[0]?.id).toBe(fixture.visibleCustomer.id);

		const visibleDetailResponse = await request(app.server)
			.get(
				`/organizations/${fixture.org.slug}/customers/${fixture.visibleCustomer.id}`,
			)
			.set("Authorization", `Bearer ${fixture.token}`);

		expect(visibleDetailResponse.statusCode).toBe(200);
		expect(visibleDetailResponse.body.customer.id).toBe(
			fixture.visibleCustomer.id,
		);

		const hiddenDetailResponse = await request(app.server)
			.get(
				`/organizations/${fixture.org.slug}/customers/${fixture.hiddenCustomer.id}`,
			)
			.set("Authorization", `Bearer ${fixture.token}`);

		expect(hiddenDetailResponse.statusCode).toBe(400);
		expect(hiddenDetailResponse.body.message).toBe("Customer not found");
	});

	it("should keep customer delete blocked by permission even when customer is linked", async () => {
		const fixture = await createVisibilityFixture();

		await denyPermission({
			organizationId: fixture.org.id,
			memberId: fixture.supervisor.member.id,
			permissionKey: "registers.customers.view.all",
		});
		await denyPermission({
			organizationId: fixture.org.id,
			memberId: fixture.supervisor.member.id,
			permissionKey: "registers.customers.delete",
		});

		const deleteResponse = await request(app.server)
			.delete(
				`/organizations/${fixture.org.slug}/customers/${fixture.visibleCustomer.id}`,
			)
			.set("Authorization", `Bearer ${fixture.token}`);

		expect(deleteResponse.statusCode).toBe(403);
	});
});
