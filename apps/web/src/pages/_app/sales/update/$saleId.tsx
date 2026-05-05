import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { FormPageSkeleton } from "@/components/loading-skeletons";
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
import type { SaleStatus } from "@/schemas/types/sales";
import { useState } from "react";
import { SaleForm } from "../-components/sale-form/index";
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
import { SaleStatusAction } from "../-components/sale-status-action";

export const Route = createFileRoute("/_app/sales/update/$saleId")({
	component: UpdateSalePage,
});

export function UpdateSalePage() {
	const ability = useAbility();
	const canViewSale = ability.can("access", "sales.view");
	const canUpdateSale = ability.can("access", "sales.update");
	const canCreateSale = ability.can("access", "sales.create");
	const canChangeSaleStatus = ability.can("access", "sales.status.change");
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
		return <FormPageSkeleton actionCount={5} sectionCount={4} />;
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
	const availableStatusTransitions =
		data.sale.status === "COMPLETED"
			? (["CANCELED"] as SaleStatus[])
			: undefined;

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
				description="Atualize os dados da venda e ajuste o status quando necessário."
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
							canViewSale={canViewSale}
							canEditSale={canEditSale}
							canChangeSaleStatus={
								canChangeSaleStatus && data.sale.status === "COMPLETED"
							}
							currentStatus={data.sale.status as SaleStatus}
							availableTransitionsOverride={availableStatusTransitions}
							canDeleteSale={canDeleteSalePermission}
							isDeleting={isDeletingSale}
							saleNavigationAction="details"
							onRequestDelete={() => setDeleteDialogOpen(true)}
						/>
						{canChangeSaleStatus && data.sale.status !== "COMPLETED" ? (
							<SaleStatusAction
								saleId={data.sale.id}
								currentStatus={data.sale.status as SaleStatus}
								buttonMode="modal-only"
								availableTransitionsOverride={availableStatusTransitions}
							/>
						) : null}
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
