import { describe, expect, it } from "vitest";
import {
	resolveAdjacentSaleIds,
	resolveOrderedSaleIdsForNavigation,
} from "@/hooks/sales/use-sale-navigation";

describe("sale navigation helpers", () => {
	it("should prioritize navigation context when current sale is present", () => {
		const orderedSaleIds = resolveOrderedSaleIdsForNavigation({
			currentSaleId: "sale-2",
			contextOrderedSaleIds: ["sale-3", "sale-2", "sale-1"],
			fallbackOrderedSaleIds: ["sale-1", "sale-2", "sale-3"],
		});

		expect(orderedSaleIds).toEqual(["sale-3", "sale-2", "sale-1"]);
		expect(resolveAdjacentSaleIds("sale-2", orderedSaleIds)).toEqual({
			previousSaleId: "sale-3",
			nextSaleId: "sale-1",
		});
	});

	it("should return undefined at list edges", () => {
		expect(resolveAdjacentSaleIds("sale-1", ["sale-1", "sale-2"])).toEqual({
			previousSaleId: undefined,
			nextSaleId: "sale-2",
		});
		expect(resolveAdjacentSaleIds("sale-2", ["sale-1", "sale-2"])).toEqual({
			previousSaleId: "sale-1",
			nextSaleId: undefined,
		});
	});

	it("should fallback to all visible sales when context is missing current sale", () => {
		const orderedSaleIds = resolveOrderedSaleIdsForNavigation({
			currentSaleId: "sale-2",
			contextOrderedSaleIds: ["sale-10", "sale-11"],
			fallbackOrderedSaleIds: ["sale-1", "sale-2", "sale-3"],
		});

		expect(orderedSaleIds).toEqual(["sale-1", "sale-2", "sale-3"]);
		expect(resolveAdjacentSaleIds("sale-2", orderedSaleIds)).toEqual({
			previousSaleId: "sale-1",
			nextSaleId: "sale-3",
		});
	});
});
