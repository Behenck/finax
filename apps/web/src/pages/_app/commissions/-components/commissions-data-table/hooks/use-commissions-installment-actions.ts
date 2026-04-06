import { useRef, useState } from "react";
import { toast } from "sonner";
import { useApp } from "@/context/app-context";
import { resolveErrorMessage } from "@/errors";
import { normalizeApiError } from "@/errors/api-error";
import {
	useDeleteSaleCommissionInstallment,
	usePatchCommissionInstallmentsStatusBulk,
	usePatchSaleCommissionInstallmentStatus,
	useReverseSaleCommissionInstallment,
	useUndoSaleCommissionInstallmentReversal,
	useUpdateSaleCommissionInstallment,
} from "@/hooks/sales";
import {
	getOrganizationsSlugProductsIdCommissionReversalRules,
	getOrganizationsSlugSalesSaleidCommissionInstallments,
} from "@/http/generated";
import {
	formatCurrencyBRL,
	parseBRLCurrencyToCents,
} from "@/utils/format-amount";
import type {
	BulkInstallmentStatus,
	CommissionInstallmentRow,
	InstallmentEditState,
	InstallmentPayAction,
	InstallmentReversalAction,
	InstallmentReversalUndoAction,
	SelectedInstallment,
} from "../types";
import { getTodayDateInputValue, toDateInputValue } from "../utils";

function formatCentsToDecimalInput(valueInCents: number) {
	return (valueInCents / 100).toFixed(2);
}

interface UseCommissionsInstallmentActionsParams {
	canChangeInstallmentStatus: boolean;
	canEditInstallment: boolean;
	canDeleteInstallment: boolean;
	selectedInstallments: SelectedInstallment[];
	onDeselectInstallment: (installmentId: string) => void;
	onDeselectInstallments: (installmentIds: string[]) => void;
}

