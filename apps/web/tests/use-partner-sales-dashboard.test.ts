import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePartnerSalesDashboard } from "../src/hooks/sales/use-partner-sales-dashboard";

const mocks = vi.hoisted(() => ({
	useApp: vi.fn(() => ({
		organization: {
			slug: "acme",
		},
	})),
	useGetOrganizationsSlugSalesDashboardPartners: vi.fn(() => ({
		data: undefined,
		isLoading: false,
		isError: false,
		refetch: vi.fn(),
	})),
}));

vi.mock("@/context/app-context", () => ({
	useApp: () => mocks.useApp(),
}));

vi.mock("@/http/generated", () => ({
	useGetOrganizationsSlugSalesDashboardPartners: (...args: unknown[]) =>
		mocks.useGetOrganizationsSlugSalesDashboardPartners(...args),
}));

describe("usePartnerSalesDashboard", () => {
	beforeEach(() => {
		mocks.useGetOrganizationsSlugSalesDashboardPartners.mockClear();
	});

	it("disables previous-data placeholder when requested", () => {
		renderHook(() =>
			usePartnerSalesDashboard({
				startDate: "2026-01-01",
				endDate: "2026-01-31",
				inactiveMonths: 3,
				dynamicFieldId: "11111111-1111-4111-8111-111111111111",
				keepPreviousData: false,
			}),
		);

		const [, options] =
			mocks.useGetOrganizationsSlugSalesDashboardPartners.mock.calls[0] ?? [];

		expect(options.query.placeholderData).toBeUndefined();
	});

	it("keeps previous data by default", () => {
		renderHook(() =>
			usePartnerSalesDashboard({
				startDate: "2026-01-01",
				endDate: "2026-01-31",
				inactiveMonths: 3,
			}),
		);

		const [, options] =
			mocks.useGetOrganizationsSlugSalesDashboardPartners.mock.calls[0] ?? [];

		expect(typeof options.query.placeholderData).toBe("function");
	});
});
