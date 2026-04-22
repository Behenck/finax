import { describe, expect, it } from "vitest";
import type { SaleCommissionFormData } from "@/schemas/sale-schema";
import {
	mapScenarioCommissionsToPulledSaleCommissions,
	replacePulledSaleCommissions,
	resolveSaleCommissionStartDateFromDueDay,
	type ProductCommission,
} from "../src/pages/_app/sales/-components/sale-commission-helpers";

const SALE_COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const EXPLICIT_COMPANY_ID = "22222222-2222-4222-8222-222222222222";
const UPDATED_COMPANY_ID = "33333333-3333-4333-8333-333333333333";
const SALE_SELLER_ID = "44444444-4444-4444-8444-444444444444";
const PARTNER_ID = "55555555-5555-4555-8555-555555555555";
const LINKED_SUPERVISOR_ID = "66666666-6666-4666-8666-666666666666";
const SECOND_LINKED_SUPERVISOR_ID = "77777777-7777-4777-8777-777777777777";
const SALE_CREATOR_USER_ID = "88888888-8888-4888-8888-888888888888";
const NON_LINKED_SUPERVISOR_ID = "99999999-9999-4999-8999-999999999999";
const SALE_CREATOR_SUPERVISOR_MEMBER_ID =
	"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function buildLinkedCompanyScenarioCommission(): ProductCommission {
	return {
		recipientType: "COMPANY",
		beneficiaryLabel: "Empresa vinculada",
		totalPercentage: 1,
		installments: [{ installmentNumber: 1, percentage: 1 }],
	};
}

function buildLinkedSupervisorScenarioCommission(): ProductCommission {
	return {
		recipientType: "SUPERVISOR",
		beneficiaryLabel: "Supervisor vinculado",
		totalPercentage: 1,
		installments: [{ installmentNumber: 1, percentage: 1 }],
	};
}

