import type { Dispatch, SetStateAction } from "react";
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
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type { SaleCommissionInstallmentStatus } from "@/schemas/types/sales";
import { formatCurrencyBRL } from "@/utils/format-amount";
import type {
	CommissionInstallmentRow,
	InstallmentEditState,
	InstallmentPayAction,
	InstallmentReversalAction,
} from "./types";

function formatInstallmentAmountInput(value: string, forceNegative: boolean) {
	const formattedValue = formatCurrencyBRL(value).replace(/^-/, "");

	if (!forceNegative) {
		return formattedValue;
	}

	return `-${formattedValue}`;
}

interface CommissionsInstallmentDialogsProps {
	selectedInstallmentsCount: number;
	selectedInstallmentsTotalAmount: number;
	canChangeInstallmentStatus: boolean;
	canEditInstallment: boolean;
	canDeleteInstallment: boolean;
	isBulkPaymentDialogOpen: boolean;
	onBulkPaymentDialogOpenChange: (open: boolean) => void;
	bulkPaymentDate: string;
	onBulkPaymentDateChange: (value: string) => void;
	onConfirmBulkPayment: () => void;
	isPaymentActionPending: boolean;
	payAction: InstallmentPayAction | null;
	onPayActionChange: Dispatch<SetStateAction<InstallmentPayAction | null>>;
	onConfirmInstallmentPayment: () => void;
	isPatchingStatus: boolean;
	reversalAction: InstallmentReversalAction | null;
	onReversalActionChange: Dispatch<
		SetStateAction<InstallmentReversalAction | null>
	>;
	onConfirmInstallmentReversal: () => void;
	isReversingInstallment: boolean;
	editingInstallment: InstallmentEditState | null;
	onEditingInstallmentChange: Dispatch<
		SetStateAction<InstallmentEditState | null>
	>;
	onConfirmInstallmentEdition: () => void;
	isUpdatingInstallment: boolean;
	installmentToDelete: CommissionInstallmentRow | null;
	onInstallmentToDeleteChange: (value: CommissionInstallmentRow | null) => void;
	onConfirmInstallmentDelete: () => void;
	isDeletingInstallment: boolean;
}

