import { format, parse } from "date-fns";
import {
	CheckCheck,
	CheckCircle2,
	MoreHorizontal,
	Pencil,
	RotateCcw,
	Trash2,
	Undo2,
} from "lucide-react";
import { useQueryState } from "nuqs";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { resolveErrorMessage } from "@/errors";
import { normalizeApiError } from "@/errors/api-error";
import { LoadingReveal } from "@/components/loading-reveal";
import { CardSectionSkeleton } from "@/components/loading-skeletons";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarDateInput } from "@/components/ui/calendar-date-input";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProductCommissionReversalRules } from "@/hooks/commissions";
import { showZeroInstallmentsParser } from "@/hooks/filters/parsers";
import { useCheckboxMultiSelect } from "@/hooks/use-checkbox-multi-select";
import {
	useDeleteSaleCommissionInstallment,
	usePatchCommissionInstallmentsStatusBulk,
	usePatchSaleCommissionInstallmentStatus,
	useReverseSaleCommissionInstallment,
	useSaleCommissionInstallments,
	useUndoSaleCommissionInstallmentReversal,
	useUpdateSaleCommissionInstallment,
} from "@/hooks/sales";
import type { GetOrganizationsSlugSalesSaleidCommissionInstallments200 } from "@/http/generated";
import { useAbility } from "@/permissions/access";
import {
	SALE_COMMISSION_DIRECTION_LABEL,
	SALE_COMMISSION_INSTALLMENT_STATUS_LABEL,
	SALE_COMMISSION_RECIPIENT_TYPE_LABEL,
	SALE_COMMISSION_SOURCE_TYPE_LABEL,
	type SaleCommissionInstallmentStatus,
	type SaleStatus,
} from "@/schemas/types/sales";
import {
	formatCurrencyBRL,
	parseBRLCurrencyToCents,
} from "@/utils/format-amount";

type SaleInstallmentRow =
	GetOrganizationsSlugSalesSaleidCommissionInstallments200["installments"][number];

type BulkInstallmentStatus = "PENDING" | "PAID" | "CANCELED";

type SelectedInstallment = {
	id: string;
	amount: number;
	status: SaleCommissionInstallmentStatus;
};

type InstallmentPayAction = {
	installment: SaleInstallmentRow;
	paymentDate: string;
	amount: string;
};

type InstallmentEditState = {
	installment: SaleInstallmentRow;
	percentage: string;
	amount: string;
	status: SaleCommissionInstallmentStatus;
	expectedPaymentDate: string | null;
	paymentDate: string;
	reversalDate: string;
};

type InstallmentReversalState = {
	installment: SaleInstallmentRow;
	reversalDate: string;
	cancelPendingInstallments: boolean;
	pendingFutureInstallmentsCount: number;
	mode: "AUTO" | "MANUAL";
	calculationStatus: "LOADING" | "READY" | "ERROR";
	calculationError: string | null;
	hasManualOverride: boolean;
	manualAmount: string;
	rulePercentage: number | null;
	totalPaidAmount: number | null;
	calculatedAmount: number | null;
};

const INSTALLMENT_STATUS_BADGE_CLASSNAME: Record<
	SaleCommissionInstallmentStatus,
	string
> = {
	PENDING:
		"bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 border-yellow-500/30",
	PAID: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
	CANCELED: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
	REVERSED: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
};

function formatDate(value?: string | null) {
	if (!value) {
		return "Sem previsão";
	}

	const dateOnly = value.slice(0, 10);
	const parsedDate = parse(dateOnly, "yyyy-MM-dd", new Date());
	return format(parsedDate, "dd/MM/yyyy");
}

function toDateInputValue(value?: string | null) {
	return value ? value.slice(0, 10) : "";
}

function getTodayDateInputValue() {
	return format(new Date(), "yyyy-MM-dd");
}

function formatCentsToDecimalInput(valueInCents: number) {
	return (valueInCents / 100).toFixed(2);
}

function formatInstallmentAmountInput(value: string, forceNegative: boolean) {
	const formattedValue = formatCurrencyBRL(value).replace(/^-/, "");

	if (!forceNegative) {
		return formattedValue;
	}

	return `-${formattedValue}`;
}

interface SaleInstallmentsPanelProps {
	saleId: string;
	saleStatus: SaleStatus;
	saleProductId: string;
	saleCommissionId?: string;
	enabled?: boolean;
}

