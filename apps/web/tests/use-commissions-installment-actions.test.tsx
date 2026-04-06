import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CommissionInstallmentRow } from "@/pages/_app/commissions/-components/commissions-data-table/types";
import { useCommissionsInstallmentActions } from "@/pages/_app/commissions/-components/commissions-data-table/hooks/use-commissions-installment-actions";

const mocks = vi.hoisted(() => ({
	reverseInstallment: vi.fn().mockResolvedValue(undefined),
	undoInstallmentReversal: vi.fn().mockResolvedValue(undefined),
	patchInstallmentsStatusBulk: vi.fn().mockResolvedValue({
		updatedCount: 0,
		skipped: [],
	}),
	getRules: vi.fn(),
	getSaleInstallments: vi.fn(),
	toastSuccess: vi.fn(),
	toastError: vi.fn(),
	toastWarning: vi.fn(),
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
	usePatchCommissionInstallmentsStatusBulk: () => ({
		mutateAsync: mocks.patchInstallmentsStatusBulk,
		isPending: false,
	}),
	useReverseSaleCommissionInstallment: () => ({
		mutateAsync: mocks.reverseInstallment,
		isPending: false,
	}),
	useUndoSaleCommissionInstallmentReversal: () => ({
		mutateAsync: mocks.undoInstallmentReversal,
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
		success: mocks.toastSuccess,
		error: mocks.toastError,
		warning: mocks.toastWarning,
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
	originInstallmentId: null,
	originInstallmentNumber: null,
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
		mocks.undoInstallmentReversal.mockClear();
		mocks.patchInstallmentsStatusBulk.mockReset();
		mocks.getRules.mockReset();
		mocks.getSaleInstallments.mockReset();
		mocks.toastSuccess.mockReset();
		mocks.toastError.mockReset();
		mocks.toastWarning.mockReset();
	});

	it("pre-fills automatic value and confirms without forcing manualAmount", async () => {
		const rulesDeferred = createDeferredPromise<{
			mode: "INSTALLMENT_BY_NUMBER" | "TOTAL_PAID_PERCENTAGE" | null;
			totalPaidPercentage: number | null;
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
				mode: "INSTALLMENT_BY_NUMBER",
				totalPaidPercentage: null,
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
			}),
		);
		expect(mocks.reverseInstallment.mock.calls[0]?.[0]).not.toHaveProperty(
			"manualAmount",
		);
	});

	it("enables cancel pending installments by default when there are future pending installments", async () => {
		mocks.getRules.mockResolvedValue({
			mode: "INSTALLMENT_BY_NUMBER",
			totalPaidPercentage: null,
			rules: [
				{
					installmentNumber: 3,
					percentage: 65,
				},
			],
		});
		mocks.getSaleInstallments.mockResolvedValue({
			installments: [
				{
					saleCommissionId: "commission-1",
					installmentNumber: 3,
					status: "PAID",
					amount: 10000,
				},
				{
					saleCommissionId: "commission-1",
					installmentNumber: 4,
					status: "PENDING",
					amount: 8000,
				},
			],
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
			expect(result.current.reversalAction?.pendingFutureInstallmentsCount).toBe(1);
			expect(result.current.reversalAction?.cancelPendingInstallments).toBe(true);
		});

		await act(async () => {
			await result.current.handleConfirmInstallmentReversal();
		});

		expect(mocks.reverseInstallment).toHaveBeenCalledWith(
			expect.objectContaining({
				saleId: "sale-1",
				installmentId: "installment-1",
				cancelPendingInstallments: true,
			}),
		);
	});

	it("allows disabling cancel pending installments before confirming reversal", async () => {
		mocks.getRules.mockResolvedValue({
			mode: "INSTALLMENT_BY_NUMBER",
			totalPaidPercentage: null,
			rules: [
				{
					installmentNumber: 3,
					percentage: 65,
				},
			],
		});
		mocks.getSaleInstallments.mockResolvedValue({
			installments: [
				{
					saleCommissionId: "commission-1",
					installmentNumber: 3,
					status: "PAID",
					amount: 10000,
				},
				{
					saleCommissionId: "commission-1",
					installmentNumber: 4,
					status: "PENDING",
					amount: 8000,
				},
			],
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
			expect(result.current.reversalAction?.pendingFutureInstallmentsCount).toBe(1);
		});

		act(() => {
			result.current.setReversalAction((current) =>
				current
					? {
							...current,
							cancelPendingInstallments: false,
						}
					: current,
			);
		});

		await act(async () => {
			await result.current.handleConfirmInstallmentReversal();
		});

		expect(mocks.reverseInstallment).toHaveBeenCalledWith(
			expect.objectContaining({
				saleId: "sale-1",
				installmentId: "installment-1",
				cancelPendingInstallments: false,
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
				cancelPendingInstallments: false,
				pendingFutureInstallmentsCount: 0,
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
			mode: "INSTALLMENT_BY_NUMBER" | "TOTAL_PAID_PERCENTAGE" | null;
			totalPaidPercentage: number | null;
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
				mode: "INSTALLMENT_BY_NUMBER",
				totalPaidPercentage: null,
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

	it("opens undo reversal confirmation and executes restore", async () => {
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
			result.current.requestInstallmentReversalUndo({
				...installmentRow,
				status: "REVERSED",
			});
		});

		expect(result.current.reversalUndoAction?.installment.id).toBe(
			"installment-1",
		);

		await act(async () => {
			await result.current.handleConfirmInstallmentReversalUndo();
		});

		expect(mocks.undoInstallmentReversal).toHaveBeenCalledWith(
			expect.objectContaining({
				saleId: "sale-1",
				installmentId: "installment-1",
			}),
		);
	});

	it("applies bulk status change and deselects only updated installments", async () => {
		mocks.patchInstallmentsStatusBulk.mockResolvedValue({
			updatedCount: 1,
			skipped: [
				{
					installmentId: "installment-2",
					reason: "INVALID_STATUS_TRANSITION",
				},
			],
		});
		const onDeselectInstallments = vi.fn();

		const { result } = renderHook(() =>
			useCommissionsInstallmentActions({
				canChangeInstallmentStatus: true,
				canEditInstallment: true,
				canDeleteInstallment: true,
				selectedInstallments: [
					{
						id: "installment-1",
						saleId: "sale-1",
						amount: 10_000,
						status: "PENDING",
					},
					{
						id: "installment-2",
						saleId: "sale-2",
						amount: 11_000,
						status: "PAID",
					},
				],
				onDeselectInstallment: vi.fn(),
				onDeselectInstallments,
			}),
		);

		act(() => {
			result.current.setBulkStatus("PAID");
			result.current.setBulkStatusDate("2026-03-30");
		});

		await act(async () => {
			await result.current.handleConfirmBulkStatusChange();
		});

		expect(mocks.patchInstallmentsStatusBulk).toHaveBeenCalledWith({
			installmentIds: ["installment-1", "installment-2"],
			saleIds: ["sale-1", "sale-2"],
			status: "PAID",
			paymentDate: "2026-03-30",
			reversalDate: undefined,
			silent: true,
		});
		expect(onDeselectInstallments).toHaveBeenCalledWith(["installment-1"]);
		expect(mocks.toastSuccess).toHaveBeenCalledWith("1 parcela(s) atualizada(s).");
		expect(mocks.toastWarning).toHaveBeenCalledWith(
			"1 parcela(s) não puderam ser atualizadas.",
		);
	});

	it("requires date for bulk canceled status", async () => {
		const { result } = renderHook(() =>
			useCommissionsInstallmentActions({
				canChangeInstallmentStatus: true,
				canEditInstallment: true,
				canDeleteInstallment: true,
				selectedInstallments: [
					{
						id: "installment-1",
						saleId: "sale-1",
						amount: 10_000,
						status: "PENDING",
					},
				],
				onDeselectInstallment: vi.fn(),
				onDeselectInstallments: vi.fn(),
			}),
		);

		act(() => {
			result.current.setBulkStatus("CANCELED");
			result.current.setBulkStatusDate("");
		});

		await act(async () => {
			await result.current.handleConfirmBulkStatusChange();
		});

		expect(mocks.patchInstallmentsStatusBulk).not.toHaveBeenCalled();
		expect(mocks.toastError).toHaveBeenCalledWith(
			"Informe a data de cancelamento.",
		);
	});
});
