import { useRef, useState } from "react";
import { toast } from "sonner";
import { useApp } from "@/context/app-context";
import { resolveErrorMessage } from "@/errors";
import { normalizeApiError } from "@/errors/api-error";
import {
	useDeleteSaleCommissionInstallment,
	usePatchSaleCommissionInstallmentStatus,
	useReverseSaleCommissionInstallment,
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
	CommissionInstallmentRow,
	InstallmentEditState,
	InstallmentPayAction,
	InstallmentReversalAction,
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
	const [installmentToDelete, setInstallmentToDelete] =
		useState<CommissionInstallmentRow | null>(null);
	const [isBulkPaymentDialogOpen, setIsBulkPaymentDialogOpen] = useState(false);
	const [bulkPaymentDate, setBulkPaymentDate] = useState(
		getTodayDateInputValue(),
	);
	const [isBulkPaying, setIsBulkPaying] = useState(false);
	const [isUndoingPayments, setIsUndoingPayments] = useState(false);
	const [isPreparingReversal, setIsPreparingReversal] = useState(false);
	const reversalLoadRequestIdRef = useRef(0);

	const { mutateAsync: patchInstallmentStatus, isPending: isPatchingStatus } =
		usePatchSaleCommissionInstallmentStatus();
	const { mutateAsync: updateInstallment, isPending: isUpdatingInstallment } =
		useUpdateSaleCommissionInstallment();
	const { mutateAsync: reverseInstallment, isPending: isReversingInstallment } =
		useReverseSaleCommissionInstallment();
	const { mutateAsync: deleteInstallment, isPending: isDeletingInstallment } =
		useDeleteSaleCommissionInstallment();

	const isPaymentActionPending = isBulkPaying || isUndoingPayments;

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

		if (!organization?.slug) {
			toast.error("Organização não encontrada.");
			return;
		}

		const requestId = reversalLoadRequestIdRef.current + 1;
		reversalLoadRequestIdRef.current = requestId;

		setReversalAction({
			installment,
			reversalDate: getTodayDateInputValue(),
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

				const matchedRule = rulesResponse.rules.find(
					(rule) => rule.installmentNumber === installment.installmentNumber,
				);

				if (!matchedRule) {
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
					return;
				}

				const totalPaidAmount = saleInstallmentsResponse.installments
					.filter(
						(row) =>
							row.saleCommissionId === installment.saleCommissionId &&
							row.status === "PAID" &&
							row.amount > 0,
					)
					.reduce((sum, row) => sum + row.amount, 0);
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
						!current.hasManualOverride && current.manualAmount.trim().length === 0;

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
							},
						]);
					},
				},
			});
		} catch {
			// erro tratado no hook
		}
	}

	async function processBulkPayment(
		paymentDate: string,
		closeDialogOnSuccess: boolean,
	) {
		if (!canChangeInstallmentStatus) {
			return;
		}

		if (!paymentDate) {
			toast.error("Informe a data de pagamento.");
			return;
		}

		if (selectedInstallments.length === 0) {
			if (closeDialogOnSuccess) {
				setIsBulkPaymentDialogOpen(false);
			}
			return;
		}

		setIsBulkPaying(true);

		const results = await Promise.allSettled(
			selectedInstallments.map((installment) =>
				patchInstallmentStatus({
					saleId: installment.saleId,
					installmentId: installment.id,
					status: "PAID",
					paymentDate,
					amount: installment.amount,
					silent: true,
				}),
			),
		);

		const successfulInstallments: SelectedInstallment[] = [];
		let failedCount = 0;

		for (const [index, result] of results.entries()) {
			if (result.status === "fulfilled") {
				const installment = selectedInstallments[index];
				if (installment) {
					successfulInstallments.push(installment);
				}
			} else {
				failedCount += 1;
			}
		}

		if (successfulInstallments.length > 0) {
			const successfulIds = successfulInstallments.map(
				(installment) => installment.id,
			);
			onDeselectInstallments(successfulIds);
			toast.success(`${successfulIds.length} parcela(s) marcadas como pagas.`, {
				action: {
					label: "Desfazer",
					onClick: () => {
						void undoInstallmentsPayment(successfulInstallments);
					},
				},
			});
		}

		if (failedCount > 0) {
			toast.error(`Não foi possível pagar ${failedCount} parcela(s).`);
		}

		if (failedCount === 0 && closeDialogOnSuccess) {
			setIsBulkPaymentDialogOpen(false);
		}

		setIsBulkPaying(false);
	}

	async function handleConfirmBulkPayment() {
		await processBulkPayment(bulkPaymentDate, true);
	}

	async function handlePaySelectedToday() {
		await processBulkPayment(getTodayDateInputValue(), false);
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

		const parsedManualAmount = parseManualAmountToCents(
			reversalAction.manualAmount,
		);
		if (parsedManualAmount === null) {
			toast.error("Informe um valor válido para o estorno.");
			return;
		}
		if (parsedManualAmount === 0) {
			toast.error("O valor do estorno deve ser diferente de zero.");
			return;
		}
		if (parsedManualAmount > 0) {
			toast.error("O valor do estorno deve ser negativo.");
			return;
		}

		try {
			await reverseInstallment({
				saleId: reversalAction.installment.saleId,
				installmentId: reversalAction.installment.id,
				reversalDate: reversalAction.reversalDate,
				manualAmount: parsedManualAmount,
			});
			onDeselectInstallment(reversalAction.installment.id);
			setReversalAction(null);
		} catch {
			// erro tratado no hook
		}
	}

	function openBulkPaymentDialog() {
		setBulkPaymentDate(getTodayDateInputValue());
		setIsBulkPaymentDialogOpen(true);
	}

	function resetBulkPaymentDate() {
		setBulkPaymentDate(getTodayDateInputValue());
	}

	return {
		payAction,
		setPayAction,
		editingInstallment,
		setEditingInstallment,
		reversalAction,
		setReversalAction,
		installmentToDelete,
		setInstallmentToDelete,
		isBulkPaymentDialogOpen,
		setIsBulkPaymentDialogOpen,
		bulkPaymentDate,
		setBulkPaymentDate,
		isPaymentActionPending,
		isPreparingReversal,
		isPatchingStatus,
		isUpdatingInstallment,
		isReversingInstallment,
		isDeletingInstallment,
		requestInstallmentPayment,
		requestInstallmentEdition,
		requestInstallmentReversal,
		requestInstallmentDelete,
		handleConfirmInstallmentPayment,
		handlePayInstallmentToday,
		handleConfirmBulkPayment,
		handlePaySelectedToday,
		handleConfirmInstallmentEdition,
		handleConfirmInstallmentReversal,
		handleConfirmInstallmentDelete,
		openBulkPaymentDialog,
		resetBulkPaymentDate,
	};
}
