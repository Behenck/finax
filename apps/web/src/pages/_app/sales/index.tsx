import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/page-header";
import { useSales } from "@/hooks/sales";
import { useAbility } from "@/permissions/access";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ClipboardPlus, FileSpreadsheet, Plus, TriangleAlert } from "lucide-react";
import { SalesDataTable } from "./-components/sales-data-table";

export const Route = createFileRoute("/_app/sales/")({
	component: SalesPage,
});

function SalesPage() {
	const ability = useAbility();
	const canViewSales = ability.can("access", "sales.view");
	const canCreateSales = ability.can("access", "sales.create");
	const canManageSalesImports = ability.can("access", "sales.import.manage");
	const { data, isLoading, isError, refetch } = useSales();
	const sales = data?.sales ?? [];

	if (!canViewSales) {
		return (
			<Card className="p-6">
				<span className="text-muted-foreground">
					Você não possui permissão para visualizar vendas.
				</span>
			</Card>
		);
	}

	return (
		<main className="w-full min-w-0 space-y-6">
			<PageHeader
				title="Gerenciar Vendas"
				description="Acompanhe, edite e atualize o status das vendas da organização."
				actions={
					<>
						<Button asChild variant="outline" className="w-full sm:w-auto">
							<Link to="/sales/delinquency">
								<TriangleAlert className="size-4" />
								Inadimplência
							</Link>
						</Button>
						{canManageSalesImports ? (
							<Button asChild variant="outline" className="w-full sm:w-auto">
								<Link to="/sales/import">
									<FileSpreadsheet className="size-4" />
									Importar Planilha
								</Link>
							</Button>
						) : null}
						{canCreateSales ? (
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button className="w-full sm:w-auto">
										<Plus className="size-4" />
										Adicionar venda
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end" className="w-52">
									<DropdownMenuItem asChild>
										<Link to="/sales/create">
											<Plus className="size-4" />
											Nova venda
										</Link>
									</DropdownMenuItem>
									<DropdownMenuItem asChild>
										<Link to="/sales/quick-create">
											<ClipboardPlus className="size-4" />
											Venda em massa
										</Link>
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						) : null}
					</>
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
