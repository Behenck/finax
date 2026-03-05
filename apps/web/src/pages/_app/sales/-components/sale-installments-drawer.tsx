import { format, parseISO } from "date-fns";
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
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	usePatchSaleCommissionInstallmentStatus,
	useSaleCommissionInstallments,
} from "@/hooks/sales";
import {
	SALE_COMMISSION_INSTALLMENT_STATUS_LABEL,
	SALE_COMMISSION_RECIPIENT_TYPE_LABEL,
	SALE_COMMISSION_SOURCE_TYPE_LABEL,
	type SaleCommissionInstallmentStatus,
	type SaleStatus,
} from "@/schemas/types/sales";
import { formatCurrencyBRL } from "@/utils/format-amount";
import { MoreHorizontal } from "lucide-react";
import { useMemo, useState } from "react";

const INSTALLMENT_STATUS_BADGE_CLASSNAME: Record<
	SaleCommissionInstallmentStatus,
	string
> = {
	PENDING: "bg-yellow-500/15 text-yellow-700 border-yellow-500/30",
	PAID: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
	CANCELED: "bg-red-500/15 text-red-700 border-red-500/30",
};

type InstallmentStatusAction = {
	installmentId: string;
	installmentNumber: number;
	nextStatus: "PAID" | "CANCELED";
};

interface SaleInstallmentsDrawerProps {
	open: boolean;
	onOpenChange(open: boolean): void;
	saleId: string;
	saleStatus: SaleStatus;
}

function formatDate(value: string) {
	return format(parseISO(value), "dd/MM/yyyy");
}

export function SaleInstallmentsDrawer({
	open,
	onOpenChange,
	saleId,
	saleStatus,
}: SaleInstallmentsDrawerProps) {
	const [statusAction, setStatusAction] = useState<InstallmentStatusAction | null>(
		null,
	);
	const { data, isLoading, isError, refetch } = useSaleCommissionInstallments(
		saleId,
		{ enabled: open },
	);
	const { mutateAsync: patchInstallmentStatus, isPending } =
		usePatchSaleCommissionInstallmentStatus();

	const canUpdateInstallments =
		saleStatus === "APPROVED" || saleStatus === "COMPLETED";
	const installments = useMemo(() => data?.installments ?? [], [data?.installments]);
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

	async function handleConfirmInstallmentStatusChange() {
		if (!statusAction) {
			return;
		}

		try {
			await patchInstallmentStatus({
				saleId,
				installmentId: statusAction.installmentId,
				status: statusAction.nextStatus,
			});
			setStatusAction(null);
		} catch {
			// erro tratado no hook
		}
	}

	return (
		<>
			<Sheet open={open} onOpenChange={onOpenChange}>
				<SheetContent side="right" className="w-full sm:max-w-5xl">
					<SheetHeader>
						<SheetTitle>Parcelas de comissão</SheetTitle>
						<SheetDescription>
							Resumo: {summary.paid}/{summary.total} pagas, {summary.pending}{" "}
							pendentes, {summary.canceled} canceladas.
						</SheetDescription>
					</SheetHeader>

					<div className="px-4">
						{isLoading ? (
							<p className="text-sm text-muted-foreground">
								Carregando parcelas...
							</p>
						) : isError ? (
							<div className="space-y-3">
								<p className="text-sm text-destructive">
									Não foi possível carregar as parcelas de comissão.
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
								Esta venda não possui parcelas de comissão.
							</p>
						) : (
							<div className="rounded-md border overflow-hidden">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Comissionado</TableHead>
											<TableHead>Parcela</TableHead>
											<TableHead>%</TableHead>
											<TableHead>Valor</TableHead>
											<TableHead>Status</TableHead>
											<TableHead>Previsão</TableHead>
											<TableHead>Pagamento</TableHead>
											<TableHead className="w-[90px] text-right">
												Ações
											</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{installments.map((installment) => {
											const beneficiaryLabel =
												installment.beneficiaryLabel ??
												`${SALE_COMMISSION_RECIPIENT_TYPE_LABEL[installment.recipientType]}`;
											const availableActions = canUpdateInstallments
												? (["PAID", "CANCELED"] as const).filter(
														(status) => status !== installment.status,
													)
												: [];

											return (
												<TableRow key={installment.id}>
													<TableCell>
														<div className="flex flex-col">
															<span className="font-medium">
																{beneficiaryLabel}
															</span>
															<span className="text-xs text-muted-foreground">
																{
																	SALE_COMMISSION_SOURCE_TYPE_LABEL[
																		installment.sourceType
																	]
																}
															</span>
														</div>
													</TableCell>
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
													<TableCell className="text-right">
														{availableActions.length === 0 ? (
															<span className="text-xs text-muted-foreground">
																—
															</span>
														) : (
															<DropdownMenu>
																<DropdownMenuTrigger asChild>
																	<Button
																		type="button"
																		variant="ghost"
																		size="icon"
																		disabled={isPending}
																	>
																		<MoreHorizontal className="size-4" />
																	</Button>
																</DropdownMenuTrigger>
																<DropdownMenuContent align="end">
																	{availableActions.map((actionStatus) => (
																		<DropdownMenuItem
																			key={actionStatus}
																			onSelect={(event) => {
																				event.preventDefault();
																				setStatusAction({
																					installmentId: installment.id,
																					installmentNumber:
																						installment.installmentNumber,
																					nextStatus: actionStatus,
																				});
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
																</DropdownMenuContent>
															</DropdownMenu>
														)}
													</TableCell>
												</TableRow>
											);
										})}
									</TableBody>
								</Table>
							</div>
						)}
					</div>
				</SheetContent>
			</Sheet>

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
							{statusAction ? `P${statusAction.installmentNumber}` : ""} para{" "}
							{statusAction
								? SALE_COMMISSION_INSTALLMENT_STATUS_LABEL[
										statusAction.nextStatus
									]
								: ""}
							?
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleConfirmInstallmentStatusChange}
							disabled={isPending}
						>
							{isPending ? "Salvando..." : "Confirmar"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