export function CommissionsInstallmentDialogs({
	selectedInstallmentsCount,
	selectedInstallmentsTotalAmount,
	canChangeInstallmentStatus,
	canEditInstallment,
	canDeleteInstallment,
	isBulkPaymentDialogOpen,
	onBulkPaymentDialogOpenChange,
	bulkPaymentDate,
	onBulkPaymentDateChange,
	onConfirmBulkPayment,
	isPaymentActionPending,
	payAction,
	onPayActionChange,
	onConfirmInstallmentPayment,
	isPatchingStatus,
	reversalAction,
	onReversalActionChange,
	onConfirmInstallmentReversal,
	isReversingInstallment,
	editingInstallment,
	onEditingInstallmentChange,
	onConfirmInstallmentEdition,
	isUpdatingInstallment,
	installmentToDelete,
	onInstallmentToDeleteChange,
	onConfirmInstallmentDelete,
	isDeletingInstallment,
}: CommissionsInstallmentDialogsProps) {
	const parsedReversalAmount =
		reversalAction?.manualAmount.trim().length
			? Number(reversalAction.manualAmount.replace(",", ".").trim())
			: Number.NaN;
	const isReversalAmountInvalid =
		!Number.isFinite(parsedReversalAmount) || parsedReversalAmount === 0;
	const shouldForceNegativeEditAmount =
		editingInstallment?.status === "REVERSED";

	return (
		<>
			<Dialog
				open={isBulkPaymentDialogOpen}
				onOpenChange={onBulkPaymentDialogOpenChange}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Pagar parcelas selecionadas</DialogTitle>
						<DialogDescription>
							Pagamento em lote para {selectedInstallmentsCount} parcela(s).
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-3">
						<p className="text-sm text-muted-foreground">
							Total selecionado:{" "}
							{formatCurrencyBRL(selectedInstallmentsTotalAmount / 100)}
						</p>
						<div className="space-y-1">
							<p className="text-sm font-medium">Data de pagamento</p>
							<CalendarDateInput
								value={bulkPaymentDate}
								onChange={onBulkPaymentDateChange}
							/>
						</div>
					</div>

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => onBulkPaymentDialogOpenChange(false)}
							disabled={isPaymentActionPending}
						>
							Cancelar
						</Button>
						<Button
							type="button"
							onClick={onConfirmBulkPayment}
							disabled={
								isPaymentActionPending ||
								selectedInstallmentsCount === 0 ||
								!canChangeInstallmentStatus
							}
						>
							{isPaymentActionPending ? "Pagando..." : "Confirmar pagamento"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<AlertDialog
				open={Boolean(payAction)}
				onOpenChange={(open) => {
					if (!open) {
						onPayActionChange(null);
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
									onPayActionChange((current) =>
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
									onPayActionChange((current) =>
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
						<AlertDialogCancel
							disabled={isPatchingStatus || isPaymentActionPending}
						>
							Cancelar
						</AlertDialogCancel>
						<AlertDialogAction
							onClick={onConfirmInstallmentPayment}
							disabled={
								isPatchingStatus ||
								isPaymentActionPending ||
								!canChangeInstallmentStatus
							}
						>
							{isPatchingStatus ? "Salvando..." : "Confirmar"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			<Dialog
				open={Boolean(reversalAction)}
				onOpenChange={(open) => {
					if (!open) {
						onReversalActionChange(null);
					}
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Estornar parcela</DialogTitle>
						<DialogDescription>
							Confirme o estorno da parcela{" "}
							{reversalAction
								? `P${reversalAction.installment.installmentNumber}`
								: ""}
							.
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4">
						<div className="space-y-1">
							<p className="text-sm font-medium">Data do estorno</p>
							<CalendarDateInput
								value={reversalAction?.reversalDate ?? ""}
								onChange={(value) => {
									onReversalActionChange((current) =>
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

						{reversalAction?.calculationStatus === "LOADING" ? (
							<div className="space-y-2 rounded-md border p-3">
								<p className="text-sm font-medium">
									Calculando regra automática...
								</p>
								<div className="h-3 w-4/5 animate-pulse rounded bg-muted" />
								<div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
							</div>
						) : null}

						{reversalAction?.calculationStatus === "ERROR" ? (
							<div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3">
								<p className="text-sm font-medium text-amber-700 dark:text-amber-300">
									Não foi possível calcular automaticamente.
								</p>
								<p className="text-xs text-amber-700 dark:text-amber-300">
									{reversalAction.calculationError ??
										"Preencha o valor manualmente para continuar."}
								</p>
							</div>
						) : null}

						{reversalAction?.mode === "AUTO" ? (
							<div className="space-y-2 rounded-md border p-3">
								<p className="text-sm font-medium">
									Regra automática do produto
								</p>
								<p className="text-sm text-muted-foreground">
									Parcela {reversalAction.installment.installmentNumber}:{" "}
									{reversalAction.rulePercentage ?? 0}% sobre o total pago
									positivo acumulado.
								</p>
								<p className="text-sm text-muted-foreground">
									Total pago positivo:{" "}
									{formatCurrencyBRL(
										(reversalAction.totalPaidAmount ?? 0) / 100,
									)}
								</p>
								<p className="text-sm font-medium">
									Valor do estorno:{" "}
									{formatCurrencyBRL(
										(reversalAction.calculatedAmount ?? 0) / 100,
									)}
								</p>
								{(reversalAction.calculatedAmount ?? 0) === 0 ? (
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
									reversalAction?.calculationStatus === "LOADING"
										? "Carregando valor sugerido..."
										: "-130.00"
								}
								value={reversalAction?.manualAmount ?? ""}
								onChange={(event) => {
									onReversalActionChange((current) =>
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
							{reversalAction?.calculationStatus === "LOADING" &&
							!reversalAction.manualAmount ? (
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
							onClick={() => onReversalActionChange(null)}
							disabled={isReversingInstallment}
						>
							Cancelar
						</Button>
						<Button
							type="button"
							onClick={onConfirmInstallmentReversal}
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
						onEditingInstallmentChange(null);
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
										onEditingInstallmentChange((current) =>
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
										onEditingInstallmentChange((current) =>
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
										onEditingInstallmentChange((current) =>
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
										onEditingInstallmentChange((current) =>
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
										onEditingInstallmentChange((current) =>
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
							onClick={() => onEditingInstallmentChange(null)}
							disabled={isUpdatingInstallment}
						>
							Cancelar
						</Button>
						<Button
							type="button"
							onClick={onConfirmInstallmentEdition}
							disabled={isUpdatingInstallment || !canEditInstallment}
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
						onInstallmentToDeleteChange(null);
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
							? Essa ação não pode ser desfeita.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={isDeletingInstallment}>
							Cancelar
						</AlertDialogCancel>
						<AlertDialogAction
							variant="destructive"
							onClick={onConfirmInstallmentDelete}
							disabled={isDeletingInstallment || !canDeleteInstallment}
						>
							{isDeletingInstallment ? "Excluindo..." : "Excluir parcela"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
