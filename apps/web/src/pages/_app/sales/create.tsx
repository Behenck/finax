import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { useSale } from "@/hooks/sales";
import { SaleForm } from "./-components/sale-form";

const createSaleSearchSchema = z.object({
	customerId: z.uuid().optional(),
	duplicateSaleId: z.uuid().optional(),
});

export const Route = createFileRoute("/_app/sales/create")({
	validateSearch: (search) => createSaleSearchSchema.parse(search),
	component: CreateSalePage,
});

function CreateSalePage() {
	const { customerId, duplicateSaleId } = Route.useSearch();
	const duplicateSaleQuery = useSale(duplicateSaleId ?? "");

	if (duplicateSaleId && duplicateSaleQuery.isLoading) {
		return (
			<main className="w-full space-y-6">
				<span className="text-muted-foreground">Carregando venda para duplicação...</span>
			</main>
		);
	}

	if (duplicateSaleId && (duplicateSaleQuery.isError || !duplicateSaleQuery.data?.sale)) {
		return (
			<main className="w-full space-y-6">
				<span className="text-destructive">Não foi possível carregar a venda para duplicar.</span>
			</main>
		);
	}

	return (
		<main className="w-full space-y-6">
			<header className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-semibold">
						{duplicateSaleId ? "Duplicar Venda" : "Cadastrar Venda"}
					</h1>
					<span className="text-muted-foreground text-sm">
						{duplicateSaleId
							? "Revise os dados e confirme o novo cadastro baseado na venda selecionada."
							: "Preencha os dados para registrar uma nova venda."}
					</span>
				</div>
			</header>

			<SaleForm
				mode="CREATE"
				prefilledCustomerId={customerId}
				initialSale={duplicateSaleQuery.data?.sale}
			/>
		</main>
	);
}
