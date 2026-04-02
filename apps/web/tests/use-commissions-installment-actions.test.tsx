import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CommissionInstallmentRow } from "@/pages/_app/commissions/-components/commissions-data-table/types";
import { useCommissionsInstallmentActions } from "@/pages/_app/commissions/-components/commissions-data-table/hooks/use-commissions-installment-actions";

const mocks = vi.hoisted(() => ({
	reverseInstallment: vi.fn().mockResolvedValue(undefined),
	getRules: vi.fn(),
	getSaleInstallments: vi.fn(),
}));

function createDeferredPromise<T>() {
	let resolve: (value: T | PromiseLike<T>) => void = () => {};
	let reject: (reason?: unknown) => void = () => {};
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});

	return { promise, resolve, reject };
}

vi.mock("@/context/app-context", () => ({
	useApp: () => ({
		organization: {
			slug: "org-test",
		},
	}),
}));

vi.mock("@/hooks/sales", () => ({
	usePatchSaleCommissionInstallmentStatus: () => ({
		mutateAsync: vi.fn().mockResolvedValue(undefined),
		isPending: false,
	}),
	useUpdateSaleCommissionInstallment: () => ({
		mutateAsync: vi.fn().mockResolvedValue(undefined),
		isPending: false,
	}),
	useReverseSaleCommissionInstallment: () => ({
		mutateAsync: mocks.reverseInstallment,
		isPending: false,
	}),
	useDeleteSaleCommissionInstallment: () => ({
		mutateAsync: vi.fn().mockResolvedValue(undefined),
		isPending: false,
	}),
}));

vi.mock("@/http/generated", () => ({
	getOrganizationsSlugProductsIdCommissionReversalRules: (params: unknown) =>
		mocks.getRules(params),
	getOrganizationsSlugSalesSaleidCommissionInstallments: (params: unknown) =>
		mocks.getSaleInstallments(params),
}));

vi.mock("sonner", () => ({
	toast: {
		success: vi.fn(),
		error: vi.fn(),
	},
}));

const installmentRow: CommissionInstallmentRow = {
	id: "installment-1",
	saleId: "sale-1",
	saleStatus: "COMPLETED",
	saleDate: "2026-03-10T00:00:00.000Z",
	customer: {
		id: "customer-1",
		name: "Cliente Teste",
	},
	product: {
		id: "product-1",
		name: "Produto Teste",
	},
	company: {
		id: "company-1",
		name: "Empresa Teste",
	},
	unit: null,
	saleCommissionId: "commission-1",
	installmentNumber: 3,
	recipientType: "SELLER",
	sourceType: "PULLED",
	direction: "OUTCOME",
	beneficiaryId: "seller-1",
	beneficiaryLabel: "Vendedor Teste",
	beneficiaryKey: "SELLER:seller-1",
	percentage: 2,
	amount: 10000,
	status: "PENDING",
	expectedPaymentDate: "2026-03-30T00:00:00.000Z",
	paymentDate: null,
};

