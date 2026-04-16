import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { useSale } from "@/hooks/sales";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAbility } from "@/permissions/access";
import { ArrowLeft, ClipboardPlus } from "lucide-react";
import { SaleForm } from "./-components/sale-form/index";

const createSaleSearchSchema = z.object({
	customerId: z.uuid().optional(),
	duplicateSaleId: z.uuid().optional(),
});

export const Route = createFileRoute("/_app/sales/create")({
	validateSearch: (search) => createSaleSearchSchema.parse(search),
	component: CreateSalePage,
});

function CreateSalePage() {
	const ability = useAbility();
	const canCreateSale = ability.can("access", "sales.create");
	const { customerId, duplicateSaleId } = Route.useSearch();
	const duplicateSaleQuery = useSale(duplicateSaleId ?? "");

	if (!canCreateSale) {
		return (
			<Card className="p-6">
				<span className="text-muted-foreground">
					Você não possui permissão para cadastrar vendas.
				</span>
			</Card>
		);
	}

	if (duplicateSaleId && duplicateSaleQuery.isLoading) {
		return (
			<main className="w-full space-y-6">
				<span className="text-muted-foreground">
					Carregando venda para duplicação...
				</span>
			</main>
		);
	}

	if (
		duplicateSaleId &&
		(duplicateSaleQuery.isError || !duplicateSaleQuery.data?.sale)
	) {
		return (
			<main className="w-full space-y-6">
				<span className="text-destructive">
					Não foi possível carregar a venda para duplicar.
				</span>
			</main>
		);
	}

	return (
		<main className="w-full space-y-6">
			<PageHeader
				title={duplicateSaleId ? "Duplicar Venda" : "Cadastrar Venda"}
				description={
					duplicateSaleId
						? "Revise os dados e confirme o novo cadastro baseado na venda selecionada."
						: "Preencha os dados para registrar uma nova venda."
				}
				actions={
					<>
						<Button asChild variant="outline" className="w-full sm:w-auto">
							<Link to="/sales">
								<ArrowLeft className="size-4" />
								Voltar
							</Link>
						</Button>
						<Button asChild variant="outline" className="w-full sm:w-auto">
							<Link to="/sales/quick-create">
								<ClipboardPlus className="size-4" />
								Mudar para venda em massa
							</Link>
						</Button>
					</>
				}
			/>

			<SaleForm
				mode="CREATE"
				prefilledCustomerId={customerId}
				initialSale={duplicateSaleQuery.data?.sale}
			/>
		</main>
	);
}
