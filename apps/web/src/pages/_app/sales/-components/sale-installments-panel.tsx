import { format, parseISO } from "date-fns";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
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
import {
	useDeleteSaleCommissionInstallment,
	usePatchSaleCommissionInstallmentStatus,
	useSaleCommissionInstallments,
	useUpdateSaleCommissionInstallment,
} from "@/hooks/sales";
import { showZeroInstallmentsParser } from "@/hooks/filters/parsers";
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
import { useQueryState } from "nuqs";

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

const INSTALLMENT_STATUS_BADGE_CLASSNAME: Record<
	SaleCommissionInstallmentStatus,
	string
> = {
	PENDING: "bg-yellow-500/15 text-yellow-700 border-yellow-500/30",
	PAID: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
	CANCELED: "bg-red-500/15 text-red-700 border-red-500/30",
};

function formatDate(value: string) {
	return format(parseISO(value), "dd/MM/yyyy");
}

function toDateInputValue(value?: string | null) {
	return value ? value.slice(0, 10) : "";
}

function getTodayDateInputValue() {
	return format(new Date(), "yyyy-MM-dd");
}

interface SaleInstallmentsPanelProps {
	saleId: string;
	saleStatus: SaleStatus;
	enabled?: boolean;
}

export function SaleInstallmentsPanel({
	saleId,
	saleStatus,
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
	const { mutateAsync: deleteInstallment, isPending: isDeletingInstallment } =
		useDeleteSaleCommissionInstallment();

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
	const summary = useMemo(
		() => ({
			total: installments.length,
			paid: installments.filter((installment) => installment.status === "PAID")
				.length,
			pending: installments.filter(
				(installment) => installment.status === "PENDING",
			).length,
			canceled: installments.filter(
				(installment) => installment.status === "CANCELED",
			).length,
		}),
		[installments],
	);

	const visibleInstallments = useMemo(
		() =>
			showZeroValueInstallments
				? installments
				: installments.filter((installment) => installment.amount > 0),
		[installments, showZeroValueInstallments],
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
			await updateInstallment({
				saleId,
				installmentId: editingInstallment.installment.id,
				data: {
					percentage: parsedPercentage,
					amount: parseBRLCurrencyToCents(editingInstallment.amount),
					status: editingInstallment.status,
					expectedPaymentDate: editingInstallment.expectedPaymentDate,
					paymentDate:
						editingInstallment.status === "PAID"
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

	return (
		<>
			<div className="space-y-4">
				<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
					<p className="text-sm text-muted-foreground">
						Resumo: {summary.paid}/{summary.total} pagas, {summary.pending}{" "}
						pendentes, {summary.canceled} canceladas.
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
				) : installments.length === 0 ? (
					<p className="text-sm text-muted-foreground">
						Sem parcelas de comissão vinculadas nesta venda.
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
															{installment.status === "PAID" &&
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
																		{(statusActions.length > 0 &&
																			(canEditInstallment ||
																				canDeleteInstallment)) ? (
																			<DropdownMenuSeparator />
																		) : null}
																		{canEditInstallment ? (
																			<DropdownMenuItem
																				onSelect={(event) => {
																					event.preventDefault();
																					requestInstallmentEdition(installment);
																				}}
																			>
																				<Pencil className="size-4" />
																				Editar parcela
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
													amount: formatCurrencyBRL(event.target.value),
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
												}
												: current,
										);
									}}
								>
									<SelectTrigger>
										<SelectValue placeholder="Selecione" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="PENDING">Pendente</SelectItem>
										<SelectItem value="PAID">Paga</SelectItem>
										<SelectItem value="CANCELED">Cancelada</SelectItem>
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

							{editingInstallment?.status === "PAID" ? (
								<div className="space-y-1">
									<p className="text-sm font-medium">Data de pagamento</p>
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
