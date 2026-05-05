import { Button } from "@/components/ui/button";
import { ContextMenuItem } from "@/components/ui/context-menu";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { usePatchSaleStatus } from "@/hooks/sales";
import {
	SALE_STATUS_LABEL,
	SALE_STATUS_TRANSITIONS,
	type SaleStatus,
} from "@/schemas/types/sales";
import { CheckCircle2, RefreshCcw } from "lucide-react";
import { useMemo, useState } from "react";

interface SaleStatusActionProps {
	saleId: string;
	currentStatus: SaleStatus;
	trigger?: "button" | "dropdown-item" | "context-menu-item";
	buttonMode?: "default" | "modal-only";
	availableTransitionsOverride?: SaleStatus[];
}

export function SaleStatusAction({
	saleId,
	currentStatus,
	trigger = "button",
	buttonMode = "default",
	availableTransitionsOverride,
}: SaleStatusActionProps) {
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [nextStatus, setNextStatus] = useState<SaleStatus | "">("");
	const { mutateAsync: patchSaleStatus, isPending } = usePatchSaleStatus();

	const availableTransitions = useMemo(
		() =>
			availableTransitionsOverride ?? SALE_STATUS_TRANSITIONS[currentStatus],
		[availableTransitionsOverride, currentStatus],
	);
	const canCompleteDirectly = availableTransitions.includes("COMPLETED");
	const hasAlternativeTransitions = availableTransitions.some(
		(status) => status !== "COMPLETED",
	);
	const isPendingDirectCompletionButton =
		trigger === "button" &&
		buttonMode === "modal-only" &&
		currentStatus === "PENDING" &&
		canCompleteDirectly;

	function openStatusModal(preferAlternativeStatus = false) {
		const defaultStatus = preferAlternativeStatus
			? (availableTransitions.find((status) => status !== "COMPLETED") ?? "")
			: availableTransitions.includes("COMPLETED")
				? "COMPLETED"
				: (availableTransitions[0] ?? "");

		setNextStatus(defaultStatus);
		setIsModalOpen(true);
	}

	async function handleConfirmStatusChange() {
		if (!nextStatus) {
			return;
		}

		try {
			await patchSaleStatus({
				saleId,
				status: nextStatus,
			});
			setNextStatus("");
			setIsModalOpen(false);
		} catch {
			// erro tratado no hook
		}
	}

	async function handleCompleteDirectly() {
		if (!canCompleteDirectly) {
			return;
		}

		try {
			await patchSaleStatus({
				saleId,
				status: "COMPLETED",
			});
		} catch {
			// erro tratado no hook
		}
	}

	const MenuItem =
		trigger === "context-menu-item" ? ContextMenuItem : DropdownMenuItem;

	return (
		<>
			{trigger === "dropdown-item" || trigger === "context-menu-item" ? (
				<>
					{canCompleteDirectly ? (
						<MenuItem
							disabled={isPending}
							onSelect={() => {
								void handleCompleteDirectly();
							}}
						>
							<CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-300" />
							Concluir venda
						</MenuItem>
					) : null}

					{hasAlternativeTransitions ||
					(!canCompleteDirectly && availableTransitions.length > 0) ? (
						<MenuItem
							disabled={isPending}
							onSelect={(event) => {
								event.preventDefault();
								openStatusModal(canCompleteDirectly);
							}}
						>
							<RefreshCcw className="size-4" />
							Alterar status
						</MenuItem>
					) : null}

					{availableTransitions.length === 0 ? (
						<MenuItem disabled>
							<RefreshCcw className="size-4" />
							Sem transição de status
						</MenuItem>
					) : null}
				</>
			) : (
				<div className="flex flex-col gap-2 sm:flex-row">
					{isPendingDirectCompletionButton ? (
						<Button
							size="sm"
							disabled={isPending}
							onClick={() => {
								void handleCompleteDirectly();
							}}
						>
							<CheckCircle2 className="size-4" />
							Concluir venda
						</Button>
					) : buttonMode === "modal-only" ? (
						<Button
							variant="outline"
							size="sm"
							disabled={isPending || availableTransitions.length === 0}
							onClick={() => openStatusModal(false)}
						>
							<RefreshCcw className="size-4" />
							{availableTransitions.length === 0
								? "Sem transição"
								: "Mudar status"}
						</Button>
					) : (
						<>
							{canCompleteDirectly ? (
								<Button
									size="sm"
									disabled={isPending}
									onClick={() => {
										void handleCompleteDirectly();
									}}
								>
									<CheckCircle2 className="size-4" />
									Concluir venda
								</Button>
							) : null}

							{hasAlternativeTransitions ||
							(!canCompleteDirectly && availableTransitions.length > 0) ? (
								<Button
									variant="outline"
									size="sm"
									disabled={isPending}
									onClick={() => openStatusModal(canCompleteDirectly)}
								>
									<RefreshCcw className="size-4" />
									{canCompleteDirectly ? "Outros status" : "Alterar status"}
								</Button>
							) : null}

							{availableTransitions.length === 0 ? (
								<Button variant="outline" size="sm" disabled>
									<RefreshCcw className="size-4" />
									Sem transição
								</Button>
							) : null}
						</>
					)}
				</div>
			)}

			<Dialog
				open={isModalOpen}
				onOpenChange={(open) => {
					setIsModalOpen(open);
					if (!open) {
						setNextStatus("");
					}
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Alterar status da venda</DialogTitle>
						<DialogDescription>
							Status atual: <strong>{SALE_STATUS_LABEL[currentStatus]}</strong>
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-2">
						<p className="text-sm font-medium">Novo status</p>
						<Select
							value={nextStatus || undefined}
							onValueChange={(value) => setNextStatus(value as SaleStatus)}
							disabled={isPending || availableTransitions.length === 0}
						>
							<SelectTrigger className="w-full">
								<SelectValue placeholder="Selecione o novo status" />
							</SelectTrigger>
							<SelectContent>
								{availableTransitions.map((status) => (
									<SelectItem key={status} value={status}>
										{SALE_STATUS_LABEL[status]}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setIsModalOpen(false)}
							disabled={isPending}
						>
							Cancelar
						</Button>
						<Button
							onClick={handleConfirmStatusChange}
							disabled={isPending || !nextStatus}
						>
							{isPending ? "Salvando..." : "Salvar status"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
