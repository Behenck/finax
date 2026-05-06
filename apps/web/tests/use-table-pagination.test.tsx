import { act, renderHook, waitFor } from "@testing-library/react";
import type { Dispatch, SetStateAction } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTablePagination } from "../src/hooks/filters/use-table-pagination";

const mocks = vi.hoisted(() => {
	const defaults: Record<string, unknown> = {
		page: 1,
		pageSize: 10,
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

describe("useTablePagination", () => {
	beforeEach(() => {
		mocks.reset();
	});

	it("should clamp the current page and paginate using the URL state", async () => {
		mocks.reset({ page: 4, pageSize: 10 });

		const { result } = renderHook(() =>
			useTablePagination({
				items: Array.from({ length: 35 }, (_, index) => index + 1),
			}),
		);

		await waitFor(() => {
			expect(result.current.currentPage).toBe(4);
		});

		expect(result.current.currentPageSize).toBe(10);
		expect(result.current.totalItems).toBe(35);
		expect(result.current.totalPages).toBe(4);
		expect(result.current.paginatedItems).toEqual([31, 32, 33, 34, 35]);
	});

	it("should reset to page 1 when page size or external filters change", async () => {
		mocks.reset({ page: 2, pageSize: 10 });

		const { result, rerender } = renderHook(
			({ resetKeys }) =>
				useTablePagination({
					items: Array.from({ length: 95 }, (_, index) => index + 1),
					resetKeys,
				}),
			{
				initialProps: {
					resetKeys: [""],
				},
			},
		);

		act(() => {
			void result.current.handlePageSizeChange(50);
		});

		await waitFor(() => {
			expect(result.current.currentPage).toBe(1);
		});

		expect(result.current.currentPageSize).toBe(50);
		expect(mocks.setCalls).toHaveBeenCalledWith("pageSize", 50);
		expect(mocks.setCalls).toHaveBeenCalledWith("page", 1);

		act(() => {
			void result.current.handlePageChange(2);
		});

		await waitFor(() => {
			expect(result.current.currentPage).toBe(2);
		});

		rerender({ resetKeys: ["novo filtro"] });

		await waitFor(() => {
			expect(result.current.currentPage).toBe(1);
		});
	});
});
