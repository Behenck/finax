import { format, parse } from "date-fns";
import { MoreHorizontal, Pencil, Trash2, Undo2 } from "lucide-react";
import { useQueryState } from "nuqs";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
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
import {
	useDeleteSaleCommissionInstallment,
	usePatchSaleCommissionInstallmentStatus,
	useReverseSaleCommissionInstallment,
	useSaleCommissionInstallments,
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

type InstallmentStatusAction = {
	installment: SaleInstallmentRow;
	nextStatus: "PAID" | "CANCELED";
	paymentDate: string;
	amount: string;
};

type InstallmentEditState = {
	installment: SaleInstallmentRow;
	percentage: string;
	amount: string;
	status: SaleCommissionInstallmentStatus;
	expectedPaymentDate: string;
	paymentDate: string;
};

type InstallmentReversalState = {
	installment: SaleInstallmentRow;
	reversalDate: string;
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
	REVERSED:
		"bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
};

function formatDate(value: string) {
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
	const [statusAction, setStatusAction] =
		useState<InstallmentStatusAction | null>(null);
	const [editingInstallment, setEditingInstallment] =
		useState<InstallmentEditState | null>(null);
	const [reversalState, setReversalState] =
		useState<InstallmentReversalState | null>(null);
	const [installmentToDelete, setInstallmentToDelete] =
		useState<SaleInstallmentRow | null>(null);

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
	const canUpdateInstallmentsBySaleStatus =
		saleStatus === "APPROVED" || saleStatus === "COMPLETED";
	const canOpenInstallmentActions =
		canUpdateInstallmentsBySaleStatus &&
		(canChangeInstallmentStatus || canEditInstallment || canDeleteInstallment);
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
				: filteredInstallments.filter((installment) => installment.amount !== 0),
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
	const productReversalRules = productReversalRulesData?.rules ?? [];
	const parsedReversalAmount =
		reversalState?.manualAmount.trim().length
			? Number(reversalState.manualAmount.replace(",", ".").trim())
			: Number.NaN;
	const isReversalAmountInvalid =
		!Number.isFinite(parsedReversalAmount) || parsedReversalAmount === 0;
	const shouldForceNegativeEditAmount =
		editingInstallment?.status === "REVERSED";

	function requestInstallmentStatusChange(
		installment: SaleInstallmentRow,
		nextStatus: "PAID" | "CANCELED",
	) {
		setStatusAction({
			installment,
			nextStatus,
			paymentDate:
				nextStatus === "PAID"
					? toDateInputValue(installment.paymentDate) ||
						getTodayDateInputValue()
					: "",
			amount: formatCurrencyBRL(installment.amount / 100),
		});
	}

	function requestInstallmentReversal(installment: SaleInstallmentRow) {
		if (!canChangeInstallmentStatus || !canUpdateInstallmentsBySaleStatus) {
			return;
		}

		setReversalState({
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

		const matchedRule = productReversalRules.find(
			(rule) =>
				rule.installmentNumber === reversalState.installment.installmentNumber,
		);

		if (!matchedRule) {
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
		const calculatedAmount = -Math.round(
			(totalPaidAmount * matchedRule.percentage) / 100,
		);

		setReversalState((current) => {
			if (!current) {
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
	}, [
		filteredInstallments,
		isLoadingProductReversalRules,
		isProductReversalRulesError,
		productReversalRules,
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
		});
	}

	async function handleConfirmInstallmentStatusChange() {
		if (!statusAction) {
			return;
		}

		try {
			await patchInstallmentStatus({
				saleId,
				installmentId: statusAction.installment.id,
				status: statusAction.nextStatus,
				amount: parseBRLCurrencyToCents(statusAction.amount),
				paymentDate:
					statusAction.nextStatus === "PAID"
						? statusAction.paymentDate || undefined
						: undefined,
			});
			setStatusAction(null);
		} catch {
			// erro tratado no hook
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
			saleId,
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

		const parsedManualAmount = parseManualAmountToCents(
			reversalState.manualAmount,
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
				saleId,
				installmentId: reversalState.installment.id,
				reversalDate: reversalState.reversalDate,
				manualAmount: parsedManualAmount,
			});
			setReversalState(null);
		} catch {
			// erro tratado no hook
		}
	}

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

				{isLoading ? (
					<p className="text-sm text-muted-foreground">
						Carregando parcelas...
					</p>
				) : isError ? (
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
				) : filteredInstallments.length === 0 ? (
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

						{installmentsByBeneficiary.map((group) => (
							<TabsContent key={group.key} value={group.key} className="pt-2">
								<div className="rounded-md border overflow-hidden">
									<Table>
										<TableHeader>
											<TableRow>
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
												const statusActions =
													canUpdateInstallmentsBySaleStatus &&
													canChangeInstallmentStatus
														? (["PAID", "CANCELED"] as const).filter(
																(status) => status !== installment.status,
															)
														: [];
												const canReverseInstallment =
													canUpdateInstallmentsBySaleStatus &&
													canChangeInstallmentStatus &&
													(installment.status === "PENDING" ||
														installment.status === "PAID");

												return (
													<TableRow key={installment.id}>
														<TableCell>
															P{installment.installmentNumber}
														</TableCell>
														<TableCell>{installment.percentage}%</TableCell>
														<TableCell>
															{formatCurrencyBRL(installment.amount / 100)}
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
															{formatDate(installment.expectedPaymentDate)}
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
														</TableCell>
														<TableCell className="text-right">
															{canOpenInstallmentActions ? (
																<DropdownMenu>
																	<DropdownMenuTrigger asChild>
																		<Button
																			type="button"
																			variant="ghost"
																			size="icon"
																			disabled={
																				isPatchingStatus ||
																				isUpdatingInstallment ||
																				isReversingInstallment ||
																				isDeletingInstallment
																			}
																		>
																			<MoreHorizontal className="size-4" />
																		</Button>
																	</DropdownMenuTrigger>
																	<DropdownMenuContent align="end">
																		{statusActions.map((actionStatus) => (
																			<DropdownMenuItem
																				key={`${installment.id}-${actionStatus}`}
																				onSelect={(event) => {
																					event.preventDefault();
																					requestInstallmentStatusChange(
																						installment,
																						actionStatus,
																					);
																				}}
																			>
																				Marcar como{" "}
																				{
																					SALE_COMMISSION_INSTALLMENT_STATUS_LABEL[
																						actionStatus
																					]
																				}
																			</DropdownMenuItem>
																		))}
																		{statusActions.length > 0 &&
																		(canEditInstallment ||
																			canDeleteInstallment ||
																			canReverseInstallment) ? (
																			<DropdownMenuSeparator />
																		) : null}
																		{canEditInstallment ? (
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
																		{canReverseInstallment ? (
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
																		{canDeleteInstallment ? (
																			<DropdownMenuItem
																				variant="destructive"
																				onSelect={(event) => {
																					event.preventDefault();
																					setInstallmentToDelete(installment);
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
						))}
					</Tabs>
				)}
			</div>

			<AlertDialog
				open={Boolean(statusAction)}
				onOpenChange={(open) => {
					if (!open) {
						setStatusAction(null);
					}
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Atualizar status da parcela</AlertDialogTitle>
						<AlertDialogDescription>
							Confirmar alteração da parcela{" "}
							{statusAction
								? `P${statusAction.installment.installmentNumber}`
								: ""}{" "}
							para{" "}
							{statusAction
								? SALE_COMMISSION_INSTALLMENT_STATUS_LABEL[
										statusAction.nextStatus
									]
								: ""}
							?
						</AlertDialogDescription>
					</AlertDialogHeader>

					<div className="space-y-3">
						<div className="space-y-1">
							<p className="text-sm font-medium">Valor da parcela</p>
							<Input
								placeholder="R$ 0,00"
								value={statusAction?.amount ?? ""}
								onChange={(event) => {
									setStatusAction((current) =>
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

						{statusAction?.nextStatus === "PAID" ? (
							<div className="space-y-1">
								<p className="text-sm font-medium">Data de pagamento</p>
								<CalendarDateInput
									value={statusAction.paymentDate}
									onChange={(value) => {
										setStatusAction((current) =>
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
						) : null}
					</div>

					<AlertDialogFooter>
						<AlertDialogCancel disabled={isPatchingStatus}>
							Cancelar
						</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleConfirmInstallmentStatusChange}
							disabled={isPatchingStatus}
						>
							{isPatchingStatus ? "Salvando..." : "Confirmar"}
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
							Ajuste percentual, valor, status e datas da parcela.
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
						editingInstallment?.status === "REVERSED" ? (
							<div className="space-y-1">
								<p className="text-sm font-medium">
									{editingInstallment.status === "REVERSED"
										? "Data do estorno"
										: "Data de pagamento"}
								</p>
								<CalendarDateInput
									value={editingInstallment.paymentDate}
									onChange={(value) => {
										setEditingInstallment((current) =>
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
