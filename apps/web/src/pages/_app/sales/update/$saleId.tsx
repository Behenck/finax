import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { useDeleteSale, useSale, useSaleNavigation } from "@/hooks/sales";
import { useAbility } from "@/permissions/access";
import { useState } from "react";
import { SaleForm } from "../-components/sale-form";
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
import { SaleActionsDropdown } from "../-components/sale-actions-dropdown";

export const Route = createFileRoute("/_app/sales/update/$saleId")({
	component: UpdateSalePage,
});

export function UpdateSalePage() {
	const ability = useAbility();
	const canUpdateSale = ability.can("access", "sales.update");
	const canCreateSale = ability.can("access", "sales.create");
	const canDeleteSalePermission = ability.can("access", "sales.delete");
	const { saleId } = Route.useParams();
	const navigate = useNavigate();
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const {
		previousSaleId,
		nextSaleId,
		isLoading: isSaleNavigationLoading,
	} = useSaleNavigation(saleId);
	const { data, isLoading, isError } = useSale(saleId);
	const { mutateAsync: deleteSale, isPending: isDeletingSale } =
		useDeleteSale();

	if (!canUpdateSale && !canCreateSale) {
		return (
			<Card className="p-6">
				<span className="text-muted-foreground">
					Você não possui permissão para editar vendas.
				</span>
			</Card>
		);
	}

	if (isLoading) {
		return (
			<Card className="p-6">
				<span className="text-muted-foreground">Carregando venda...</span>
			</Card>
		);
	}

	if (isError || !data?.sale) {
		return (
			<Card className="p-6">
				<span className="text-destructive">
					Não foi possível carregar a venda.
				</span>
			</Card>
		);
	}
	const canEditSale =
		canUpdateSale || (canCreateSale && data.sale.status === "PENDING");

	if (!canEditSale) {
		return (
			<Card className="p-6">
				<span className="text-muted-foreground">
					Você não possui permissão para editar esta venda no status atual.
				</span>
			</Card>
		);
	}

	function handleGoToPreviousSale() {
		if (!previousSaleId) {
			return;
		}

		void navigate({
			to: "/sales/update/$saleId",
			params: {
				saleId: previousSaleId,
			},
		});
	}

	function handleGoToNextSale() {
		if (!nextSaleId) {
			return;
		}

		void navigate({
			to: "/sales/update/$saleId",
			params: {
				saleId: nextSaleId,
			},
		});
	}

	async function handleDeleteSale() {
		try {
			await deleteSale({
				saleId,
			});
			await navigate({
				to: "/sales",
			});
		} catch {
			// erro tratado no hook
		}
	}

	return (
		<main className="w-full space-y-6">
			<PageHeader
				title="Editar Venda"
				description="Atualize os dados da venda sem alterar o status."
				actions={
					<>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									type="button"
									variant="outline"
									size="icon"
									className="w-full sm:w-10"
									aria-label="Venda anterior"
									disabled={isSaleNavigationLoading || !previousSaleId}
									onClick={handleGoToPreviousSale}
								>
									<ArrowLeft className="size-4" />
								</Button>
							</TooltipTrigger>
							<TooltipContent side="top">Ir para venda anterior</TooltipContent>
						</Tooltip>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									type="button"
									variant="outline"
									size="icon"
									className="w-full sm:w-10"
									aria-label="Venda próxima"
									disabled={isSaleNavigationLoading || !nextSaleId}
									onClick={handleGoToNextSale}
								>
									<ArrowRight className="size-4" />
								</Button>
							</TooltipTrigger>
							<TooltipContent side="top">Ir para próxima venda</TooltipContent>
						</Tooltip>
						<Button asChild variant="outline" className="w-full sm:w-auto">
							<Link to="/sales">
								<ArrowLeft className="size-4" />
								Voltar
							</Link>
						</Button>
						<SaleActionsDropdown
							saleId={data.sale.id}
							customerId={data.sale.customer.id}
							canCreateSale={canCreateSale}
							canEditSale={canEditSale}
							canDeleteSale={canDeleteSalePermission}
							isDeleting={isDeletingSale}
							onRequestDelete={() => setDeleteDialogOpen(true)}
						/>
					</>
				}
			/>

			<SaleForm mode="UPDATE" initialSale={data.sale} />

			<AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Excluir venda</AlertDialogTitle>
						<AlertDialogDescription>
							Tem certeza que deseja excluir esta venda? Esta ação não pode ser
							desfeita.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={isDeletingSale}>
							Cancelar
						</AlertDialogCancel>
						<AlertDialogAction
							variant="destructive"
							onClick={handleDeleteSale}
							disabled={isDeletingSale}
						>
							{isDeletingSale ? "Excluindo..." : "Excluir venda"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</main>
	);
}
