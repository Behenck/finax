import { describe, expect, it } from "vitest";
import { formatDate } from "../src/pages/_app/commissions/-components/commissions-data-table/utils";

describe("commissions data-table utils", () => {
	it("should keep day stable for timezone-aware datetime strings", () => {
		expect(formatDate("2026-03-10T00:00:00+14:00")).toBe("10/03/2026");
		expect(formatDate("2026-03-10T00:00:00.000Z")).toBe("10/03/2026");
	});
});
