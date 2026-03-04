import { Button } from "@/components/ui/button";
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
			<header className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-semibold">Gerenciar Vendas</h1>
					<span className="text-muted-foreground text-sm">
						Acompanhe, edite e atualize o status das vendas da organização.
					</span>
				</div>

				<Button asChild>
					<Link to="/sales/create">
						<Plus className="size-4" />
						Nova Venda
					</Link>
				</Button>
			</header>

			<SalesDataTable
				sales={sales}
				isLoading={isLoading}
				isError={isError}
				onRetry={() => refetch()}
			/>
		</main>
	);
}

