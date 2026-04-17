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
	SaleResponsibleType,
	SaleStatus,
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
			email: `sales-supervisor-${suffix}@example.com`,
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
			email: `sales-partner-${params.suffix}@example.com`,
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

async function createSale(params: {
	organizationId: string;
	companyId: string;
	productId: string;
	customerId: string;
	partnerId: string;
	createdById: string;
}) {
	return prisma.sale.create({
		data: {
			organizationId: params.organizationId,
			companyId: params.companyId,
			productId: params.productId,
			customerId: params.customerId,
			saleDate: new Date("2026-03-04T00:00:00.000Z"),
			totalAmount: 120_000,
			status: SaleStatus.PENDING,
			responsibleType: SaleResponsibleType.PARTNER,
			responsibleId: params.partnerId,
			createdById: params.createdById,
		},
	});
}

async function createVisibilityFixture() {
	const { user: admin, org } = await makeUser();
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

	const company = await prisma.company.create({
		data: {
			name: `Company ${suffix}`,
			organizationId: org.id,
		},
	});
	const product = await prisma.product.create({
		data: {
			name: `Product ${suffix}`,
			description: "Visibility test product",
			organizationId: org.id,
		},
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

	const visibleSale = await createSale({
		organizationId: org.id,
		companyId: company.id,
		productId: product.id,
		customerId: visibleCustomer.id,
		partnerId: visiblePartner.id,
		createdById: admin.id,
	});
	const hiddenSale = await createSale({
		organizationId: org.id,
		companyId: company.id,
		productId: product.id,
		customerId: hiddenCustomer.id,
		partnerId: hiddenPartner.id,
		createdById: admin.id,
	});

	return {
		org,
		supervisor,
		token,
		company,
		product,
		visiblePartner,
		visibleCustomer,
		visibleSale,
		hiddenSale,
	};
}

describe("sales visibility by supervisor linked partner", () => {
	beforeAll(async () => {
		app = await createTestApp();
	});

	afterAll(async () => {
		await app.close();
	});

	it("should return only linked partner sales for supervisor without sales.view.all", async () => {
		const fixture = await createVisibilityFixture();

		await denyPermission({
			organizationId: fixture.org.id,
			memberId: fixture.supervisor.member.id,
			permissionKey: "sales.view.all",
		});

		const listResponse = await request(app.server)
			.get(`/organizations/${fixture.org.slug}/sales`)
			.set("Authorization", `Bearer ${fixture.token}`);

		expect(listResponse.statusCode).toBe(200);
		expect(listResponse.body.sales).toHaveLength(1);
		expect(listResponse.body.sales[0]?.id).toBe(fixture.visibleSale.id);

		const visibleDetailResponse = await request(app.server)
			.get(`/organizations/${fixture.org.slug}/sales/${fixture.visibleSale.id}`)
			.set("Authorization", `Bearer ${fixture.token}`);

		expect(visibleDetailResponse.statusCode).toBe(200);
		expect(visibleDetailResponse.body.sale.id).toBe(fixture.visibleSale.id);

		const hiddenDetailResponse = await request(app.server)
			.get(`/organizations/${fixture.org.slug}/sales/${fixture.hiddenSale.id}`)
			.set("Authorization", `Bearer ${fixture.token}`);

		expect(hiddenDetailResponse.statusCode).toBe(400);
		expect(hiddenDetailResponse.body.message).toBe("Sale not found");
	});

	it("should keep sales update blocked by permission when member lacks sales.update and sales.create", async () => {
		const fixture = await createVisibilityFixture();

		await denyPermission({
			organizationId: fixture.org.id,
			memberId: fixture.supervisor.member.id,
			permissionKey: "sales.view.all",
		});
		await denyPermission({
			organizationId: fixture.org.id,
			memberId: fixture.supervisor.member.id,
			permissionKey: "sales.update",
		});
		await denyPermission({
			organizationId: fixture.org.id,
			memberId: fixture.supervisor.member.id,
			permissionKey: "sales.create",
		});

		const updateResponse = await request(app.server)
			.put(`/organizations/${fixture.org.slug}/sales/${fixture.visibleSale.id}`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				saleDate: "2026-03-04",
				customerId: fixture.visibleCustomer.id,
				productId: fixture.product.id,
				totalAmount: 130_000,
				responsible: {
					type: "PARTNER",
					id: fixture.visiblePartner.id,
				},
				companyId: fixture.company.id,
				notes: "Permission regression test",
			});

		expect(updateResponse.statusCode).toBe(403);
	});

	it("should allow sales update with sales.create fallback when sale status is pending", async () => {
		const fixture = await createVisibilityFixture();

		await denyPermission({
			organizationId: fixture.org.id,
			memberId: fixture.supervisor.member.id,
			permissionKey: "sales.view.all",
		});
		await denyPermission({
			organizationId: fixture.org.id,
			memberId: fixture.supervisor.member.id,
			permissionKey: "sales.update",
		});

		const updateResponse = await request(app.server)
			.put(`/organizations/${fixture.org.slug}/sales/${fixture.visibleSale.id}`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				saleDate: "2026-03-04",
				customerId: fixture.visibleCustomer.id,
				productId: fixture.product.id,
				totalAmount: 130_000,
				responsible: {
					type: "PARTNER",
					id: fixture.visiblePartner.id,
				},
				companyId: fixture.company.id,
				notes: "Permission fallback test",
			});

		expect(updateResponse.statusCode).toBe(204);
	});

	it.each([
		SaleStatus.APPROVED,
		SaleStatus.COMPLETED,
	])("should return 403 on sales update with sales.create fallback when sale status is %s", async (saleStatus) => {
		const fixture = await createVisibilityFixture();

		await denyPermission({
			organizationId: fixture.org.id,
			memberId: fixture.supervisor.member.id,
			permissionKey: "sales.view.all",
		});
		await denyPermission({
			organizationId: fixture.org.id,
			memberId: fixture.supervisor.member.id,
			permissionKey: "sales.update",
		});

		await prisma.sale.update({
			where: {
				id: fixture.visibleSale.id,
			},
			data: {
				status: saleStatus,
			},
		});

		const updateResponse = await request(app.server)
			.put(`/organizations/${fixture.org.slug}/sales/${fixture.visibleSale.id}`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				saleDate: "2026-03-04",
				customerId: fixture.visibleCustomer.id,
				productId: fixture.product.id,
				totalAmount: 130_000,
				responsible: {
					type: "PARTNER",
					id: fixture.visiblePartner.id,
				},
				companyId: fixture.company.id,
				notes: "Permission fallback blocked by status",
			});

		expect(updateResponse.statusCode).toBe(403);
	});
});
