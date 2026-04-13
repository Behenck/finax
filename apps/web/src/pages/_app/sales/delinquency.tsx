import { createFileRoute, Link } from "@tanstack/react-router";
import { format, parse } from "date-fns";
import { Eye, RefreshCcw, ShieldAlert, TriangleAlert } from "lucide-react";
import { useMemo } from "react";
import { useQueryState } from "nuqs";
import { FilterPanel } from "@/components/filter-panel";
import { PageHeader } from "@/components/page-header";
import { ResponsiveDataView } from "@/components/responsive-data-view";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { useApp } from "@/context/app-context";
import { entityFilterParser, textFilterParser } from "@/hooks/filters/parsers";
import { useSalesDelinquency } from "@/hooks/sales";
import { useGetOrganizationsSlugCompanies } from "@/http/generated";
import { useAbility } from "@/permissions/access";
import type { SaleStatus } from "@/schemas/types/sales";
import { formatCurrencyBRL } from "@/utils/format-amount";
import { SaleDelinquencyBadge } from "./-components/sale-delinquency-badge";
import { SaleStatusBadge } from "./-components/sale-status-badge";

export const Route = createFileRoute("/_app/sales/delinquency")({
	component: SalesDelinquencyPage,
});

function formatDate(value: string) {
	return format(parse(value.slice(0, 10), "yyyy-MM-dd", new Date()), "dd/MM/yyyy");
}