function toLocalDateOnly(date: Date) {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

describe("sale commission helpers", () => {
	it("should resolve commission start date from due day in the next month when due day already passed", () => {
		const startDate = resolveSaleCommissionStartDateFromDueDay(
			new Date("2026-04-20T00:00:00"),
			10,
		);

		expect(toLocalDateOnly(startDate)).toBe("2026-05-10");
	});

	it("should resolve commission start date from due day in the same day when due day matches sale date", () => {
		const startDate = resolveSaleCommissionStartDateFromDueDay(
			new Date("2026-04-10T00:00:00"),
			10,
		);

		expect(toLocalDateOnly(startDate)).toBe("2026-04-10");
	});

	it("should clamp commission due day to month end when month has fewer days", () => {
		const startDate = resolveSaleCommissionStartDateFromDueDay(
			new Date("2026-02-20T00:00:00"),
			31,
		);

		expect(toLocalDateOnly(startDate)).toBe("2026-02-28");
	});

	it("should use due day when mapping pulled scenario commissions", () => {
		const pulled = mapScenarioCommissionsToPulledSaleCommissions(
			[
				{
					...buildLinkedCompanyScenarioCommission(),
					dueDay: 10,
				},
			],
			new Date("2026-04-20T00:00:00"),
			{
				companyId: SALE_COMPANY_ID,
			},
		);

		expect(
			pulled[0]?.startDate ? toLocalDateOnly(pulled[0].startDate) : null,
		).toBe("2026-05-10");
	});

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

	it("should keep explicit SUPERVISOR beneficiary id when scenario provides one", () => {
		const pulled = mapScenarioCommissionsToPulledSaleCommissions(
			[
				{
					...buildLinkedSupervisorScenarioCommission(),
					beneficiaryId: LINKED_SUPERVISOR_ID,
					beneficiaryLabel: "Supervisor específico",
				},
			],
			new Date("2026-03-10"),
			{
				partnerId: PARTNER_ID,
				partnerSupervisorIdsByPartnerId: new Map([
					[PARTNER_ID, [SECOND_LINKED_SUPERVISOR_ID]],
				]),
				saleCreatorUserId: SALE_CREATOR_USER_ID,
				supervisorMemberIdByUserId: new Map([
					[SALE_CREATOR_USER_ID, SECOND_LINKED_SUPERVISOR_ID],
				]),
			},
		);

		expect(pulled[0]?.beneficiaryId).toBe(LINKED_SUPERVISOR_ID);
	});

	it("should resolve linked SUPERVISOR beneficiary with the single linked partner supervisor", () => {
		const pulled = mapScenarioCommissionsToPulledSaleCommissions(
			[buildLinkedSupervisorScenarioCommission()],
			new Date("2026-03-10"),
			{
				partnerId: PARTNER_ID,
				partnerSupervisorIdsByPartnerId: new Map([
					[PARTNER_ID, [LINKED_SUPERVISOR_ID]],
				]),
			},
		);

		expect(pulled[0]?.beneficiaryId).toBe(LINKED_SUPERVISOR_ID);
	});

	it("should resolve linked SUPERVISOR beneficiary with the sale creator when creator is a linked supervisor", () => {
		const pulled = mapScenarioCommissionsToPulledSaleCommissions(
			[buildLinkedSupervisorScenarioCommission()],
			new Date("2026-03-10"),
			{
				partnerId: PARTNER_ID,
				partnerSupervisorIdsByPartnerId: new Map([
					[PARTNER_ID, [LINKED_SUPERVISOR_ID, SECOND_LINKED_SUPERVISOR_ID]],
				]),
				saleCreatorUserId: SALE_CREATOR_USER_ID,
				supervisorMemberIdByUserId: new Map([
					[SALE_CREATOR_USER_ID, SECOND_LINKED_SUPERVISOR_ID],
				]),
			},
		);

		expect(pulled[0]?.beneficiaryId).toBe(SECOND_LINKED_SUPERVISOR_ID);
	});

	it("should resolve linked SUPERVISOR beneficiary with the logged supervisor member id when available", () => {
		const pulled = mapScenarioCommissionsToPulledSaleCommissions(
			[buildLinkedSupervisorScenarioCommission()],
			new Date("2026-03-10"),
			{
				partnerId: PARTNER_ID,
				partnerSupervisorIdsByPartnerId: new Map([
					[
						PARTNER_ID,
						[LINKED_SUPERVISOR_ID, SALE_CREATOR_SUPERVISOR_MEMBER_ID],
					],
				]),
				saleCreatorUserId: SALE_CREATOR_USER_ID,
				saleCreatorSupervisorMemberId: SALE_CREATOR_SUPERVISOR_MEMBER_ID,
			},
		);

		expect(pulled[0]?.beneficiaryId).toBe(SALE_CREATOR_SUPERVISOR_MEMBER_ID);
	});

	it("should resolve linked SUPERVISOR beneficiary from partner linked supervisor users when member ids are not preloaded", () => {
		const pulled = mapScenarioCommissionsToPulledSaleCommissions(
			[buildLinkedSupervisorScenarioCommission()],
			new Date("2026-03-10"),
			{
				partnerId: PARTNER_ID,
				partnerSupervisorUserIdsByPartnerId: new Map([
					[PARTNER_ID, [NON_LINKED_SUPERVISOR_ID, SALE_CREATOR_USER_ID]],
				]),
				saleCreatorUserId: SALE_CREATOR_USER_ID,
				saleCreatorSupervisorMemberId: SALE_CREATOR_SUPERVISOR_MEMBER_ID,
				partnerSupervisorIdsByPartnerId: new Map([[PARTNER_ID, []]]),
			},
		);

		expect(pulled[0]?.beneficiaryId).toBe(SALE_CREATOR_SUPERVISOR_MEMBER_ID);
	});

	it("should keep linked SUPERVISOR beneficiary unresolved when creator is not a linked supervisor", () => {
		const pulled = mapScenarioCommissionsToPulledSaleCommissions(
			[buildLinkedSupervisorScenarioCommission()],
			new Date("2026-03-10"),
			{
				partnerId: PARTNER_ID,
				partnerSupervisorIdsByPartnerId: new Map([
					[PARTNER_ID, [LINKED_SUPERVISOR_ID, SECOND_LINKED_SUPERVISOR_ID]],
				]),
				saleCreatorUserId: SALE_CREATOR_USER_ID,
				supervisorMemberIdByUserId: new Map([
					[SALE_CREATOR_USER_ID, NON_LINKED_SUPERVISOR_ID],
				]),
			},
		);

		expect(pulled[0]?.beneficiaryId).toBeUndefined();
		expect(pulled[0]?.beneficiaryLabel).toBe("Supervisor vinculado");
	});

	it("should keep linked SUPERVISOR beneficiary unresolved when partner has no linked supervisors", () => {
		const pulled = mapScenarioCommissionsToPulledSaleCommissions(
			[buildLinkedSupervisorScenarioCommission()],
			new Date("2026-03-10"),
			{
				partnerId: PARTNER_ID,
				partnerSupervisorIdsByPartnerId: new Map([[PARTNER_ID, []]]),
			},
		);

		expect(pulled[0]?.beneficiaryId).toBeUndefined();
		expect(pulled[0]?.beneficiaryLabel).toBe("Supervisor vinculado");
	});

	it("should keep linked SUPERVISOR beneficiary unresolved when sale is not from a partner", () => {
		const pulled = mapScenarioCommissionsToPulledSaleCommissions(
			[buildLinkedSupervisorScenarioCommission()],
			new Date("2026-03-10"),
			{
				sellerId: SALE_SELLER_ID,
				saleCreatorUserId: SALE_CREATOR_USER_ID,
				supervisorMemberIdByUserId: new Map([
					[SALE_CREATOR_USER_ID, LINKED_SUPERVISOR_ID],
				]),
			},
		);

		expect(pulled[0]?.beneficiaryId).toBeUndefined();
		expect(pulled[0]?.beneficiaryLabel).toBe("Supervisor vinculado");
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
