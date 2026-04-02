import { act, renderHook, waitFor } from "@testing-library/react";
import type { Dispatch, SetStateAction } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCommissionsInstallmentsFilters } from "../src/pages/_app/commissions/-components/commissions-data-table/hooks/use-commissions-installments-filters";

const mocks = vi.hoisted(() => {
	const defaults: Record<string, unknown> = {
		direction: "OUTCOME",
		status: "ALL",
		q: "",
		companyId: "",
		unitId: "",
		productId: "",
		expectedFrom: "",
		expectedTo: "",
		page: 1,
		pageSize: 20,
	};

	const values = new Map<string, unknown>(Object.entries(defaults));
	const setCalls = vi.fn<(key: string, value: unknown) => void>();

	function reset(nextValues: Partial<typeof defaults> = {}) {
		values.clear();
		for (const [key, value] of Object.entries({
			...defaults,
			...nextValues,
		})) {
			values.set(key, value);
		}
		setCalls.mockReset();
	}

	return {
		values,
		setCalls,
		reset,
	};
});

vi.mock("nuqs", async (importOriginal) => {
	const actual = await importOriginal<typeof import("nuqs")>();
	const React = await import("react");

	return {
		...actual,
		useQueryState: (key: string) => {
			const [value, setValue] = React.useState(() => mocks.values.get(key));

			const setQueryState = (
				next: unknown | ((previous: unknown) => unknown),
			) => {
				setValue((previous) => {
					const resolvedValue =
						typeof next === "function"
							? (next as (previous: unknown) => unknown)(previous)
							: next;
					mocks.values.set(key, resolvedValue);
					mocks.setCalls(key, resolvedValue);
					return resolvedValue;
				});

				return Promise.resolve(null);
			};

			return [
				value,
				setQueryState as Dispatch<SetStateAction<unknown>>,
			] as const;
		},
	};
});

describe("useCommissionsInstallmentsFilters", () => {
	beforeEach(() => {
		mocks.reset();
		window.localStorage.clear();
	});

	it("should restore filters from localStorage on first render", async () => {
		window.localStorage.setItem(
			"finax:commissions:list:filters",
			JSON.stringify({
				direction: "INCOME",
				status: "PAID",
				q: "cliente teste",
				companyId: "company-1",
				unitId: "unit-1",
				productId: "product-1",
				expectedFrom: "2026-03-01",
				expectedTo: "2026-03-31",
				page: 3,
				pageSize: 50,
			}),
		);

		const { result } = renderHook(() =>
			useCommissionsInstallmentsFilters({
				canViewAllCommissions: true,
			}),
		);

		await waitFor(() => {
			expect(result.current.directionFilter).toBe("INCOME");
			expect(result.current.statusFilter).toBe("PAID");
			expect(result.current.searchFilter).toBe("cliente teste");
			expect(result.current.companyIdFilter).toBe("company-1");
			expect(result.current.unitIdFilter).toBe("unit-1");
			expect(result.current.productIdFilter).toBe("product-1");
		});

		expect(mocks.setCalls).toHaveBeenCalledWith(
			"expectedFrom",
			"2026-03-01",
		);
		expect(mocks.setCalls).toHaveBeenCalledWith("expectedTo", "2026-03-31");
		expect(mocks.setCalls).toHaveBeenCalledWith("page", 3);
		expect(mocks.setCalls).toHaveBeenCalledWith("pageSize", 50);
	});

	it("should persist updated filters and reset all values with clearFilters", async () => {
		const { result } = renderHook(() =>
			useCommissionsInstallmentsFilters({
				canViewAllCommissions: true,
			}),
		);

		act(() => {
			result.current.handleSearchChange("canal norte");
			result.current.handleCompanyIdChange("company-2");
			result.current.handleUnitIdChange("unit-2");
			result.current.handleProductIdChange("product-2");
			result.current.handleStatusChange("PENDING");
		});

		await waitFor(() => {
			const stored = window.localStorage.getItem(
				"finax:commissions:list:filters",
			);
			expect(stored).not.toBeNull();
			const parsed = JSON.parse(stored ?? "{}");
			expect(parsed.q).toBe("canal norte");
			expect(parsed.companyId).toBe("company-2");
			expect(parsed.unitId).toBe("unit-2");
			expect(parsed.productId).toBe("product-2");
			expect(parsed.status).toBe("PENDING");
		});

		act(() => {
			result.current.clearFilters();
		});

		await waitFor(() => {
			expect(result.current.directionFilter).toBe("OUTCOME");
			expect(result.current.statusFilter).toBe("ALL");
			expect(result.current.searchFilter).toBe("");
			expect(result.current.companyIdFilter).toBe("");
			expect(result.current.unitIdFilter).toBe("");
			expect(result.current.productIdFilter).toBe("");
			expect(result.current.currentPage).toBe(1);
			expect(result.current.currentPageSize).toBe(20);
		});
	});
});