export function SaleInstallmentsPanel({
	saleId,
	saleStatus,
	saleProductId,
	saleCommissionId,
	enabled = true,
}: SaleInstallmentsPanelProps) {
	const ability = useAbility();
	const [showZeroValueInstallments, setShowZeroValueInstallments] =
		useQueryState("showZeroInstallments", showZeroInstallmentsParser);
	const [activeBeneficiaryTab, setActiveBeneficiaryTab] = useState("");
	const [payAction, setPayAction] = useState<InstallmentPayAction | null>(null);
	const [editingInstallment, setEditingInstallment] =
		useState<InstallmentEditState | null>(null);
	const [reversalState, setReversalState] =
		useState<InstallmentReversalState | null>(null);
	const [reversalUndoInstallment, setReversalUndoInstallment] =
		useState<SaleInstallmentRow | null>(null);
	const [installmentToDelete, setInstallmentToDelete] =
		useState<SaleInstallmentRow | null>(null);
	const [selectedInstallmentsById, setSelectedInstallmentsById] = useState(
		() => new Map<string, SelectedInstallment>(),
	);
	const [isBulkStatusDialogOpen, setIsBulkStatusDialogOpen] = useState(false);
	const [bulkStatus, setBulkStatus] = useState<BulkInstallmentStatus>("PAID");
	const [bulkStatusDate, setBulkStatusDate] = useState(
		getTodayDateInputValue(),
	);
	const [isApplyingBulkStatus, setIsApplyingBulkStatus] = useState(false);

	const { data, isLoading, isError, refetch } = useSaleCommissionInstallments(
		saleId,
		{ enabled },
	);
	const { mutateAsync: patchInstallmentStatus, isPending: isPatchingStatus } =
		usePatchSaleCommissionInstallmentStatus();
	const { mutateAsync: updateInstallment, isPending: isUpdatingInstallment } =
		useUpdateSaleCommissionInstallment();
	const { mutateAsync: reverseInstallment, isPending: isReversingInstallment } =
		useReverseSaleCommissionInstallment();
	const {
		mutateAsync: undoInstallmentReversal,
		isPending: isUndoingInstallmentReversal,
	} = useUndoSaleCommissionInstallmentReversal();
	const {
		mutateAsync: patchInstallmentsStatusBulk,
		isPending: isPatchingBulkStatus,
	} = usePatchCommissionInstallmentsStatusBulk();
	const { mutateAsync: deleteInstallment, isPending: isDeletingInstallment } =
		useDeleteSaleCommissionInstallment();
	const {
		data: productReversalRulesData,
		isLoading: isLoadingProductReversalRules,
		isError: isProductReversalRulesError,
	} = useProductCommissionReversalRules(saleProductId, {
		enabled: enabled && Boolean(saleProductId),
		includeInherited: true,
	});

	const canChangeInstallmentStatus = ability.can(
		"access",
		"sales.commissions.installments.status.change",
	);
	const canEditInstallment = ability.can(
		"access",
		"sales.commissions.installments.update",
	);
	const canDeleteInstallment = ability.can(
		"access",
		"sales.commissions.installments.delete",
	);
	const canEditInstallmentsBySaleStatus =
		saleStatus === "PENDING" || saleStatus === "COMPLETED";
	const canChangeInstallmentStatusBySaleStatus = saleStatus === "COMPLETED";
	const installments = useMemo(
		() => data?.installments ?? [],
		[data?.installments],
	);
	const filteredInstallments = useMemo(
		() =>
			saleCommissionId
				? installments.filter(
						(installment) => installment.saleCommissionId === saleCommissionId,
					)
				: installments,
		[installments, saleCommissionId],
	);
	const reversalAmountByOriginInstallmentId = useMemo(() => {
		const map = new Map<string, number>();

		for (const installment of filteredInstallments) {
			if (!installment.originInstallmentId) {
				continue;
			}

			map.set(
				installment.originInstallmentId,
				(map.get(installment.originInstallmentId) ?? 0) + installment.amount,
			);
		}

		return map;
	}, [filteredInstallments]);

	function resolveDisplayInstallmentAmount(installment: SaleInstallmentRow) {
		if (installment.originInstallmentId) {
			return installment.amount;
		}

		const totalReversedAmount =
			reversalAmountByOriginInstallmentId.get(installment.id) ?? 0;
		return installment.amount + totalReversedAmount;
	}
	const summary = useMemo(
		() => ({
			total: filteredInstallments.length,
			paid: filteredInstallments.filter(
				(installment) => installment.status === "PAID",
			).length,
			pending: filteredInstallments.filter(
				(installment) => installment.status === "PENDING",
			).length,
			canceled: filteredInstallments.filter(
				(installment) => installment.status === "CANCELED",
			).length,
			reversed: filteredInstallments.filter(
				(installment) => installment.status === "REVERSED",
			).length,
		}),
		[filteredInstallments],
	);

	const visibleInstallments = useMemo(
		() =>
			showZeroValueInstallments
				? filteredInstallments
				: filteredInstallments.filter(
						(installment) => installment.amount !== 0,
					),
		[filteredInstallments, showZeroValueInstallments],
	);
	const installmentsByBeneficiary = useMemo(() => {
		const map = new Map<
			string,
			{ key: string; label: string; installments: SaleInstallmentRow[] }
		>();

		for (const installment of visibleInstallments) {
			const beneficiaryLabel =
				installment.beneficiaryLabel ??
				SALE_COMMISSION_RECIPIENT_TYPE_LABEL[installment.recipientType];
			const group = map.get(installment.beneficiaryKey);

			if (!group) {
				map.set(installment.beneficiaryKey, {
					key: installment.beneficiaryKey,
					label: beneficiaryLabel,
					installments: [installment],
				});
				continue;
			}

			group.installments.push(installment);
		}

		return Array.from(map.values());
	}, [visibleInstallments]);
	const activeBeneficiaryTabValue = useMemo(() => {
		if (installmentsByBeneficiary.length === 0) {
			return "";
		}

		if (
			activeBeneficiaryTab &&
			installmentsByBeneficiary.some(
				(group) => group.key === activeBeneficiaryTab,
			)
		) {
			return activeBeneficiaryTab;
		}

		return installmentsByBeneficiary[0]?.key ?? "";
	}, [activeBeneficiaryTab, installmentsByBeneficiary]);
	const canBulkStatusInstallments =
		canChangeInstallmentStatusBySaleStatus && canChangeInstallmentStatus;
	const selectableInstallmentIds = useMemo(() => {
		if (!canBulkStatusInstallments) {
			return new Set<string>();
		}

		return new Set(
			visibleInstallments
				.filter((installment) => installment.status !== "REVERSED")
				.map((installment) => installment.id),
		);
	}, [canBulkStatusInstallments, visibleInstallments]);
	const visibleInstallmentsById = useMemo(
		() =>
			new Map(
				visibleInstallments.map((installment) => [installment.id, installment]),
			),
		[visibleInstallments],
	);
	const selectedInstallments = useMemo(
		() => Array.from(selectedInstallmentsById.values()),
		[selectedInstallmentsById],
	);
	const selectedInstallmentsTotalAmount = useMemo(
		() =>
			selectedInstallments.reduce(
				(sum, installment) => sum + installment.amount,
				0,
			),
		[selectedInstallments],
	);
	const activeGroupInstallments = useMemo(
		() =>
			installmentsByBeneficiary.find(
				(group) => group.key === activeBeneficiaryTabValue,
			)?.installments ?? [],
		[activeBeneficiaryTabValue, installmentsByBeneficiary],
	);
	const installmentsMultiSelect = useCheckboxMultiSelect<string>({
		visibleIds: activeGroupInstallments.map((installment) => installment.id),
		isSelectable: (installmentId) =>
			selectableInstallmentIds.has(installmentId),
		toggleOne: handleInstallmentCheckedChange,
		toggleMany: toggleVisibleInstallments,
		onClearSelection: clearSelectedInstallments,
		enabled: canBulkStatusInstallments,
	});
	const productReversalRules = productReversalRulesData?.rules ?? [];
	const productReversalMode = productReversalRulesData?.mode ?? null;
	const productReversalTotalPercentage =
		productReversalRulesData?.totalPaidPercentage ?? null;
	const parsedReversalAmount = reversalState?.manualAmount.trim().length
		? Number(reversalState.manualAmount.replace(",", ".").trim())
		: Number.NaN;
	const isReversalAmountInvalid =
		!Number.isFinite(parsedReversalAmount) || parsedReversalAmount === 0;
	const shouldForceNegativeEditAmount =
		editingInstallment?.status === "REVERSED";
	useEffect(() => {
		setSelectedInstallmentsById((current) => {
			if (current.size === 0) {
				return current;
			}

			let hasChanges = false;
			const next = new Map<string, SelectedInstallment>();

			for (const [installmentId, selectedInstallment] of current) {
				const installment = visibleInstallmentsById.get(installmentId);
				if (!installment || !selectableInstallmentIds.has(installmentId)) {
					hasChanges = true;
					continue;
				}

				const nextSelectedInstallment: SelectedInstallment = {
					id: installmentId,
					amount: installment.amount,
					status: installment.status,
				};
				if (
					selectedInstallment.amount !== nextSelectedInstallment.amount ||
					selectedInstallment.status !== nextSelectedInstallment.status
				) {
					hasChanges = true;
				}

				next.set(installmentId, nextSelectedInstallment);
			}

			if (!hasChanges && next.size === current.size) {
				return current;
			}

			return next;
		});
	}, [selectableInstallmentIds, visibleInstallmentsById]);

	function clearSelectedInstallments() {
		setSelectedInstallmentsById(new Map());
	}

	function toggleInstallmentSelection(
		installment: SaleInstallmentRow,
		checked: boolean,
	) {
		if (
			!canBulkStatusInstallments ||
			!selectableInstallmentIds.has(installment.id)
		) {
			return;
		}

		setSelectedInstallmentsById((current) => {
			const next = new Map(current);

			if (checked) {
				next.set(installment.id, {
					id: installment.id,
					amount: installment.amount,
					status: installment.status,
				});
			} else {
				next.delete(installment.id);
			}

			return next;
		});
	}

	function handleInstallmentCheckedChange(
		installmentId: string,
		checked: boolean,
	) {
		const installment = visibleInstallmentsById.get(installmentId);
		if (!installment) {
			return;
		}

		toggleInstallmentSelection(installment, checked);
	}

	function toggleVisibleInstallments(
		installmentIds: string[],
		checked: boolean,
	) {
		if (!canBulkStatusInstallments) {
			return;
		}

		setSelectedInstallmentsById((current) => {
			const next = new Map(current);

			for (const installmentId of installmentIds) {
				const installment = visibleInstallmentsById.get(installmentId);
				if (!installment || !selectableInstallmentIds.has(installmentId)) {
					continue;
				}

				if (checked) {
					next.set(installment.id, {
						id: installment.id,
						amount: installment.amount,
						status: installment.status,
					});
				} else {
					next.delete(installment.id);
				}
			}

			return next;
		});
	}

	function toggleGroupSelection(
		groupInstallments: SaleInstallmentRow[],
		checked: boolean,
	) {
		toggleVisibleInstallments(
			groupInstallments.map((installment) => installment.id),
			checked,
		);
	}

	function requestInstallmentPayment(installment: SaleInstallmentRow) {
		setPayAction({
			installment,
			paymentDate:
				toDateInputValue(installment.paymentDate) || getTodayDateInputValue(),
			amount: formatCurrencyBRL(installment.amount / 100),
		});
	}

	function requestInstallmentReversal(installment: SaleInstallmentRow) {
		if (
			!canChangeInstallmentStatus ||
			!canChangeInstallmentStatusBySaleStatus
		) {
			return;
		}
		if (installment.originInstallmentId) {
			toast.error(
				"Selecione uma parcela base para estornar. Movimentos de estorno não podem ser estornados novamente.",
			);
			return;
		}

		const pendingFutureInstallmentsCount = filteredInstallments.filter(
			(row) =>
				row.saleCommissionId === installment.saleCommissionId &&
				row.installmentNumber > installment.installmentNumber &&
				row.status === "PENDING",
		).length;

		setReversalState({
			installment,
			reversalDate: getTodayDateInputValue(),
			cancelPendingInstallments: pendingFutureInstallmentsCount > 0,
			pendingFutureInstallmentsCount,
			mode: "MANUAL",
			calculationStatus: "LOADING",
			calculationError: null,
			hasManualOverride: false,
			manualAmount: "",
			rulePercentage: null,
			totalPaidAmount: null,
			calculatedAmount: null,
		});
	}

	function requestInstallmentReversalUndo(installment: SaleInstallmentRow) {
		if (
			!canChangeInstallmentStatus ||
			!canChangeInstallmentStatusBySaleStatus
		) {
			return;
		}

		setReversalUndoInstallment(installment);
	}

	function openBulkStatusDialog() {
		if (!canBulkStatusInstallments || selectedInstallments.length === 0) {
			return;
		}

		setBulkStatusDate(getTodayDateInputValue());
		setIsBulkStatusDialogOpen(true);
	}

	useEffect(() => {
		if (!reversalState || reversalState.calculationStatus !== "LOADING") {
			return;
		}

		if (isLoadingProductReversalRules) {
			return;
		}

		if (isProductReversalRulesError) {
			setReversalState((current) =>
				current
					? {
							...current,
							mode: "MANUAL",
							calculationStatus: "ERROR",
							calculationError:
								"Não foi possível carregar as regras de estorno do produto.",
						}
					: current,
			);
			return;
		}

		const totalPaidAmount = filteredInstallments
			.filter(
				(row) =>
					row.saleCommissionId === reversalState.installment.saleCommissionId &&
					row.status === "PAID" &&
					row.amount > 0,
			)
			.reduce((sum, row) => sum + row.amount, 0);

		if (
			productReversalMode === "TOTAL_PAID_PERCENTAGE" &&
			productReversalTotalPercentage !== null
		) {
			const calculatedAmount = -Math.round(
				(totalPaidAmount * productReversalTotalPercentage) / 100,
			);

			setReversalState((current) => {
				if (!current) {
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
					rulePercentage: productReversalTotalPercentage,
					totalPaidAmount,
					calculatedAmount,
				};
			});
			return;
		}

		const matchedRule = productReversalRules.find(
			(rule) =>
				rule.installmentNumber === reversalState.installment.installmentNumber,
		);

		if (matchedRule) {
			const calculatedAmount = -Math.round(
				(totalPaidAmount * matchedRule.percentage) / 100,
			);

			setReversalState((current) => {
				if (!current) {
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

		setReversalState((current) =>
			current
				? {
						...current,
						mode: "MANUAL",
						calculationStatus: "READY",
						calculationError: null,
						rulePercentage: null,
						totalPaidAmount: null,
						calculatedAmount: null,
					}
				: current,
		);
	}, [
		filteredInstallments,
		isLoadingProductReversalRules,
		isProductReversalRulesError,
		productReversalMode,
		productReversalRules,
		productReversalTotalPercentage,
		reversalState,
	]);

	function requestInstallmentEdition(installment: SaleInstallmentRow) {
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

	async function handleConfirmInstallmentPayment() {
		if (!payAction) {
			return;
		}

		if (!payAction.paymentDate) {
			toast.error("Informe a data de pagamento.");
			return;
		}

		try {
			await patchInstallmentStatus({
				saleId,
				installmentId: payAction.installment.id,
				status: "PAID",
				amount: parseBRLCurrencyToCents(payAction.amount),
				paymentDate: payAction.paymentDate || undefined,
			});
			setPayAction(null);
		} catch {
			// erro tratado no hook
		}
	}

	async function handlePayInstallmentToday(installment: SaleInstallmentRow) {
		try {
			await patchInstallmentStatus({
				saleId,
				installmentId: installment.id,
				status: "PAID",
				paymentDate: getTodayDateInputValue(),
				amount: installment.amount,
			});
		} catch {
			// erro tratado no hook
		}
	}

	async function handleConfirmBulkStatusChange() {
		if (!canBulkStatusInstallments) {
			return;
		}

		if (selectedInstallments.length === 0) {
			setIsBulkStatusDialogOpen(false);
			return;
		}

		if (
			(bulkStatus === "PAID" || bulkStatus === "CANCELED") &&
			!bulkStatusDate
		) {
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
				installmentIds: selectedInstallments.map(
					(installment) => installment.id,
				),
				saleIds: [saleId],
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
				setSelectedInstallmentsById((current) => {
					const next = new Map(current);

					for (const installmentId of updatedIds) {
						next.delete(installmentId);
					}

					return next;
				});
				toast.success(`${updatedIds.length} parcela(s) atualizada(s).`);
			}

			if (response.skipped.length > 0) {
				toast.warning(
					`${response.skipped.length} parcela(s) não puderam ser atualizadas.`,
				);
			}
			if (updatedIds.length === 0 && response.skipped.length === 0) {
				toast.info("Nenhuma parcela foi atualizada.");
			}

			setIsBulkStatusDialogOpen(false);
		} catch (error) {
			toast.error(resolveErrorMessage(normalizeApiError(error)));
		} finally {
			setIsApplyingBulkStatus(false);
		}
	}

	async function handleConfirmInstallmentEdition() {
		if (!editingInstallment) {
			return;
		}

		const parsedPercentage = Number(
			editingInstallment.percentage.replace(",", "."),
		);
		if (Number.isNaN(parsedPercentage)) {
			toast.error("Informe um percentual válido.");
			return;
		}

		if (
			editingInstallment.status === "CANCELED" &&
			!editingInstallment.reversalDate
		) {
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
				saleId,
				installmentId: editingInstallment.installment.id,
				data: {
					percentage: parsedPercentage,
					amount: parsedAmount,
					...(saleStatus === "PENDING"
						? {}
						: { status: editingInstallment.status }),
					expectedPaymentDate:
						editingInstallment.expectedPaymentDate || null,
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
		if (!installmentToDelete) {
			return;
		}

		try {
			await deleteInstallment({
				saleId,
				installmentId: installmentToDelete.id,
			});
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
		if (!reversalState) {
			return;
		}

		if (!reversalState.reversalDate) {
			toast.error("Informe a data do estorno.");
			return;
		}

		const shouldSendManualAmount =
			reversalState.mode === "MANUAL" || reversalState.hasManualOverride;
		let parsedManualAmount: number | undefined;

		if (shouldSendManualAmount) {
			const parsedAmount = parseManualAmountToCents(reversalState.manualAmount);
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
				saleId,
				installmentId: reversalState.installment.id,
				reversalDate: reversalState.reversalDate,
				cancelPendingInstallments: reversalState.cancelPendingInstallments,
			};

			if (parsedManualAmount !== undefined) {
				payload.manualAmount = parsedManualAmount;
			}

			await reverseInstallment({
				...payload,
			});
			setReversalState(null);
		} catch {
			// erro tratado no hook
		}
	}

	async function handleConfirmInstallmentReversalUndo() {
		if (!reversalUndoInstallment) {
			return;
		}

		try {
			await undoInstallmentReversal({
				saleId,
				installmentId: reversalUndoInstallment.id,
			});
			setReversalUndoInstallment(null);
		} catch {
			// erro tratado no hook
		}
	}

	const isBulkStatusPending = isApplyingBulkStatus || isPatchingBulkStatus;
	const isAnyInstallmentActionPending =
		isPatchingStatus ||
		isBulkStatusPending ||
		isUpdatingInstallment ||
		isReversingInstallment ||
		isUndoingInstallmentReversal ||
		isDeletingInstallment;

	return (
		<>
			<div className="space-y-4">
				<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
					<p className="text-sm text-muted-foreground">
						Resumo: {summary.paid}/{summary.total} pagas, {summary.pending}{" "}
						pendentes, {summary.canceled} canceladas, {summary.reversed}{" "}
						estornadas.
					</p>
					<div className="flex items-center gap-2">
						<Switch
							id="show-zero-installments"
							checked={showZeroValueInstallments}
							onCheckedChange={setShowZeroValueInstallments}
						/>
						<label
							htmlFor="show-zero-installments"
							className="text-sm text-muted-foreground"
						>
							Mostrar parcelas zeradas
						</label>
					</div>
				</div>

				{canBulkStatusInstallments && selectedInstallments.length > 0 ? (
					<div className="flex flex-col gap-3 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-4 md:flex-row md:items-center md:justify-between">
						<p className="text-sm text-emerald-700 dark:text-emerald-300">
							{selectedInstallments.length} parcela(s) selecionada(s) · total{" "}
							{formatCurrencyBRL(selectedInstallmentsTotalAmount / 100)}
						</p>
						<Button
							type="button"
							disabled={isAnyInstallmentActionPending}
							onClick={openBulkStatusDialog}
						>
							Alterar status em lote
						</Button>
					</div>
				) : null}

				{isError ? (
					<div className="space-y-3">
						<p className="text-sm text-destructive">
							Não foi possível carregar as parcelas da comissão.
						</p>
						<Button
							type="button"
							variant="outline"
							className="w-fit"
							onClick={() => refetch()}
						>
							Tentar novamente
						</Button>
					</div>
				) : (
					<LoadingReveal
						loading={isLoading}
						skeleton={
							<CardSectionSkeleton
								rows={5}
								cardClassName="border-dashed p-4 shadow-none"
							/>
						}
						contentKey={saleCommissionId ?? saleId}
					>
						{filteredInstallments.length === 0 ? (
							<p className="text-sm text-muted-foreground">
								{saleCommissionId
									? "Sem parcelas para esta comissão."
									: "Sem parcelas de comissão vinculadas nesta venda."}
							</p>
						) : installmentsByBeneficiary.length === 0 ? (
							<p className="text-sm text-muted-foreground">
								Nenhuma parcela encontrada para o filtro atual.
							</p>
						) : (
							<Tabs
								value={activeBeneficiaryTabValue}
								onValueChange={setActiveBeneficiaryTab}
							>
								<TabsList className="w-full justify-start overflow-x-auto rounded-sm">
									{installmentsByBeneficiary.map((group) => (
										<TabsTrigger key={group.key} value={group.key}>
											{group.label}
										</TabsTrigger>
									))}
								</TabsList>

								{installmentsByBeneficiary.map((group) => {
									const selectableInstallmentsInGroup =
										group.installments.filter((installment) =>
											selectableInstallmentIds.has(installment.id),
										);
									const allGroupSelected =
										selectableInstallmentsInGroup.length > 0 &&
										selectableInstallmentsInGroup.every((installment) =>
											selectedInstallmentsById.has(installment.id),
										);
									const someGroupSelected =
										!allGroupSelected &&
										selectableInstallmentsInGroup.some((installment) =>
											selectedInstallmentsById.has(installment.id),
										);

									return (
										<TabsContent
											key={group.key}
											value={group.key}
											className="pt-2"
										>
											<div className="rounded-md border overflow-hidden">
												<Table>
													<TableHeader>
														<TableRow>
															<TableHead className="w-[42px]">
																<Checkbox
																	checked={
																		allGroupSelected
																			? true
																			: someGroupSelected
																				? "indeterminate"
																				: false
																	}
																	onCheckedChange={(checked) =>
																		toggleGroupSelection(
																			group.installments,
																			Boolean(checked),
																		)
																	}
																	disabled={
																		selectableInstallmentsInGroup.length ===
																			0 || isAnyInstallmentActionPending
																	}
																	aria-label={`Selecionar parcelas do beneficiário ${group.label}`}
																/>
															</TableHead>
															<TableHead>Parcela</TableHead>
															<TableHead>%</TableHead>
															<TableHead>Valor</TableHead>
															<TableHead>Status</TableHead>
															<TableHead>Previsão</TableHead>
															<TableHead>Pagamento</TableHead>
															<TableHead>Direção</TableHead>
															<TableHead>Origem</TableHead>
															<TableHead className="w-[90px] text-right">
																Ações
															</TableHead>
														</TableRow>
													</TableHeader>
													<TableBody>
														{group.installments.map((installment) => {
															const isReversalMovement = Boolean(
																installment.originInstallmentId,
															);
															const isSelected = selectedInstallmentsById.has(
																installment.id,
															);
															const canBulkStatusInstallment =
																selectableInstallmentIds.has(installment.id);
															const displayAmount =
																resolveDisplayInstallmentAmount(installment);
															const hasLinkedReversal =
																!isReversalMovement &&
																displayAmount !== installment.amount;
															const canPayRowAction =
																canChangeInstallmentStatusBySaleStatus &&
																canChangeInstallmentStatus &&
																installment.status === "PENDING";
															const canEditRowAction =
																canEditInstallmentsBySaleStatus &&
																canEditInstallment;
															const canDeleteRowAction =
																canChangeInstallmentStatusBySaleStatus &&
																canDeleteInstallment;
															const canReverseRowAction =
																canChangeInstallmentStatusBySaleStatus &&
																canChangeInstallmentStatus &&
																!isReversalMovement &&
																(installment.status === "PENDING" ||
																	installment.status === "PAID");
															const canUndoReversalRowAction =
																canChangeInstallmentStatusBySaleStatus &&
																canChangeInstallmentStatus &&
																installment.status === "REVERSED";
															const canOpenRowActions =
																canPayRowAction ||
																canEditRowAction ||
																canDeleteRowAction ||
																canReverseRowAction ||
																canUndoReversalRowAction;

															return (
																<TableRow key={installment.id}>
																	<TableCell>
																		<Checkbox
																			checked={isSelected}
																			onClick={(event) =>
																				installmentsMultiSelect.onCheckboxClick(
																					installment.id,
																					event,
																				)
																			}
																			onCheckedChange={(checked) =>
																				installmentsMultiSelect.onCheckboxCheckedChange(
																					installment.id,
																					Boolean(checked),
																				)
																			}
																			disabled={
																				!canBulkStatusInstallment ||
																				isAnyInstallmentActionPending
																			}
																			aria-label={`Selecionar parcela ${installment.installmentNumber}`}
																		/>
																	</TableCell>
																	<TableCell>
																		P{installment.installmentNumber}
																	</TableCell>
																	<TableCell>
																		{installment.percentage}%
																	</TableCell>
																	<TableCell>
																		<p>
																			{formatCurrencyBRL(displayAmount / 100)}
																		</p>
																		{hasLinkedReversal ? (
																			<p className="text-xs text-muted-foreground">
																				Valor base:{" "}
																				{formatCurrencyBRL(
																					installment.amount / 100,
																				)}
																			</p>
																		) : null}
																	</TableCell>
																	<TableCell>
																		<Badge
																			variant="outline"
																			className={
																				INSTALLMENT_STATUS_BADGE_CLASSNAME[
																					installment.status
																				]
																			}
																		>
																			{
																				SALE_COMMISSION_INSTALLMENT_STATUS_LABEL[
																					installment.status
																				]
																			}
																		</Badge>
																	</TableCell>
																	<TableCell>
																		{formatDate(
																			installment.expectedPaymentDate,
																		)}
																	</TableCell>
																	<TableCell>
																		{(installment.status === "PAID" ||
																			installment.status === "REVERSED") &&
																		installment.paymentDate
																			? formatDate(installment.paymentDate)
																			: "—"}
																	</TableCell>
																	<TableCell>
																		{
																			SALE_COMMISSION_DIRECTION_LABEL[
																				installment.direction
																			]
																		}
																	</TableCell>
																	<TableCell>
																		{
																			SALE_COMMISSION_SOURCE_TYPE_LABEL[
																				installment.sourceType
																			]
																		}
																		{isReversalMovement ? (
																			<p className="text-xs text-muted-foreground">
																				Estorno da parcela P
																				{installment.originInstallmentNumber ??
																					installment.installmentNumber}
																			</p>
																		) : null}
																	</TableCell>
																	<TableCell className="text-right">
																		{canOpenRowActions ? (
																			<DropdownMenu>
																				<DropdownMenuTrigger asChild>
																					<Button
																						type="button"
																						variant="ghost"
																						size="icon"
																						disabled={
																							isAnyInstallmentActionPending
																						}
																					>
																						<MoreHorizontal className="size-4" />
																					</Button>
																				</DropdownMenuTrigger>
																				<DropdownMenuContent align="end">
																					{canPayRowAction ? (
																						<DropdownMenuItem
																							onSelect={(event) => {
																								event.preventDefault();
																								requestInstallmentPayment(
																									installment,
																								);
																							}}
																						>
																							<CheckCircle2 className="size-4" />
																							Pagar parcela
																						</DropdownMenuItem>
																					) : null}
																					{canPayRowAction ? (
																						<DropdownMenuItem
																							onSelect={(event) => {
																								event.preventDefault();
																								void handlePayInstallmentToday(
																									installment,
																								);
																							}}
																						>
																							<CheckCheck className="size-4" />
																							Pagar hoje
																						</DropdownMenuItem>
																					) : null}
																					{canPayRowAction &&
																					(canEditRowAction ||
																						canDeleteRowAction ||
																						canReverseRowAction ||
																						canUndoReversalRowAction) ? (
																						<DropdownMenuSeparator />
																					) : null}
																					{canEditRowAction ? (
																						<DropdownMenuItem
																							onSelect={(event) => {
																								event.preventDefault();
																								requestInstallmentEdition(
																									installment,
																								);
																							}}
																						>
																							<Pencil className="size-4" />
																							Editar parcela
																						</DropdownMenuItem>
																					) : null}
																					{canReverseRowAction ? (
																						<DropdownMenuItem
																							onSelect={(event) => {
																								event.preventDefault();
																								requestInstallmentReversal(
																									installment,
																								);
																							}}
																						>
																							<Undo2 className="size-4" />
																							Estornar parcela
																						</DropdownMenuItem>
																					) : null}
																					{canUndoReversalRowAction ? (
																						<DropdownMenuItem
																							onSelect={(event) => {
																								event.preventDefault();
																								requestInstallmentReversalUndo(
																									installment,
																								);
																							}}
																						>
																							<RotateCcw className="size-4" />
																							Reverter estorno
																						</DropdownMenuItem>
																					) : null}
																					{canDeleteRowAction ? (
																						<DropdownMenuItem
																							variant="destructive"
																							onSelect={(event) => {
																								event.preventDefault();
																								setInstallmentToDelete(
																									installment,
																								);
																							}}
																						>
																							<Trash2 className="size-4" />
																							Excluir parcela
																						</DropdownMenuItem>
																					) : null}
																				</DropdownMenuContent>
																			</DropdownMenu>
																		) : (
																			<span className="text-xs text-muted-foreground">
																				—
																			</span>
																		)}
																	</TableCell>
																</TableRow>
															);
														})}
													</TableBody>
												</Table>
											</div>
										</TabsContent>
									);
								})}
							</Tabs>
						)}
					</LoadingReveal>
				)}
			</div>

			<Dialog
				open={isBulkStatusDialogOpen}
				onOpenChange={(open) => {
					setIsBulkStatusDialogOpen(open);
					if (open) {
						setBulkStatusDate(getTodayDateInputValue());
					}
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Alterar status em lote</DialogTitle>
						<DialogDescription>
							Atualize o status de {selectedInstallments.length} parcela(s)
							selecionada(s).
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-3">
						<p className="text-sm text-muted-foreground">
							Total selecionado:{" "}
							{formatCurrencyBRL(selectedInstallmentsTotalAmount / 100)}
						</p>
						<div className="space-y-1">
							<p className="text-sm font-medium">Novo status</p>
							<Select
								value={bulkStatus}
								onValueChange={(value) =>
									setBulkStatus(value as BulkInstallmentStatus)
								}
							>
								<SelectTrigger className="w-full">
									<SelectValue placeholder="Selecione o status" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="PENDING">Pendente</SelectItem>
									<SelectItem value="PAID">Paga</SelectItem>
									<SelectItem value="CANCELED">Cancelada</SelectItem>
								</SelectContent>
							</Select>
						</div>

						{bulkStatus === "PAID" || bulkStatus === "CANCELED" ? (
							<div className="space-y-1">
								<p className="text-sm font-medium">
									{bulkStatus === "PAID"
										? "Data de pagamento"
										: "Data de cancelamento"}
								</p>
								<CalendarDateInput
									value={bulkStatusDate}
									onChange={setBulkStatusDate}
								/>
							</div>
						) : null}
					</div>

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => setIsBulkStatusDialogOpen(false)}
							disabled={isBulkStatusPending}
						>
							Cancelar
						</Button>
						<Button
							type="button"
							onClick={handleConfirmBulkStatusChange}
							disabled={
								isBulkStatusPending ||
								selectedInstallments.length === 0 ||
								!canBulkStatusInstallments
							}
						>
							{isBulkStatusPending ? "Salvando..." : "Confirmar alteração"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<AlertDialog
				open={Boolean(payAction)}
				onOpenChange={(open) => {
					if (!open) {
						setPayAction(null);
					}
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Marcar parcela como paga</AlertDialogTitle>
						<AlertDialogDescription>
							Confirmar pagamento da parcela{" "}
							{payAction ? `P${payAction.installment.installmentNumber}` : ""}?
						</AlertDialogDescription>
					</AlertDialogHeader>

					<div className="space-y-3">
						<div className="space-y-1">
							<p className="text-sm font-medium">Valor da parcela</p>
							<Input
								placeholder="R$ 0,00"
								value={payAction?.amount ?? ""}
								onChange={(event) => {
									setPayAction((current) =>
										current
											? {
													...current,
													amount: formatCurrencyBRL(event.target.value),
												}
											: current,
									);
								}}
							/>
						</div>

						<div className="space-y-1">
							<p className="text-sm font-medium">Data de pagamento</p>
							<CalendarDateInput
								value={payAction?.paymentDate ?? ""}
								onChange={(value) => {
									setPayAction((current) =>
										current
											? {
													...current,
													paymentDate: value,
												}
											: current,
									);
								}}
							/>
						</div>
					</div>

					<AlertDialogFooter>
						<AlertDialogCancel disabled={isPatchingStatus}>
							Cancelar
						</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleConfirmInstallmentPayment}
							disabled={isPatchingStatus}
						>
							{isPatchingStatus ? "Salvando..." : "Confirmar pagamento"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			<AlertDialog
				open={Boolean(reversalUndoInstallment)}
				onOpenChange={(open) => {
					if (!open) {
						setReversalUndoInstallment(null);
					}
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Reverter estorno</AlertDialogTitle>
						<AlertDialogDescription>
							Confirmar a reversão do estorno da parcela{" "}
							{reversalUndoInstallment
								? `P${reversalUndoInstallment.installmentNumber}`
								: ""}
							?{" "}
							{reversalUndoInstallment?.originInstallmentId
								? "O sistema vai remover este movimento e restaurar parcelas canceladas automaticamente, quando houver."
								: "O sistema vai restaurar status, valor e data originais."}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={isUndoingInstallmentReversal}>
							Cancelar
						</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleConfirmInstallmentReversalUndo}
							disabled={isUndoingInstallmentReversal}
						>
							{isUndoingInstallmentReversal
								? "Revertendo..."
								: "Confirmar reversão"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			<Dialog
				open={Boolean(reversalState)}
				onOpenChange={(open) => {
					if (!open) {
						setReversalState(null);
					}
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Estornar parcela</DialogTitle>
						<DialogDescription>
							Confirme o estorno da parcela{" "}
							{reversalState
								? `P${reversalState.installment.installmentNumber}`
								: ""}
							.
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4">
						<div className="space-y-1">
							<p className="text-sm font-medium">Data do estorno</p>
							<CalendarDateInput
								value={reversalState?.reversalDate ?? ""}
								onChange={(value) => {
									setReversalState((current) =>
										current
											? {
													...current,
													reversalDate: value,
												}
											: current,
									);
								}}
							/>
						</div>

						{(reversalState?.pendingFutureInstallmentsCount ?? 0) > 0 ? (
							<div className="flex items-start gap-3 rounded-md border p-3">
								<Checkbox
									checked={reversalState?.cancelPendingInstallments ?? false}
									aria-label="Cancelar parcelas pendentes seguintes"
									onCheckedChange={(checked) => {
										setReversalState((current) =>
											current
												? {
														...current,
														cancelPendingInstallments: Boolean(checked),
													}
												: current,
										);
									}}
								/>
								<div className="space-y-1">
									<p className="text-sm font-medium">
										Cancelar parcelas pendentes seguintes
									</p>
									<p className="text-xs text-muted-foreground">
										{reversalState?.pendingFutureInstallmentsCount} parcela(s)
										pendente(s) futura(s) da mesma comissão serão cancelada(s).
									</p>
								</div>
							</div>
						) : null}

						{reversalState?.calculationStatus === "LOADING" ? (
							<div className="space-y-2 rounded-md border p-3">
								<p className="text-sm font-medium">
									Calculando regra automática...
								</p>
								<div className="h-3 w-4/5 animate-pulse rounded bg-muted" />
								<div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
							</div>
						) : null}

						{reversalState?.calculationStatus === "ERROR" ? (
							<div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3">
								<p className="text-sm font-medium text-amber-700 dark:text-amber-300">
									Não foi possível calcular automaticamente.
								</p>
								<p className="text-xs text-amber-700 dark:text-amber-300">
									{reversalState.calculationError ??
										"Preencha o valor manualmente para continuar."}
								</p>
							</div>
						) : null}

						{reversalState?.mode === "AUTO" ? (
							<div className="space-y-2 rounded-md border p-3">
								<p className="text-sm font-medium">
									Regra automática do produto
								</p>
								<p className="text-sm text-muted-foreground">
									Parcela {reversalState.installment.installmentNumber}:{" "}
									{reversalState.rulePercentage ?? 0}% sobre o total pago
									positivo acumulado.
								</p>
								<p className="text-sm text-muted-foreground">
									Total pago positivo:{" "}
									{formatCurrencyBRL(
										(reversalState.totalPaidAmount ?? 0) / 100,
									)}
								</p>
								<p className="text-sm font-medium">
									Valor do estorno:{" "}
									{formatCurrencyBRL(
										(reversalState.calculatedAmount ?? 0) / 100,
									)}
								</p>
								{(reversalState.calculatedAmount ?? 0) === 0 ? (
									<p className="text-destructive text-xs">
										O valor sugerido ficou zerado. Ajuste o valor para
										continuar.
									</p>
								) : null}
							</div>
						) : null}

						<div className="space-y-1">
							<p className="text-sm font-medium">Valor do estorno (R$)</p>
							<Input
								type="number"
								step="0.01"
								placeholder={
									reversalState?.calculationStatus === "LOADING"
										? "Carregando valor sugerido..."
										: "-130.00"
								}
								value={reversalState?.manualAmount ?? ""}
								onChange={(event) => {
									setReversalState((current) =>
										current
											? {
													...current,
													hasManualOverride: true,
													manualAmount: event.target.value,
												}
											: current,
									);
								}}
							/>
							{reversalState?.calculationStatus === "LOADING" &&
							!reversalState.manualAmount ? (
								<div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
							) : null}
							<p className="text-muted-foreground text-xs">
								Informe um valor negativo para estorno (ex.: -130.00).
							</p>
						</div>
					</div>

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => setReversalState(null)}
							disabled={isReversingInstallment}
						>
							Cancelar
						</Button>
						<Button
							type="button"
							onClick={handleConfirmInstallmentReversal}
							disabled={isReversingInstallment || isReversalAmountInvalid}
						>
							{isReversingInstallment ? "Estornando..." : "Confirmar estorno"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog
				open={Boolean(editingInstallment)}
				onOpenChange={(open) => {
					if (!open) {
						setEditingInstallment(null);
					}
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Editar parcela</DialogTitle>
						<DialogDescription>
							{saleStatus === "PENDING"
								? "Ajuste percentual, valor e datas da parcela. O status permanece bloqueado enquanto a venda estiver pendente."
								: "Ajuste percentual, valor, status e datas da parcela."}
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4">
						<div className="grid gap-4 md:grid-cols-2">
							<div className="space-y-1">
								<p className="text-sm font-medium">Percentual (%)</p>
								<Input
									type="number"
									step="0.0001"
									min={0}
									max={100}
									value={editingInstallment?.percentage ?? ""}
									onChange={(event) => {
										setEditingInstallment((current) =>
											current
												? {
														...current,
														percentage: event.target.value,
													}
												: current,
										);
									}}
								/>
							</div>
							<div className="space-y-1">
								<p className="text-sm font-medium">Valor</p>
								<Input
									placeholder="R$ 0,00"
									value={editingInstallment?.amount ?? ""}
									onChange={(event) => {
										setEditingInstallment((current) =>
											current
												? {
														...current,
														amount: formatInstallmentAmountInput(
															event.target.value,
															current.status === "REVERSED",
														),
													}
												: current,
										);
									}}
								/>
							</div>
						</div>

						<div className="grid gap-4 md:grid-cols-2">
							<div className="space-y-1">
								<p className="text-sm font-medium">Status</p>
								<Select
									value={editingInstallment?.status}
									disabled={saleStatus === "PENDING"}
									onValueChange={(value) => {
										setEditingInstallment((current) =>
											current
												? {
														...current,
														status: value as SaleCommissionInstallmentStatus,
														amount: formatInstallmentAmountInput(
															current.amount,
															value === "REVERSED",
														),
														reversalDate:
															value === "CANCELED" && !current.reversalDate
																? getTodayDateInputValue()
																: current.reversalDate,
													}
												: current,
										);
									}}
								>
									<SelectTrigger className="w-full">
										<SelectValue placeholder="Selecione" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="PENDING">Pendente</SelectItem>
										<SelectItem value="PAID">Paga</SelectItem>
										<SelectItem value="CANCELED">Cancelada</SelectItem>
										<SelectItem value="REVERSED">Estornada</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div className="space-y-1">
								<p className="text-sm font-medium">Previsão de pagamento</p>
								<CalendarDateInput
									value={editingInstallment?.expectedPaymentDate ?? ""}
									onChange={(value) => {
										setEditingInstallment((current) =>
											current
												? {
														...current,
														expectedPaymentDate: value,
													}
												: current,
										);
									}}
								/>
							</div>
						</div>

						{shouldForceNegativeEditAmount ? (
							<p className="text-muted-foreground text-xs">
								Para status estornada, o valor deve permanecer negativo.
							</p>
						) : null}

						{editingInstallment?.status === "PAID" ||
						editingInstallment?.status === "REVERSED" ||
						editingInstallment?.status === "CANCELED" ? (
							<div className="space-y-1">
								<p className="text-sm font-medium">
									{editingInstallment.status === "REVERSED"
										? "Data do estorno"
										: editingInstallment.status === "CANCELED"
											? "Data do estorno"
											: "Data de pagamento"}
								</p>
								<CalendarDateInput
									value={
										editingInstallment.status === "CANCELED"
											? editingInstallment.reversalDate
											: editingInstallment.paymentDate
									}
									onChange={(value) => {
										setEditingInstallment((current) =>
											current
												? {
														...current,
														...(current.status === "CANCELED"
															? { reversalDate: value }
															: { paymentDate: value }),
													}
												: current,
										);
									}}
								/>
							</div>
						) : null}
					</div>

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => setEditingInstallment(null)}
							disabled={isUpdatingInstallment}
						>
							Cancelar
						</Button>
						<Button
							type="button"
							onClick={handleConfirmInstallmentEdition}
							disabled={isUpdatingInstallment}
						>
							{isUpdatingInstallment ? "Salvando..." : "Salvar alterações"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<AlertDialog
				open={Boolean(installmentToDelete)}
				onOpenChange={(open) => {
					if (!open) {
						setInstallmentToDelete(null);
					}
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Excluir parcela</AlertDialogTitle>
						<AlertDialogDescription>
							Tem certeza que deseja excluir a parcela{" "}
							{installmentToDelete
								? `P${installmentToDelete.installmentNumber}`
								: ""}
							?
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={isDeletingInstallment}>
							Cancelar
						</AlertDialogCancel>
						<AlertDialogAction
							variant="destructive"
							onClick={handleConfirmInstallmentDelete}
							disabled={isDeletingInstallment}
						>
							{isDeletingInstallment ? "Excluindo..." : "Excluir parcela"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
