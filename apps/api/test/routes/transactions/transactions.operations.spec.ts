import {
	TransactionNature,
	TransactionStatus,
	TransactionType,
} from "generated/prisma/enums";
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

	const company = await prisma.company.create({
		data: {
			name: `Company ${suffix}`,
			organizationId: org.id,
		},
	});

	const unit = await prisma.unit.create({
		data: {
			name: `Unit ${suffix}`,
			companyId: company.id,
		},
	});

	const costCenter = await prisma.costCenter.create({
		data: {
			name: `Cost center ${suffix}`,
			organizationId: org.id,
		},
	});

	const category = await prisma.category.create({
		data: {
			name: `Category ${suffix}`,
			color: "#0f172a",
			icon: "wallet",
			type: TransactionType.OUTCOME,
			organizationId: org.id,
		},
	});

	return {
		user,
		org,
		token,
		company,
		unit,
		costCenter,
		category,
	};
}

async function createTransactionFixture(params: {
	organizationId: string;
	createdById: string;
	companyId: string;
	unitId: string;
	costCenterId: string;
	categoryId: string;
	description: string;
	status: TransactionStatus;
	dueDate: Date;
	expectedPaymentDate: Date;
}) {
	return prisma.transaction.create({
		data: {
			code: `TRX-${Math.floor(Math.random() * 1_000_000)}`,
			description: params.description,
			totalAmount: 50_000,
			type: TransactionType.OUTCOME,
			status: params.status,
			nature: TransactionNature.FIXED,
			dueDate: params.dueDate,
			expectedPaymentDate: params.expectedPaymentDate,
			costCenterId: params.costCenterId,
			organizationId: params.organizationId,
			companyId: params.companyId,
			unitId: params.unitId,
			createdById: params.createdById,
			categoryId: params.categoryId,
		},
	});
}

describe("transactions operations", () => {
	beforeAll(async () => {
		app = await createTestApp();
	});

	afterAll(async () => {
		await app.close();
	});

	it("should filter and paginate transactions", async () => {
		const fixture = await createFixture();

		await createTransactionFixture({
			organizationId: fixture.org.id,
			createdById: fixture.user.id,
			companyId: fixture.company.id,
			unitId: fixture.unit.id,
			costCenterId: fixture.costCenter.id,
			categoryId: fixture.category.id,
			description: "Alpha pending",
			status: TransactionStatus.PENDING,
			dueDate: new Date("2026-03-11T00:00:00.000Z"),
			expectedPaymentDate: new Date("2026-03-11T00:00:00.000Z"),
		});
		await createTransactionFixture({
			organizationId: fixture.org.id,
			createdById: fixture.user.id,
			companyId: fixture.company.id,
			unitId: fixture.unit.id,
			costCenterId: fixture.costCenter.id,
			categoryId: fixture.category.id,
			description: "Beta pending",
			status: TransactionStatus.PENDING,
			dueDate: new Date("2026-03-12T00:00:00.000Z"),
			expectedPaymentDate: new Date("2026-03-12T00:00:00.000Z"),
		});
		await createTransactionFixture({
			organizationId: fixture.org.id,
			createdById: fixture.user.id,
			companyId: fixture.company.id,
			unitId: fixture.unit.id,
			costCenterId: fixture.costCenter.id,
			categoryId: fixture.category.id,
			description: "Gamma paid",
			status: TransactionStatus.PAID,
			dueDate: new Date("2026-03-13T00:00:00.000Z"),
			expectedPaymentDate: new Date("2026-03-13T00:00:00.000Z"),
		});

		const response = await request(app.server)
			.get(
				`/organizations/${fixture.org.slug}/transactions?status=PENDING&page=1&pageSize=1&sortBy=dueDate&sortDir=asc&q=pending`,
			)
			.set("Authorization", `Bearer ${fixture.token}`);

		expect(response.statusCode).toBe(200);
		expect(response.body.transactions).toHaveLength(1);
		expect(response.body.transactions[0].status).toBe("PENDING");
		expect(response.body.pagination).toMatchObject({
			page: 1,
			pageSize: 1,
			total: 2,
			totalPages: 2,
		});
	});

	it("should bulk pay pending transactions and skip non-eligible statuses", async () => {
		const fixture = await createFixture();

		const pending = await createTransactionFixture({
			organizationId: fixture.org.id,
			createdById: fixture.user.id,
			companyId: fixture.company.id,
			unitId: fixture.unit.id,
			costCenterId: fixture.costCenter.id,
			categoryId: fixture.category.id,
			description: "Pending installment",
			status: TransactionStatus.PENDING,
			dueDate: new Date("2026-03-14T00:00:00.000Z"),
			expectedPaymentDate: new Date("2026-03-14T00:00:00.000Z"),
		});

		const paid = await createTransactionFixture({
			organizationId: fixture.org.id,
			createdById: fixture.user.id,
			companyId: fixture.company.id,
			unitId: fixture.unit.id,
			costCenterId: fixture.costCenter.id,
			categoryId: fixture.category.id,
			description: "Paid installment",
			status: TransactionStatus.PAID,
			dueDate: new Date("2026-03-15T00:00:00.000Z"),
			expectedPaymentDate: new Date("2026-03-15T00:00:00.000Z"),
		});

		const canceled = await createTransactionFixture({
			organizationId: fixture.org.id,
			createdById: fixture.user.id,
			companyId: fixture.company.id,
			unitId: fixture.unit.id,
			costCenterId: fixture.costCenter.id,
			categoryId: fixture.category.id,
			description: "Canceled installment",
			status: TransactionStatus.CANCELED,
			dueDate: new Date("2026-03-16T00:00:00.000Z"),
			expectedPaymentDate: new Date("2026-03-16T00:00:00.000Z"),
		});

		const response = await request(app.server)
			.patch(`/organizations/${fixture.org.slug}/transactions/payment/bulk`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				transactionIds: [pending.id, paid.id, canceled.id],
				paymentDate: "2026-03-20T00:00:00.000Z",
			});

		expect(response.statusCode).toBe(200);
		expect(response.body.updatedCount).toBe(1);
		expect(response.body.skipped).toHaveLength(2);

		const updatedPending = await prisma.transaction.findUnique({
			where: {
				id: pending.id,
			},
			select: {
				status: true,
				paymentDate: true,
			},
		});
		expect(updatedPending?.status).toBe(TransactionStatus.PAID);
		expect(updatedPending?.paymentDate).not.toBeNull();
	});
});
