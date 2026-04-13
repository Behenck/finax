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
import {
	ClipboardPlus,
	FileSpreadsheet,
	Funnel,
	Plus,
	ShieldAlert,
	TriangleAlert,
} from "lucide-react";
import { useState } from "react";
import { SalesDataTable } from "./-components/sales-data-table";

const SALES_FILTERS_STORAGE_KEY = "finax:sales:list:filters";

function hasActiveStoredSalesFilters() {
	if (typeof window === "undefined") {
		return false;
	}

	try {
		const rawValue = window.localStorage.getItem(SALES_FILTERS_STORAGE_KEY);
		if (!rawValue) {
			return false;
		}

		const storedFilters = JSON.parse(rawValue) as {
			q?: string;
			status?: string;
			companyId?: string;
			unitId?: string;
			responsibleType?: string;
			responsibleId?: string;
		};

		return Boolean(
			(storedFilters.q ?? "").trim() ||
				(storedFilters.status ?? "ALL") !== "ALL" ||
				(storedFilters.companyId ?? "").trim() ||
				(storedFilters.unitId ?? "").trim() ||
				(storedFilters.responsibleType ?? "ALL") !== "ALL" ||
				(storedFilters.responsibleId ?? "").trim(),
		);
	} catch {
		return false;
	}
}

export const Route = createFileRoute("/_app/sales/")({
	component: SalesPage,
});

export function SalesPage() {
	const ability = useAbility();
	const canViewSales = ability.can("access", "sales.view");
	const canCreateSales = ability.can("access", "sales.create");
	const canManageSalesImports = ability.can("access", "sales.import.manage");
	const [isFiltersVisible, setIsFiltersVisible] = useState(() =>
		hasActiveStoredSalesFilters(),
	);
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
						<Button
							type="button"
							variant="outline"
							className="w-full sm:w-auto"
							onClick={() => setIsFiltersVisible((currentValue) => !currentValue)}
						>
							<Funnel className="size-4" />
							Filtro
						</Button>
						{canManageSalesImports ? (
							<>
								<Button asChild variant="outline" className="w-full sm:w-auto">
									<Link to="/sales/import">
										<FileSpreadsheet className="size-4" />
										Importar Vendas
									</Link>
								</Button>
								<Button asChild variant="outline" className="w-full sm:w-auto">
									<Link to="/sales/delinquency-import">
										<ShieldAlert className="size-4" />
										Importar Inadimplência
									</Link>
								</Button>
							</>
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
				showFilters={isFiltersVisible}
				onRetry={() => refetch()}
			/>
		</main>
	);
}
