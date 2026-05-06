import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DataTablePagination } from "@/components/data-table-pagination";
import { ListPageSkeleton } from "@/components/loading-skeletons";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import {
	partnerStatusFilterParser,
	textFilterParser,
} from "@/hooks/filters/parsers";
import { useTablePagination } from "@/hooks/filters/use-table-pagination";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2, Plus, Search, Users } from "lucide-react";
import { ListPartners } from "./-components/list-partners";
import { useApp } from "@/context/app-context";
import { useMemo } from "react";
import { useGetOrganizationsSlugPartners } from "@/http/generated";
import { useQueryState } from "nuqs";
import { formatCurrencyBRL } from "@/utils/format-amount";

export const Route = createFileRoute("/_app/registers/partners/")({
	component: PartnersPage,
});

export function PartnersPage() {
	const { organization } = useApp();
	const [search, setSearch] = useQueryState("q", textFilterParser);
	const [statusFilter, setStatusFilter] = useQueryState(
		"status",
		partnerStatusFilterParser,
	);
	const slug = organization?.slug ?? "";
	const { data, isLoading, isError } = useGetOrganizationsSlugPartners(
		{ slug },
		{ query: { enabled: Boolean(slug) } },
	);

	const partners = useMemo(() => data?.partners ?? [], [data?.partners]);

	const filteredPartners = useMemo(() => {
		const query = search.toLowerCase();
		const hasQuery = search.trim().length > 0;

		return partners.filter((partner) => {
			const matchesText =
				!hasQuery ||
				partner.name?.toLowerCase().includes(query) ||
				partner.companyName.toLowerCase().includes(query) ||
				partner.email?.toLowerCase().includes(query) ||
				partner.phone?.includes(query);
			const matchesStatus =
				statusFilter === "ALL" || partner.status === statusFilter;

			return matchesText && matchesStatus;
		});
	}, [partners, search, statusFilter]);

	const stats = useMemo(() => {
		const total = partners.length;

		const active = partners.filter(
			(partner) => partner.status === "ACTIVE",
		).length;
		const salesAmount = partners.reduce(
			(totalAmount, partner) => totalAmount + partner.currentMonthSalesAmount,
			0,
		);
		const salesCount = partners.reduce(
			(totalCount, partner) => totalCount + partner.currentMonthSalesCount,
			0,
		);
		const commissions = 0;

		return { total, active, salesAmount, salesCount, commissions };
	}, [partners]);

	const {
		currentPage,
		currentPageSize,
		totalItems,
		totalPages,
		paginatedItems: paginatedPartners,
		handlePageChange,
		handlePageSizeChange,
	} = useTablePagination({
		items: filteredPartners,
		resetKeys: [search, statusFilter],
	});

	if (isLoading) {
		return (
			<ListPageSkeleton
				actionCount={1}
				showStats
				statsCount={3}
				filterCount={2}
				itemCount={5}
			/>
		);
	}
	if (!organization) return null;
	if (isError)
		return <span className="text-destructive">Erro ao carregar parceiros</span>;

	return (
		<main className="w-full space-y-6">
			<PageHeader
				title="Gerenciar Parceiros"
				description="Gerencie seus parceiros comerciais"
				actions={
					<Link to="/registers/partners/create">
						<Button className="w-full sm:w-auto">
							<Plus />
							Novo Parceiro
						</Button>
					</Link>
				}
			/>

			<div className="hidden grid-cols-1 gap-3 md:grid md:grid-cols-2 xl:grid-cols-3">
				<Card className="p-6 gap-2 w-full">
					<div className="flex items-center justify-between">
						<span className="font-medium">Total de Parceiros</span>
						<Users className="w-5 h-5" />
					</div>
					<div className="flex flex-col">
						<span className="font-bold text-2xl">{stats.total}</span>
						<span className="text-xs">{stats.active} ativos</span>
					</div>
				</Card>
				<Card className="p-6 gap-2 w-full">
					<div className="flex items-center justify-between">
						<span className="font-medium">Vendas por parceiros</span>
						<Building2 className="w-5 h-5" />
					</div>
					<div className="flex flex-col">
						<span className="font-bold text-2xl">
							{formatCurrencyBRL(stats.salesAmount / 100)}
						</span>
						<span className="text-xs">{stats.salesCount} vendas no mês</span>
					</div>
				</Card>
				<Card className="p-6 gap-2 w-full">
					<div className="flex items-center justify-between">
						<span className="font-medium">Comissões Geradas</span>
						<Building2 className="w-5 h-5 text-green-600" />
					</div>
					<div className="flex flex-col">
						<span className="font-bold text-2xl text-green-600">
							{stats.commissions}
						</span>
						<span className="text-xs">Total em comissões</span>
					</div>
				</Card>
			</div>

			<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
				<div className="relative flex-1">
					<Search className="absolute left-5 top-1/2 -translate-1/2 size-4 text-muted-foreground" />
					<Input
						placeholder="Buscar por nome..."
						className="h-10 w-full pl-10 sm:max-w-md"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
					/>
				</div>

				<Select
					value={statusFilter}
					onValueChange={(value) =>
						setStatusFilter(value as "ALL" | "ACTIVE" | "INACTIVE")
					}
				>
					<SelectTrigger className="h-10 w-full sm:w-48">
						<SelectValue placeholder="Status" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="ALL">Todos os status</SelectItem>
						<SelectItem value="ACTIVE">Ativos</SelectItem>
						<SelectItem value="INACTIVE">Inativos</SelectItem>
					</SelectContent>
				</Select>
			</div>

			<section className="space-y-4">
				<ListPartners partners={paginatedPartners} allPartners={partners} />
				<DataTablePagination
					page={currentPage}
					pageSize={currentPageSize}
					totalItems={totalItems}
					totalPages={totalPages}
					onPageChange={handlePageChange}
					onPageSizeChange={handlePageSizeChange}
				/>
			</section>
		</main>
	);
}
