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
} from "./types";

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
	editingInstallment,
	onEditingInstallmentChange,
	onConfirmInstallmentEdition,
	isUpdatingInstallment,
	installmentToDelete,
	onInstallmentToDeleteChange,
	onConfirmInstallmentDelete,
	isDeletingInstallment,
}: CommissionsInstallmentDialogsProps) {
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
										onEditingInstallmentChange((current) =>
											current
												? {
														...current,
														status: value as SaleCommissionInstallmentStatus,
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

						{editingInstallment?.status === "PAID" ? (
							<div className="space-y-1">
								<p className="text-sm font-medium">Data de pagamento</p>
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