export function useCommissionsInstallmentActions({
	canChangeInstallmentStatus,
	canEditInstallment,
	canDeleteInstallment,
	selectedInstallments,
	onDeselectInstallment,
	onDeselectInstallments,
}: UseCommissionsInstallmentActionsParams) {
	const { organization } = useApp();
	const [payAction, setPayAction] = useState<InstallmentPayAction | null>(null);
	const [editingInstallment, setEditingInstallment] =
		useState<InstallmentEditState | null>(null);
	const [reversalAction, setReversalAction] =
		useState<InstallmentReversalAction | null>(null);
	const [reversalUndoAction, setReversalUndoAction] =
		useState<InstallmentReversalUndoAction | null>(null);
	const [installmentToDelete, setInstallmentToDelete] =
		useState<CommissionInstallmentRow | null>(null);
	const [isBulkStatusDialogOpen, setIsBulkStatusDialogOpen] = useState(false);
	const [bulkStatus, setBulkStatus] = useState<BulkInstallmentStatus>("PAID");
	const [bulkStatusDate, setBulkStatusDate] = useState(
		getTodayDateInputValue(),
	);
	const [isApplyingBulkStatus, setIsApplyingBulkStatus] = useState(false);
	const [isUndoingPayments, setIsUndoingPayments] = useState(false);
	const [isPreparingReversal, setIsPreparingReversal] = useState(false);
	const reversalLoadRequestIdRef = useRef(0);

	const { mutateAsync: patchInstallmentStatus, isPending: isPatchingStatus } =
		usePatchSaleCommissionInstallmentStatus();
	const { mutateAsync: updateInstallment, isPending: isUpdatingInstallment } =
		useUpdateSaleCommissionInstallment();
	const {
		mutateAsync: patchInstallmentsStatusBulk,
		isPending: isPatchingBulkStatus,
	} = usePatchCommissionInstallmentsStatusBulk();
	const { mutateAsync: reverseInstallment, isPending: isReversingInstallment } =
		useReverseSaleCommissionInstallment();
	const {
		mutateAsync: undoInstallmentReversal,
		isPending: isUndoingInstallmentReversal,
	} = useUndoSaleCommissionInstallmentReversal();
	const { mutateAsync: deleteInstallment, isPending: isDeletingInstallment } =
		useDeleteSaleCommissionInstallment();

	const isPaymentActionPending =
		isApplyingBulkStatus || isUndoingPayments || isPatchingBulkStatus;

	function requestInstallmentPayment(installment: CommissionInstallmentRow) {
		if (!canChangeInstallmentStatus) {
			return;
		}

		setPayAction({
			installment,
			paymentDate:
				toDateInputValue(installment.paymentDate) || getTodayDateInputValue(),
			amount: formatCurrencyBRL(installment.amount / 100),
		});
	}

	function requestInstallmentEdition(installment: CommissionInstallmentRow) {
		if (!canEditInstallment) {
			return;
		}

		setEditingInstallment({
			installment,
			percentage: String(installment.percentage),
			amount: formatCurrencyBRL(installment.amount / 100),
			status: installment.status,
			expectedPaymentDate: toDateInputValue(installment.expectedPaymentDate),
			paymentDate: toDateInputValue(installment.paymentDate),
			reversalDate:
				toDateInputValue(installment.paymentDate) || getTodayDateInputValue(),
		});
	}

	function requestInstallmentDelete(installment: CommissionInstallmentRow) {
		if (!canDeleteInstallment) {
			return;
		}

		setInstallmentToDelete(installment);
	}

	function requestInstallmentReversal(installment: CommissionInstallmentRow) {
		if (!canChangeInstallmentStatus) {
			return;
		}
		if (installment.originInstallmentId) {
			toast.error(
				"Selecione uma parcela base para estornar. Movimentos de estorno não podem ser estornados novamente.",
			);
			return;
		}

		if (!organization?.slug) {
			toast.error("Organização não encontrada.");
			return;
		}

		const requestId = reversalLoadRequestIdRef.current + 1;
		reversalLoadRequestIdRef.current = requestId;

		setReversalAction({
			installment,
			reversalDate: getTodayDateInputValue(),
			cancelPendingInstallments: false,
			pendingFutureInstallmentsCount: 0,
			mode: "MANUAL",
			calculationStatus: "LOADING",
			calculationError: null,
			hasManualOverride: false,
			manualAmount: "",
			rulePercentage: null,
			totalPaidAmount: null,
			calculatedAmount: null,
		});
		setIsPreparingReversal(true);

		void (async () => {
			try {
				const [rulesResponse, saleInstallmentsResponse] = await Promise.all([
					getOrganizationsSlugProductsIdCommissionReversalRules({
						slug: organization.slug,
						id: installment.product.id,
						params: {
							includeInherited: true,
						},
					}),
					getOrganizationsSlugSalesSaleidCommissionInstallments({
						slug: organization.slug,
						saleId: installment.saleId,
					}),
				]);

				const pendingFutureInstallmentsCount =
					saleInstallmentsResponse.installments.filter(
						(row) =>
							row.saleCommissionId === installment.saleCommissionId &&
							row.installmentNumber > installment.installmentNumber &&
							row.status === "PENDING",
					).length;

				setReversalAction((current) => {
					if (
						!current ||
						current.installment.id !== installment.id ||
						reversalLoadRequestIdRef.current !== requestId
					) {
						return current;
					}

					const shouldEnableCancelPendingInstallments =
						pendingFutureInstallmentsCount > 0 &&
						current.pendingFutureInstallmentsCount === 0;

					return {
						...current,
						pendingFutureInstallmentsCount,
						cancelPendingInstallments: shouldEnableCancelPendingInstallments
							? true
							: pendingFutureInstallmentsCount > 0
								? current.cancelPendingInstallments
								: false,
					};
				});

				const totalPaidAmount = saleInstallmentsResponse.installments
					.filter(
						(row) =>
							row.saleCommissionId === installment.saleCommissionId &&
							row.status === "PAID" &&
							row.amount > 0,
					)
					.reduce((sum, row) => sum + row.amount, 0);
				if (
					rulesResponse.mode === "TOTAL_PAID_PERCENTAGE" &&
					rulesResponse.totalPaidPercentage !== null
				) {
					const calculatedAmount = -Math.round(
						(totalPaidAmount * rulesResponse.totalPaidPercentage) / 100,
					);

					setReversalAction((current) => {
						if (
							!current ||
							current.installment.id !== installment.id ||
							reversalLoadRequestIdRef.current !== requestId
						) {
							return current;
						}

						const shouldUseCalculatedAmount =
							!current.hasManualOverride &&
							current.manualAmount.trim().length === 0;

						return {
							...current,
							mode: "AUTO",
							calculationStatus: "READY",
							calculationError: null,
							manualAmount: shouldUseCalculatedAmount
								? formatCentsToDecimalInput(calculatedAmount)
								: current.manualAmount,
							rulePercentage: rulesResponse.totalPaidPercentage,
							totalPaidAmount,
							calculatedAmount,
						};
					});
					return;
				}

				const matchedRule = rulesResponse.rules.find(
					(rule) => rule.installmentNumber === installment.installmentNumber,
				);

				if (matchedRule) {
					const calculatedAmount = -Math.round(
						(totalPaidAmount * matchedRule.percentage) / 100,
					);

					setReversalAction((current) => {
						if (
							!current ||
							current.installment.id !== installment.id ||
							reversalLoadRequestIdRef.current !== requestId
						) {
							return current;
						}

						const shouldUseCalculatedAmount =
							!current.hasManualOverride &&
							current.manualAmount.trim().length === 0;

						return {
							...current,
							mode: "AUTO",
							calculationStatus: "READY",
							calculationError: null,
							manualAmount: shouldUseCalculatedAmount
								? formatCentsToDecimalInput(calculatedAmount)
								: current.manualAmount,
							rulePercentage: matchedRule.percentage,
							totalPaidAmount,
							calculatedAmount,
						};
					});
					return;
				}

				setReversalAction((current) => {
					if (
						!current ||
						current.installment.id !== installment.id ||
						reversalLoadRequestIdRef.current !== requestId
					) {
						return current;
					}

					return {
						...current,
						mode: "MANUAL",
						calculationStatus: "READY",
						calculationError: null,
						rulePercentage: null,
						totalPaidAmount: null,
						calculatedAmount: null,
					};
				});
			} catch (error) {
				const message = resolveErrorMessage(normalizeApiError(error));
				setReversalAction((current) => {
					if (
						!current ||
						current.installment.id !== installment.id ||
						reversalLoadRequestIdRef.current !== requestId
					) {
						return current;
					}

					return {
						...current,
						mode: "MANUAL",
						calculationStatus: "ERROR",
						calculationError: message,
					};
				});
			} finally {
				if (reversalLoadRequestIdRef.current === requestId) {
					setIsPreparingReversal(false);
				}
			}
		})();
	}

	function requestInstallmentReversalUndo(
		installment: CommissionInstallmentRow,
	) {
		if (!canChangeInstallmentStatus) {
			return;
		}

		setReversalUndoAction({ installment });
	}

	async function undoInstallmentsPayment(installments: SelectedInstallment[]) {
		if (installments.length === 0) {
			return;
		}

		setIsUndoingPayments(true);

		const results = await Promise.allSettled(
			installments.map((installment) =>
				updateInstallment({
					saleId: installment.saleId,
					installmentId: installment.id,
					data: {
						status: "PENDING",
						paymentDate: null,
						amount: installment.amount,
					},
					silent: true,
				}),
			),
		);

		let restoredCount = 0;
		let failedCount = 0;
		for (const result of results) {
			if (result.status === "fulfilled") {
				restoredCount += 1;
			} else {
				failedCount += 1;
			}
		}

		if (restoredCount > 0) {
			toast.success(`${restoredCount} parcela(s) retornaram para pendente.`);
		}
		if (failedCount > 0) {
			toast.error(`Não foi possível desfazer ${failedCount} parcela(s).`);
		}

		setIsUndoingPayments(false);
	}

	async function handleConfirmInstallmentPayment() {
		if (!payAction || !canChangeInstallmentStatus) {
			return;
		}

		const currentPayAction = payAction;

		try {
			await patchInstallmentStatus({
				saleId: currentPayAction.installment.saleId,
				installmentId: currentPayAction.installment.id,
				status: "PAID",
				amount: parseBRLCurrencyToCents(currentPayAction.amount),
				paymentDate: currentPayAction.paymentDate || undefined,
				silent: true,
			});

			onDeselectInstallment(currentPayAction.installment.id);
			setPayAction(null);
			toast.success("Parcela marcada como paga.", {
				action: {
					label: "Desfazer",
					onClick: () => {
						void undoInstallmentsPayment([
							{
								id: currentPayAction.installment.id,
								saleId: currentPayAction.installment.saleId,
								amount: parseBRLCurrencyToCents(currentPayAction.amount),
								status: "PAID",
							},
						]);
					},
				},
			});
		} catch {
			// erro tratado no hook
		}
	}

	async function handlePayInstallmentToday(
		installment: CommissionInstallmentRow,
	) {
		if (!canChangeInstallmentStatus) {
			return;
		}

		try {
			await patchInstallmentStatus({
				saleId: installment.saleId,
				installmentId: installment.id,
				status: "PAID",
				paymentDate: getTodayDateInputValue(),
				amount: installment.amount,
				silent: true,
			});

			onDeselectInstallment(installment.id);
			toast.success("Parcela marcada como paga.", {
				action: {
					label: "Desfazer",
					onClick: () => {
						void undoInstallmentsPayment([
							{
								id: installment.id,
								saleId: installment.saleId,
								amount: installment.amount,
								status: "PAID",
							},
						]);
					},
				},
			});
		} catch {
			// erro tratado no hook
		}
	}

	async function handleConfirmBulkStatusChange() {
		if (!canChangeInstallmentStatus) {
			return;
		}

		if (selectedInstallments.length === 0) {
			setIsBulkStatusDialogOpen(false);
			return;
		}

		if ((bulkStatus === "PAID" || bulkStatus === "CANCELED") && !bulkStatusDate) {
			toast.error(
				bulkStatus === "PAID"
					? "Informe a data de pagamento."
					: "Informe a data de cancelamento.",
			);
			return;
		}

		setIsApplyingBulkStatus(true);

		try {
			const response = await patchInstallmentsStatusBulk({
				installmentIds: selectedInstallments.map((installment) => installment.id),
				saleIds: selectedInstallments.map((installment) => installment.saleId),
				status: bulkStatus,
				paymentDate:
					bulkStatus === "PAID" ? bulkStatusDate || undefined : undefined,
				reversalDate:
					bulkStatus === "CANCELED" ? bulkStatusDate || undefined : undefined,
				silent: true,
			});

			const skippedIds = new Set(
				response.skipped.map((item) => item.installmentId),
			);
			const updatedIds = selectedInstallments
				.filter((installment) => !skippedIds.has(installment.id))
				.map((installment) => installment.id);

			if (updatedIds.length > 0) {
				onDeselectInstallments(updatedIds);
				toast.success(`${updatedIds.length} parcela(s) atualizada(s).`);
			}

			if (response.skipped.length > 0) {
				toast.warning(
					`${response.skipped.length} parcela(s) não puderam ser atualizadas.`,
				);
			}

			setIsBulkStatusDialogOpen(false);
		} catch {
			// erro tratado no hook
		} finally {
			setIsApplyingBulkStatus(false);
		}
	}

	async function handleConfirmInstallmentEdition() {
		if (!editingInstallment || !canEditInstallment) {
			return;
		}

		const parsedPercentage = Number(
			editingInstallment.percentage.replace(",", "."),
		);

		if (Number.isNaN(parsedPercentage)) {
			toast.error("Informe um percentual válido.");
			return;
		}

		if (!editingInstallment.expectedPaymentDate) {
			toast.error("Informe a previsão de pagamento.");
			return;
		}

		if (editingInstallment.status === "CANCELED" && !editingInstallment.reversalDate) {
			toast.error("Informe a data do estorno.");
			return;
		}

		try {
			const parsedAmount = parseBRLCurrencyToCents(editingInstallment.amount);
			if (editingInstallment.status === "REVERSED" && parsedAmount >= 0) {
				toast.error("Para parcela estornada, o valor deve ser negativo.");
				return;
			}
			if (editingInstallment.status !== "REVERSED" && parsedAmount < 0) {
				toast.error("Valor negativo só é permitido para parcela estornada.");
				return;
			}

			await updateInstallment({
				saleId: editingInstallment.installment.saleId,
				installmentId: editingInstallment.installment.id,
				data: {
					percentage: parsedPercentage,
					amount: parsedAmount,
					status: editingInstallment.status,
					expectedPaymentDate: editingInstallment.expectedPaymentDate,
					paymentDate:
						editingInstallment.status === "PAID" ||
						editingInstallment.status === "REVERSED"
							? editingInstallment.paymentDate || null
							: null,
					reversalDate:
						editingInstallment.status === "CANCELED"
							? editingInstallment.reversalDate || undefined
							: undefined,
				},
			});
			setEditingInstallment(null);
		} catch {
			// erro tratado no hook
		}
	}

	async function handleConfirmInstallmentDelete() {
		if (!installmentToDelete || !canDeleteInstallment) {
			return;
		}

		try {
			await deleteInstallment({
				saleId: installmentToDelete.saleId,
				installmentId: installmentToDelete.id,
			});
			onDeselectInstallment(installmentToDelete.id);
			setInstallmentToDelete(null);
		} catch {
			// erro tratado no hook
		}
	}

	function parseManualAmountToCents(value: string) {
		const normalizedValue = value.replace(",", ".").trim();
		const parsedValue = Number(normalizedValue);
		if (Number.isNaN(parsedValue) || !Number.isFinite(parsedValue)) {
			return null;
		}

		return Math.round(parsedValue * 100);
	}

	async function handleConfirmInstallmentReversal() {
		if (!reversalAction || !canChangeInstallmentStatus) {
			return;
		}

		if (!reversalAction.reversalDate) {
			toast.error("Informe a data do estorno.");
			return;
		}

		const shouldSendManualAmount =
			reversalAction.mode === "MANUAL" || reversalAction.hasManualOverride;
		let parsedManualAmount: number | undefined;

		if (shouldSendManualAmount) {
			const parsedAmount = parseManualAmountToCents(reversalAction.manualAmount);
			if (parsedAmount === null) {
				toast.error("Informe um valor válido para o estorno.");
				return;
			}
			if (parsedAmount === 0) {
				toast.error("O valor do estorno deve ser diferente de zero.");
				return;
			}
			if (parsedAmount > 0) {
				toast.error("O valor do estorno deve ser negativo.");
				return;
			}

			parsedManualAmount = parsedAmount;
		}

		try {
			const payload: {
				saleId: string;
				installmentId: string;
				reversalDate: string;
				cancelPendingInstallments: boolean;
				manualAmount?: number;
			} = {
				saleId: reversalAction.installment.saleId,
				installmentId: reversalAction.installment.id,
				reversalDate: reversalAction.reversalDate,
				cancelPendingInstallments: reversalAction.cancelPendingInstallments,
			};

			if (parsedManualAmount !== undefined) {
				payload.manualAmount = parsedManualAmount;
			}

			await reverseInstallment({
				...payload,
			});
			onDeselectInstallment(reversalAction.installment.id);
			setReversalAction(null);
		} catch {
			// erro tratado no hook
		}
	}

	async function handleConfirmInstallmentReversalUndo() {
		if (!reversalUndoAction || !canChangeInstallmentStatus) {
			return;
		}

		try {
			await undoInstallmentReversal({
				saleId: reversalUndoAction.installment.saleId,
				installmentId: reversalUndoAction.installment.id,
			});
			onDeselectInstallment(reversalUndoAction.installment.id);
			setReversalUndoAction(null);
		} catch {
			// erro tratado no hook
		}
	}

	function openBulkStatusDialog() {
		setBulkStatusDate(getTodayDateInputValue());
		setBulkStatus("PAID");
		setIsBulkStatusDialogOpen(true);
	}

	function resetBulkStatusDate() {
		setBulkStatusDate(getTodayDateInputValue());
	}

	return {
		payAction,
		setPayAction,
		editingInstallment,
		setEditingInstallment,
		reversalAction,
		setReversalAction,
		reversalUndoAction,
		setReversalUndoAction,
		installmentToDelete,
		setInstallmentToDelete,
		isBulkStatusDialogOpen,
		setIsBulkStatusDialogOpen,
		bulkStatus,
		setBulkStatus,
		bulkStatusDate,
		setBulkStatusDate,
		isPaymentActionPending,
		isPreparingReversal,
		isPatchingStatus,
		isUpdatingInstallment,
		isReversingInstallment,
		isUndoingInstallmentReversal,
		isDeletingInstallment,
		requestInstallmentPayment,
		requestInstallmentEdition,
		requestInstallmentReversal,
		requestInstallmentReversalUndo,
		requestInstallmentDelete,
		handleConfirmInstallmentPayment,
		handlePayInstallmentToday,
		handleConfirmBulkStatusChange,
		handleConfirmInstallmentEdition,
		handleConfirmInstallmentReversal,
		handleConfirmInstallmentReversalUndo,
		handleConfirmInstallmentDelete,
		openBulkStatusDialog,
		resetBulkStatusDate,
	};
}
