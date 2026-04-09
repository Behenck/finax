import { describe, expect, it } from "vitest";
import { dashboardViewParser } from "../src/hooks/filters/parsers";

describe("dashboardViewParser", () => {
	it("should parse partners as a valid dashboard view", () => {
		expect(dashboardViewParser.parseServerSide("partners")).toBe("partners");
	});

	it("should fallback to commercial for invalid values", () => {
		expect(dashboardViewParser.parseServerSide("unknown-view")).toBe(
			"commercial",
		);
	});
});
