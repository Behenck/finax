import { Button } from "@/components/ui/button";
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
import { RefreshCcw } from "lucide-react";
import { useMemo, useState } from "react";

interface SaleStatusActionProps {
	saleId: string;
	currentStatus: SaleStatus;
	trigger?: "button" | "dropdown-item";
}

export function SaleStatusAction({
	saleId,
	currentStatus,
	trigger = "button",
}: SaleStatusActionProps) {
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [nextStatus, setNextStatus] = useState<SaleStatus | "">("");
	const { mutateAsync: patchSaleStatus, isPending } = usePatchSaleStatus();

	const availableTransitions = useMemo(
		() => SALE_STATUS_TRANSITIONS[currentStatus],
		[currentStatus],
	);

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

	return (
		<>
			{trigger === "dropdown-item" ? (
				<DropdownMenuItem
					disabled={isPending || availableTransitions.length === 0}
					onSelect={(event) => {
						event.preventDefault();
						setNextStatus(availableTransitions[0] ?? "");
						setIsModalOpen(true);
					}}
				>
					<RefreshCcw className="size-4" />
					{availableTransitions.length === 0
						? "Sem transição de status"
						: "Alterar status"}
				</DropdownMenuItem>
			) : (
				<Button
					variant="outline"
					size="sm"
					disabled={isPending || availableTransitions.length === 0}
					onClick={() => {
						setNextStatus(availableTransitions[0] ?? "");
						setIsModalOpen(true);
					}}
				>
					<RefreshCcw className="size-4" />
					{availableTransitions.length === 0 ? "Sem transição" : "Alterar status"}
				</Button>
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
