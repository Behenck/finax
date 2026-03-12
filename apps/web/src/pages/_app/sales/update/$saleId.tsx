import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { useSale } from "@/hooks/sales";
import { createFileRoute } from "@tanstack/react-router";
import { SaleForm } from "../-components/sale-form";

export const Route = createFileRoute("/_app/sales/update/$saleId")({
	component: UpdateSalePage,
});

function UpdateSalePage() {
	const { saleId } = Route.useParams();
	const { data, isLoading, isError } = useSale(saleId);

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
				<span className="text-destructive">Não foi possível carregar a venda.</span>
			</Card>
		);
	}

	return (
		<main className="w-full space-y-6">
			<PageHeader
				title="Editar Venda"
				description="Atualize os dados da venda sem alterar o status."
			/>

			<SaleForm mode="UPDATE" initialSale={data.sale} />
		</main>
	);
}
