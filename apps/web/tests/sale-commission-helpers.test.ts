import { describe, expect, it } from "vitest";
import type { SaleCommissionFormData } from "@/schemas/sale-schema";
import {
	mapScenarioCommissionsToPulledSaleCommissions,
	replacePulledSaleCommissions,
	type ProductCommission,
} from "../src/pages/_app/sales/-components/sale-commission-helpers";

const SALE_COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const EXPLICIT_COMPANY_ID = "22222222-2222-4222-8222-222222222222";
const UPDATED_COMPANY_ID = "33333333-3333-4333-8333-333333333333";
const SALE_SELLER_ID = "44444444-4444-4444-8444-444444444444";

function buildLinkedCompanyScenarioCommission(): ProductCommission {
	return {
		recipientType: "COMPANY",
		beneficiaryLabel: "Empresa vinculada",
		totalPercentage: 1,
		installments: [{ installmentNumber: 1, percentage: 1 }],
	};
}

describe("sale commission helpers", () => {
	it("should resolve linked COMPANY beneficiary with selected sale company", () => {
		const pulled = mapScenarioCommissionsToPulledSaleCommissions(
			[buildLinkedCompanyScenarioCommission()],
			new Date("2026-03-10"),
			{
				companyId: SALE_COMPANY_ID,
			},
		);

		expect(pulled).toHaveLength(1);
		expect(pulled[0]?.sourceType).toBe("PULLED");
		expect(pulled[0]?.recipientType).toBe("COMPANY");
		expect(pulled[0]?.beneficiaryId).toBe(SALE_COMPANY_ID);
	});

	it("should resolve linked SELLER beneficiary with selected sale responsible", () => {
		const pulled = mapScenarioCommissionsToPulledSaleCommissions(
			[
				{
					recipientType: "SELLER",
					beneficiaryLabel: "Vendedor vinculado",
					totalPercentage: 1,
					installments: [{ installmentNumber: 1, percentage: 1 }],
				},
			],
			new Date("2026-03-10"),
			{
				sellerId: SALE_SELLER_ID,
			},
		);

		expect(pulled).toHaveLength(1);
		expect(pulled[0]?.sourceType).toBe("PULLED");
		expect(pulled[0]?.recipientType).toBe("SELLER");
		expect(pulled[0]?.beneficiaryId).toBe(SALE_SELLER_ID);
	});

	it("should keep explicit COMPANY beneficiary id when scenario provides one", () => {
		const pulled = mapScenarioCommissionsToPulledSaleCommissions(
			[
				{
					...buildLinkedCompanyScenarioCommission(),
					beneficiaryId: EXPLICIT_COMPANY_ID,
				},
			],
			new Date("2026-03-10"),
			{
				companyId: SALE_COMPANY_ID,
			},
		);

		expect(pulled[0]?.beneficiaryId).toBe(EXPLICIT_COMPANY_ID);
	});

	it("should preserve manual commissions when replacing pulled commissions", () => {
		const manualCommission = {
			sourceType: "MANUAL",
			recipientType: "OTHER",
			direction: "OUTCOME",
			calculationBase: "SALE_TOTAL",
			beneficiaryLabel: "Bônus operacional",
			startDate: new Date("2026-03-10"),
			totalPercentage: 1,
			installments: [{ installmentNumber: 1, percentage: 1 }],
		} satisfies SaleCommissionFormData;

		const initialPulled = mapScenarioCommissionsToPulledSaleCommissions(
			[buildLinkedCompanyScenarioCommission()],
			new Date("2026-03-10"),
			{
				companyId: SALE_COMPANY_ID,
			},
		);
		const updatedPulled = mapScenarioCommissionsToPulledSaleCommissions(
			[buildLinkedCompanyScenarioCommission()],
			new Date("2026-03-10"),
			{
				companyId: UPDATED_COMPANY_ID,
			},
		);

		const result = replacePulledSaleCommissions(
			[manualCommission, ...initialPulled],
			updatedPulled,
		);

		expect(result).toHaveLength(2);
		expect(result[0]).toEqual(manualCommission);
		expect(result[1]?.sourceType).toBe("PULLED");
		expect(result[1]?.beneficiaryId).toBe(UPDATED_COMPANY_ID);
	});
});
