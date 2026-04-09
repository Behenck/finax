import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCustomerSalesDelinquencyBulkActions } from "../src/hooks/sales";
import type { GetOrganizationsSlugCustomersCustomerid200 } from "../src/http/generated";

const mocks = vi.hoisted(() => ({
	postDelinquencyMock: vi.fn(),
	resolveDelinquencyMock: vi.fn(),
}));

function buildMarkSales() {
	return [
		{
			id: "sale-completed",
			status: "COMPLETED",
			openDelinquencies: [],
		},
		{
			id: "sale-pending",
			status: "PENDING",
			openDelinquencies: [],
		},
	] as unknown as GetOrganizationsSlugCustomersCustomerid200["customer"]["sales"];
}

function buildResolveSales() {
	return [
		{
			id: "sale-with-open",
			status: "COMPLETED",
			openDelinquencies: [{ id: "delinq-1" }, { id: "delinq-2" }],
		},
		{
			id: "sale-without-open",
			status: "COMPLETED",
			openDelinquencies: [],
		},
	] as unknown as GetOrganizationsSlugCustomersCustomerid200["customer"]["sales"];
}

vi.mock("@/context/app-context", () => ({
	useApp: () => ({
		organization: {
			slug: "org-teste",
		},
	}),
}));

vi.mock("@/http/generated", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/http/generated")>();
	return {
		...actual,
		postOrganizationsSlugSalesSaleidDelinquencies: mocks.postDelinquencyMock,
		patchOrganizationsSlugSalesSaleidDelinquenciesDelinquencyidResolve:
			mocks.resolveDelinquencyMock,
	};
});

describe("useCustomerSalesDelinquencyBulkActions", () => {
	beforeEach(() => {
		mocks.postDelinquencyMock.mockReset();
		mocks.resolveDelinquencyMock.mockReset();
	});

	it("should mark only COMPLETED sales as delinquent and ignore other statuses", async () => {
		const queryClient = new QueryClient({
			defaultOptions: {
				queries: { retry: false },
				mutations: { retry: false },
			},
		});
		const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
		mocks.postDelinquencyMock.mockResolvedValue({ delinquencyId: "delinq-10" });

		const wrapper = ({ children }: { children: ReactNode }) => (
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		);

		const { result } = renderHook(
			() => useCustomerSalesDelinquencyBulkActions(),
			{ wrapper },
		);

		let response:
			| Awaited<
					ReturnType<
						typeof result.current.markCustomerSalesAsDelinquent
					>
			  >
			| undefined;

		await act(async () => {
			response = await result.current.markCustomerSalesAsDelinquent({
				customerId: "customer-1",
				sales: buildMarkSales(),
				selectedSaleIds: ["sale-completed", "sale-pending"],
				dueDate: "2020-01-01",
			});
		});

		expect(mocks.postDelinquencyMock).toHaveBeenCalledTimes(1);
		expect(mocks.postDelinquencyMock).toHaveBeenCalledWith(
			expect.objectContaining({
				saleId: "sale-completed",
				data: { dueDate: "2020-01-01" },
			}),
		);
		expect(response).toMatchObject({
			selectedCount: 2,
			attemptedCount: 1,
			successCount: 1,
			failedCount: 0,
			ignoredNotCompletedCount: 1,
		});
		expect(invalidateSpy).toHaveBeenCalled();
	});

	it("should resolve all open delinquencies from selected sales and skip sales without open items", async () => {
		const queryClient = new QueryClient({
			defaultOptions: {
				queries: { retry: false },
				mutations: { retry: false },
			},
		});
		const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
		mocks.resolveDelinquencyMock.mockResolvedValue({});

		const wrapper = ({ children }: { children: ReactNode }) => (
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		);

		const { result } = renderHook(
			() => useCustomerSalesDelinquencyBulkActions(),
			{ wrapper },
		);

		let response:
			| Awaited<
					ReturnType<
						typeof result.current.resolveCustomerSalesDelinquencies
					>
			  >
			| undefined;

		await act(async () => {
			response = await result.current.resolveCustomerSalesDelinquencies({
				customerId: "customer-1",
				sales: buildResolveSales(),
				selectedSaleIds: ["sale-with-open", "sale-without-open"],
			});
		});

		expect(mocks.resolveDelinquencyMock).toHaveBeenCalledTimes(2);
		expect(mocks.resolveDelinquencyMock).toHaveBeenCalledWith(
			expect.objectContaining({
				saleId: "sale-with-open",
				delinquencyId: "delinq-1",
			}),
		);
		expect(mocks.resolveDelinquencyMock).toHaveBeenCalledWith(
			expect.objectContaining({
				saleId: "sale-with-open",
				delinquencyId: "delinq-2",
			}),
		);
		expect(response).toMatchObject({
			selectedCount: 2,
			attemptedOccurrenceCount: 2,
			resolvedCount: 2,
			failedCount: 0,
			skippedWithoutOpenCount: 1,
		});
		expect(invalidateSpy).toHaveBeenCalled();
	});
});
