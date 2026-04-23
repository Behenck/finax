import {
	SellerDocumentType,
	SellerStatus,
} from "generated/prisma/enums";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { resolveSaleCommissionsData } from "@/routes/sales/sale-commissions";
import { makeUser } from "../../factories/make-user";
import { createTestApp } from "../../utils/test-app";

let app: Awaited<ReturnType<typeof createTestApp>>;

describe("sale commissions advanced schedule", () => {
	beforeAll(async () => {
		app = await createTestApp();
	});

	afterAll(async () => {
		await app.close();
	});

	it("should keep installment without date when monthsToAdvance is zero and resume from last dated installment", async () => {
		const { org } = await makeUser();
		const suffix = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`;

		const seller = await prisma.seller.create({
			data: {
				name: `Seller ${suffix}`,
				email: `seller-${suffix}@example.com`,
				phone: "55999999999",
				documentType: SellerDocumentType.CPF,
				document: `000000000${Math.floor(Math.random() * 9)}`,
				companyName: "Seller Co",
				state: "RS",
				organizationId: org.id,
				status: SellerStatus.ACTIVE,
			},
		});

		const resolvedCommissions = await resolveSaleCommissionsData(
			org.id,
			[
				{
					sourceType: "PULLED",
					recipientType: "SELLER",
					direction: "OUTCOME",
					beneficiaryId: seller.id,
					useAdvancedDateSchedule: true,
					startDate: "2026-04-10",
					totalPercentage: 3,
					installments: [
						{
							installmentNumber: 1,
							percentage: 1,
							monthsToAdvance: 0,
						},
						{
							installmentNumber: 2,
							percentage: 1,
							monthsToAdvance: 0,
						},
						{
							installmentNumber: 3,
							percentage: 1,
							monthsToAdvance: 2,
						},
					],
				},
			],
			100_000,
		);

		expect(resolvedCommissions).toHaveLength(1);
		expect(
			resolvedCommissions[0]?.installments.map((installment) =>
				installment.expectedPaymentDate
					? installment.expectedPaymentDate.toISOString().slice(0, 10)
					: null,
			),
		).toEqual(["2026-04-10", null, "2026-06-10"]);
	});
});
