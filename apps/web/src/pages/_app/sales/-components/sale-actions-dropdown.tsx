import { Link, useNavigate } from "@tanstack/react-router";
import {
	ClipboardPlus,
	Copy,
	EllipsisVertical,
	Eye,
	Pencil,
	Plus,
	Trash2,
} from "lucide-react";
import { useState } from "react";
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
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface SaleActionsDropdownProps {
	saleId: string;
	customerId?: string;
	canCreateSale: boolean;
	canEditSale: boolean;
	canDeleteSale: boolean;
	isDeleting?: boolean;
	onRequestDelete(): void;
}

export function SaleActionsDropdown({
	saleId,
	customerId,
	canCreateSale,
	canEditSale,
	canDeleteSale,
	isDeleting = false,
	onRequestDelete,
}: SaleActionsDropdownProps) {
	const navigate = useNavigate();
	const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
	const canRenderActions =
		canCreateSale || canEditSale || canDeleteSale || isDeleting;

	if (!canRenderActions) {
		return null;
	}

	async function handleConfirmDuplicate() {
		await navigate({
			to: "/sales/create",
			search: {
				duplicateSaleId: saleId,
			},
		});
		setDuplicateDialogOpen(false);
	}

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button type="button" variant="outline" className="w-full md:w-auto">
						<EllipsisVertical className="size-4" />
						Ações
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-56">
					<DropdownMenuLabel>Vendas</DropdownMenuLabel>
					{canCreateSale ? (
						<>
							{customerId ? (
								<DropdownMenuItem asChild>
									<Link
										to="/registers/customers/$customerId"
										params={{ customerId }}
									>
										<Eye className="size-4" />
										Ver cliente
									</Link>
								</DropdownMenuItem>
							) : null}
							<DropdownMenuItem asChild>
								{customerId ? (
									<Link
										to="/sales/create"
										search={{
											customerId,
										}}
									>
										<Plus className="size-4" />
										Criar venda
									</Link>
								) : (
									<Link to="/sales/create">
										<Plus className="size-4" />
										Criar venda
									</Link>
								)}
							</DropdownMenuItem>
							<DropdownMenuItem asChild>
								<Link to="/sales/quick-create">
									<ClipboardPlus className="size-4" />
									Venda em massa
								</Link>
							</DropdownMenuItem>
						</>
					) : null}
					{canEditSale ? (
						<DropdownMenuItem asChild>
							<Link to="/sales/update/$saleId" params={{ saleId }}>
								<Pencil className="size-4" />
								Editar
							</Link>
						</DropdownMenuItem>
					) : null}
					{canCreateSale ? (
						<DropdownMenuItem
							onSelect={(event) => {
								event.preventDefault();
								setDuplicateDialogOpen(true);
							}}
						>
							<Copy className="size-4" />
							Duplicar
						</DropdownMenuItem>
					) : null}
					{canDeleteSale ? (
						<>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								variant="destructive"
								disabled={isDeleting}
								onSelect={(event) => {
									event.preventDefault();
									onRequestDelete();
								}}
							>
								<Trash2 className="size-4" />
								{isDeleting ? "Excluindo..." : "Excluir"}
							</DropdownMenuItem>
						</>
					) : null}
				</DropdownMenuContent>
			</DropdownMenu>

			<AlertDialog
				open={duplicateDialogOpen}
				onOpenChange={setDuplicateDialogOpen}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Duplicar venda</AlertDialogTitle>
						<AlertDialogDescription>
							Deseja duplicar esta venda? Uma nova venda será aberta com os
							dados desta venda pré-preenchidos.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancelar</AlertDialogCancel>
						<AlertDialogAction onClick={() => void handleConfirmDuplicate()}>
							Duplicar
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