export function SalesDelinquencyPage() {
	const { organization } = useApp();
	const ability = useAbility();
	const canViewSales = ability.can("access", "sales.view");
	const canManageSalesImports = ability.can("access", "sales.import.manage");
	const [search, setSearch] = useQueryState("q", textFilterParser);
	const [companyIdFilter, setCompanyIdFilter] = useQueryState(
		"companyId",
		entityFilterParser,
	);
	const [unitIdFilter, setUnitIdFilter] = useQueryState(
		"unitId",
		entityFilterParser,
	);
	const { data, isLoading, isError, refetch } = useSalesDelinquency();
	const slug = organization?.slug ?? "";
	const companiesQuery = useGetOrganizationsSlugCompanies(
		{ slug },
		{
			query: {
				enabled: Boolean(slug),
			},
		},
	);
	const companies = useMemo(
		() => companiesQuery.data?.companies ?? [],
		[companiesQuery.data?.companies],
	);
	const unitsBySelectedCompany = useMemo(() => {
		if (!companyIdFilter) {
			return [];
		}

		return (
			companies.find((company) => company.id === companyIdFilter)?.units ?? []
		);
	}, [companies, companyIdFilter]);
	const filteredSales = useMemo(() => {
		const normalizedSearch = search.trim().toLowerCase();
		const sales = data?.sales ?? [];

		return sales.filter((sale) => {
			if (companyIdFilter && sale.company.id !== companyIdFilter) {
				return false;
			}

			if (unitIdFilter && sale.unit?.id !== unitIdFilter) {
				return false;
			}

			if (!normalizedSearch) {
				return true;
			}

			const searchableContent = [
				sale.customer.name,
				sale.product.name,
				sale.company.name,
				sale.unit?.name,
				sale.responsible?.name,
			]
				.filter(Boolean)
				.join(" ")
				.toLowerCase();

			return searchableContent.includes(normalizedSearch);
		});
	}, [data?.sales, search, companyIdFilter, unitIdFilter]);
	const totalOpenOccurrences = filteredSales.reduce(
		(total, sale) => total + sale.delinquencySummary.openCount,
		0,
	);

	function clearFilters() {
		void setSearch("");
		void setCompanyIdFilter("");
		void setUnitIdFilter("");
	}

	if (!canViewSales) {
		return (
			<Card className="p-6">
				<span className="text-muted-foreground">
					Você não possui permissão para visualizar inadimplência das vendas.
				</span>
			</Card>
		);
	}

	if (isLoading) {
		return (
			<Card className="p-6">
				<span className="text-muted-foreground">Carregando inadimplência...</span>
			</Card>
		);
	}

	if (isError) {
		return (
			<Card className="p-6 flex flex-col gap-4">
				<p className="text-destructive">Erro ao carregar inadimplência.</p>
				<Button variant="outline" className="w-fit" onClick={() => refetch()}>
					<RefreshCcw className="size-4" />
					Tentar novamente
				</Button>
			</Card>
		);
	}

	return (
		<main className="w-full space-y-6">
			<PageHeader
				title="Inadimplência das Vendas"
				description="Veja rapidamente quais vendas têm parcelas em aberto e podem representar risco de estorno."
				actions={
					<div className="flex w-full flex-wrap gap-2 sm:w-auto">
						{canManageSalesImports ? (
							<Button variant="outline" asChild>
								<Link to="/sales/delinquency-import">
									<ShieldAlert className="size-4" />
									Importar inadimplência
								</Link>
							</Button>
						) : null}
						<Button variant="outline" asChild>
							<Link to="/sales">Voltar para vendas</Link>
						</Button>
					</div>
				}
			/>

			<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
				<Card className="p-5 space-y-2">
					<div className="flex items-center justify-between">
						<span className="text-sm font-medium">Vendas inadimplentes</span>
						<TriangleAlert className="size-4 text-rose-600" />
					</div>
					<p className="text-lg font-semibold">{filteredSales.length}</p>
				</Card>
				<Card className="p-5 space-y-2">
					<div className="flex items-center justify-between">
						<span className="text-sm font-medium">Ocorrências em aberto</span>
						<span className="text-xs text-muted-foreground">Total</span>
					</div>
					<p className="text-lg font-semibold">{totalOpenOccurrences}</p>
				</Card>
				<Card className="p-5 space-y-2">
					<div className="flex items-center justify-between">
						<span className="text-sm font-medium">Cliente mais urgente</span>
						<span className="text-xs text-muted-foreground">Mais antigo</span>
					</div>
					<p className="text-sm font-semibold">
						{filteredSales[0]?.customer.name ?? "Nenhum cliente encontrado"}
					</p>
					<p className="text-sm text-muted-foreground">
						{filteredSales[0]?.delinquencySummary.oldestDueDate
							? `Desde ${formatDate(filteredSales[0].delinquencySummary.oldestDueDate)}`
							: "Sem ocorrências abertas"}
					</p>
				</Card>
			</div>

			<FilterPanel className="lg:grid-cols-4 xl:grid-cols-5 xl:items-end">
				<div className="space-y-1 xl:col-span-2">
					<p className="text-xs text-muted-foreground">Busca</p>
					<Input
						placeholder="Buscar por cliente, produto, empresa ou responsável..."
						value={search}
						onChange={(event) => void setSearch(event.target.value)}
					/>
				</div>

				<div className="space-y-1">
					<p className="text-xs text-muted-foreground">Empresa</p>
					<Select
						value={companyIdFilter || "ALL"}
						onValueChange={(value) => {
							void setCompanyIdFilter(value === "ALL" ? "" : value);
							void setUnitIdFilter("");
						}}
					>
						<SelectTrigger>
							<SelectValue placeholder="Todas as empresas" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="ALL">Todas as empresas</SelectItem>
							{companies.map((company) => (
								<SelectItem key={company.id} value={company.id}>
									{company.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				<div className="space-y-1">
					<p className="text-xs text-muted-foreground">Unidade</p>
					<Select
						value={unitIdFilter || "ALL"}
						onValueChange={(value) => {
							void setUnitIdFilter(value === "ALL" ? "" : value);
						}}
						disabled={!companyIdFilter}
					>
						<SelectTrigger>
							<SelectValue placeholder="Todas as unidades" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="ALL">Todas as unidades</SelectItem>
							{unitsBySelectedCompany.map((unit) => (
								<SelectItem key={unit.id} value={unit.id}>
									{unit.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				<Button type="button" variant="outline" onClick={clearFilters}>
					<RefreshCcw className="size-4" />
					Limpar
				</Button>
			</FilterPanel>

			{filteredSales.length === 0 ? (
				<Card className="p-6 text-sm text-muted-foreground">
					Nenhuma venda inadimplente encontrada para os filtros aplicados.
				</Card>
			) : (
				<ResponsiveDataView
					mobile={
						<div className="space-y-3">
							{filteredSales.map((sale) => (
								<Card key={sale.id} className="space-y-3 border-rose-500/30 bg-rose-500/5 p-4">
									<div className="space-y-1">
										<p className="text-sm font-semibold">{sale.customer.name}</p>
										<p className="text-xs text-muted-foreground">
											{sale.product.name}
										</p>
									</div>

									<div className="grid grid-cols-2 gap-2 text-xs">
										<div className="space-y-0.5">
											<p className="text-muted-foreground">Empresa</p>
											<p>{sale.company.name}</p>
										</div>
										<div className="space-y-0.5">
											<p className="text-muted-foreground">Unidade</p>
											<p>{sale.unit?.name ?? "Sem unidade"}</p>
										</div>
										<div className="space-y-0.5">
											<p className="text-muted-foreground">Data da venda</p>
											<p>{formatDate(sale.saleDate)}</p>
										</div>
										<div className="space-y-0.5">
											<p className="text-muted-foreground">Valor</p>
											<p className="font-semibold">{formatCurrencyBRL(sale.totalAmount / 100)}</p>
										</div>
									</div>

									<div className="flex flex-wrap items-center gap-2">
										<SaleStatusBadge status={sale.status as SaleStatus} />
										<SaleDelinquencyBadge
											summary={sale.delinquencySummary}
											showOldestDueDate
										/>
									</div>

									<div className="rounded-md border border-rose-500/20 bg-rose-500/5 p-3 text-xs text-rose-800 dark:text-rose-200">
										<p className="font-medium">Vencimentos em aberto</p>
										<div className="mt-2 flex flex-wrap gap-2">
											{sale.openDelinquencies.map((occurrence) => (
												<span
													key={occurrence.id}
													className="rounded-full border border-rose-500/30 px-2 py-1"
												>
													{formatDate(occurrence.dueDate)}
												</span>
											))}
										</div>
									</div>

									<Button variant="outline" size="sm" asChild>
										<Link to="/sales/$saleId" params={{ saleId: sale.id }}>
											<Eye className="size-4" />
											Ver venda
										</Link>
									</Button>
								</Card>
							))}
						</div>
					}
					desktop={
						<div className="overflow-hidden rounded-md border bg-card">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Cliente</TableHead>
										<TableHead>Produto</TableHead>
										<TableHead>Empresa/Unidade</TableHead>
										<TableHead>Status</TableHead>
										<TableHead>Inadimplência</TableHead>
										<TableHead>Valor</TableHead>
										<TableHead></TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{filteredSales.map((sale) => (
										<TableRow key={sale.id}>
											<TableCell>
												<div className="space-y-1">
													<p className="font-medium">{sale.customer.name}</p>
													<p className="text-xs text-muted-foreground">
														{formatDate(sale.saleDate)}
													</p>
												</div>
											</TableCell>
											<TableCell>{sale.product.name}</TableCell>
											<TableCell>
												<div className="space-y-1 text-sm">
													<p>{sale.company.name}</p>
													<p className="text-xs text-muted-foreground">
														{sale.unit?.name ?? "Sem unidade"}
													</p>
												</div>
											</TableCell>
											<TableCell>
												<SaleStatusBadge status={sale.status as SaleStatus} />
											</TableCell>
											<TableCell>
												<div className="space-y-2">
													<SaleDelinquencyBadge
														summary={sale.delinquencySummary}
														showOldestDueDate
													/>
													<div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
														{sale.openDelinquencies.map((occurrence) => (
															<span key={occurrence.id}>{formatDate(occurrence.dueDate)}</span>
														))}
													</div>
												</div>
											</TableCell>
											<TableCell className="font-semibold">
												{formatCurrencyBRL(sale.totalAmount / 100)}
											</TableCell>
											<TableCell>
												<div className="flex justify-end">
													<Button variant="outline" size="sm" asChild>
														<Link to="/sales/$saleId" params={{ saleId: sale.id }}>
															<Eye className="size-4" />
															Ver venda
														</Link>
													</Button>
												</div>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</div>
					}
				/>
			)}
		</main>
	);
}
