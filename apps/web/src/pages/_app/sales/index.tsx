import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { useSales } from "@/hooks/sales";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { SalesDataTable } from "./-components/sales-data-table";

export const Route = createFileRoute("/_app/sales/")({
	component: SalesPage,
});

function SalesPage() {
	const { data, isLoading, isError, refetch } = useSales();
	const sales = data?.sales ?? [];

	return (
		<main className="w-full space-y-6">
			<PageHeader
				title="Gerenciar Vendas"
				description="Acompanhe, edite e atualize o status das vendas da organização."
				actions={
					<Button asChild className="w-full sm:w-auto">
						<Link to="/sales/create">
							<Plus className="size-4" />
							Nova Venda
						</Link>
					</Button>
				}
			/>

			<SalesDataTable
				sales={sales}
				isLoading={isLoading}
				isError={isError}
				onRetry={() => refetch()}
			/>
		</main>
	);
}