describe("useCommissionsInstallmentActions - reversal amount", () => {
	beforeEach(() => {
		mocks.reverseInstallment.mockClear();
		mocks.getRules.mockReset();
		mocks.getSaleInstallments.mockReset();
	});

	it("pre-fills automatic value and sends manualAmount even without editing", async () => {
		const rulesDeferred = createDeferredPromise<{
			productId: string;
			sourceProductId: string;
			inherited: boolean;
			rules: Array<{ installmentNumber: number; percentage: number }>;
		}>();
		const saleInstallmentsDeferred = createDeferredPromise<{
			installments: Array<{
				saleCommissionId: string;
				status: string;
				amount: number;
			}>;
		}>();
		mocks.getRules.mockReturnValue(rulesDeferred.promise);
		mocks.getSaleInstallments.mockReturnValue(saleInstallmentsDeferred.promise);

		const { result } = renderHook(() =>
			useCommissionsInstallmentActions({
				canChangeInstallmentStatus: true,
				canEditInstallment: true,
				canDeleteInstallment: true,
				selectedInstallments: [],
				onDeselectInstallment: vi.fn(),
				onDeselectInstallments: vi.fn(),
			}),
		);

		act(() => {
			result.current.requestInstallmentReversal(installmentRow);
		});

		expect(result.current.reversalAction?.calculationStatus).toBe("LOADING");
		expect(result.current.reversalAction?.mode).toBe("MANUAL");
		expect(result.current.reversalAction?.manualAmount).toBe("");

		await act(async () => {
			rulesDeferred.resolve({
				productId: "product-1",
				sourceProductId: "product-1",
				inherited: false,
				rules: [
					{
						installmentNumber: 3,
						percentage: 65,
					},
				],
			});
			saleInstallmentsDeferred.resolve({
				installments: [
					{
						saleCommissionId: "commission-1",
						status: "PAID",
						amount: 10000,
					},
					{
						saleCommissionId: "commission-1",
						status: "PAID",
						amount: 10000,
					},
				],
			});
		});

		await waitFor(() => {
			expect(result.current.reversalAction?.calculationStatus).toBe("READY");
			expect(result.current.reversalAction?.mode).toBe("AUTO");
			expect(result.current.reversalAction?.manualAmount).toBe("-130.00");
		});

		await act(async () => {
			await result.current.handleConfirmInstallmentReversal();
		});

		expect(mocks.reverseInstallment).toHaveBeenCalledWith(
			expect.objectContaining({
				saleId: "sale-1",
				installmentId: "installment-1",
				manualAmount: -13000,
			}),
		);
	});

	it("rejects positive manual input for reversal", async () => {
		const { result } = renderHook(() =>
			useCommissionsInstallmentActions({
				canChangeInstallmentStatus: true,
				canEditInstallment: true,
				canDeleteInstallment: true,
				selectedInstallments: [],
				onDeselectInstallment: vi.fn(),
				onDeselectInstallments: vi.fn(),
			}),
		);

		act(() => {
			result.current.setReversalAction({
				installment: installmentRow,
				reversalDate: "2026-03-25",
				mode: "MANUAL",
				calculationStatus: "READY",
				calculationError: null,
				hasManualOverride: true,
				manualAmount: "130",
				rulePercentage: null,
				totalPaidAmount: null,
				calculatedAmount: null,
			});
		});

		await act(async () => {
			await result.current.handleConfirmInstallmentReversal();
		});

		expect(mocks.reverseInstallment).not.toHaveBeenCalled();
	});

	it("keeps modal open with manual fallback when automatic calculation fails", async () => {
		mocks.getRules.mockRejectedValue(new Error("Falha ao carregar regras"));
		mocks.getSaleInstallments.mockResolvedValue({
			installments: [],
		});

		const { result } = renderHook(() =>
			useCommissionsInstallmentActions({
				canChangeInstallmentStatus: true,
				canEditInstallment: true,
				canDeleteInstallment: true,
				selectedInstallments: [],
				onDeselectInstallment: vi.fn(),
				onDeselectInstallments: vi.fn(),
			}),
		);

		act(() => {
			result.current.requestInstallmentReversal(installmentRow);
		});

		await waitFor(() => {
			expect(result.current.reversalAction?.calculationStatus).toBe("ERROR");
			expect(result.current.reversalAction?.mode).toBe("MANUAL");
		});
	});

	it("does not override manual value typed during loading", async () => {
		const rulesDeferred = createDeferredPromise<{
			productId: string;
			sourceProductId: string;
			inherited: boolean;
			rules: Array<{ installmentNumber: number; percentage: number }>;
		}>();
		const saleInstallmentsDeferred = createDeferredPromise<{
			installments: Array<{
				saleCommissionId: string;
				status: string;
				amount: number;
			}>;
		}>();
		mocks.getRules.mockReturnValue(rulesDeferred.promise);
		mocks.getSaleInstallments.mockReturnValue(saleInstallmentsDeferred.promise);

		const { result } = renderHook(() =>
			useCommissionsInstallmentActions({
				canChangeInstallmentStatus: true,
				canEditInstallment: true,
				canDeleteInstallment: true,
				selectedInstallments: [],
				onDeselectInstallment: vi.fn(),
				onDeselectInstallments: vi.fn(),
			}),
		);

		act(() => {
			result.current.requestInstallmentReversal(installmentRow);
		});

		act(() => {
			result.current.setReversalAction((current) =>
				current
					? {
							...current,
							hasManualOverride: true,
							manualAmount: "50",
						}
					: current,
			);
		});

		await act(async () => {
			rulesDeferred.resolve({
				productId: "product-1",
				sourceProductId: "product-1",
				inherited: false,
				rules: [
					{
						installmentNumber: 3,
						percentage: 65,
					},
				],
			});
			saleInstallmentsDeferred.resolve({
				installments: [
					{
						saleCommissionId: "commission-1",
						status: "PAID",
						amount: 10000,
					},
					{
						saleCommissionId: "commission-1",
						status: "PAID",
						amount: 10000,
					},
				],
			});
		});

		await waitFor(() => {
			expect(result.current.reversalAction?.calculationStatus).toBe("READY");
			expect(result.current.reversalAction?.mode).toBe("AUTO");
			expect(result.current.reversalAction?.manualAmount).toBe("50");
		});
	});
});
