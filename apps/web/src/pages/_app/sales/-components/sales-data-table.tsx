import { Link } from "@tanstack/react-router";
import {
	type ColumnDef,
	type ColumnFiltersState,
	type FilterFn,
	flexRender,
	getCoreRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	type RowSelectionState,
	type SortingState,
	useReactTable,
	type VisibilityState,
} from "@tanstack/react-table";
import { format, parse, parseISO } from "date-fns";
import {
	ArrowUpDown,
	Copy,
	EllipsisVertical,
	Eye,
	ListFilter,
	ListTree,
	Pencil,
	Plus,
	RefreshCcw,
	Trash2,
} from "lucide-react";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useEffect, useMemo, useRef, useState } from "react";
import { FilterPanel } from "@/components/filter-panel";
import { ResponsiveDataView } from "@/components/responsive-data-view";
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
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
	useDeleteSale,
	useDeleteSalesBulk,
	usePatchSalesStatusBulk,
} from "@/hooks/sales";
import {
	type GetOrganizationsSlugSales200,
	useGetOrganizationsSlugCompanies,
	useGetOrganizationsSlugProducts,
} from "@/http/generated";
import { useAbility } from "@/permissions/access";
import {
	SALE_STATUS_LABEL,
	SALE_STATUS_TRANSITIONS,
	type SaleStatus,
	SaleStatusSchema,
} from "@/schemas/types/sales";
import { formatCurrencyBRL } from "@/utils/format-amount";
import { SaleInstallmentsDrawer } from "./sale-installments-drawer";
import { SaleStatusAction } from "./sale-status-action";
import { SaleStatusBadge } from "./sale-status-badge";

type SaleRow = GetOrganizationsSlugSales200["sales"][number];
type SaleTableRow = SaleRow & {
	productLabel: string;
};

type ProductTreeNode = {
	id: string;
	name: string;
	children?: ProductTreeNode[];
};

const SALE_STATUS_FILTER_VALUES = [
	"ALL",
	"PENDING",
	"APPROVED",
	"COMPLETED",
	"CANCELED",
] as const;

type SaleStatusFilter = (typeof SALE_STATUS_FILTER_VALUES)[number];

const SALE_STATUS_SORT_PRIORITY: Record<SaleStatus, number> = {
	PENDING: 0,
	APPROVED: 1,
	COMPLETED: 2,
	CANCELED: 3,
};

const saleStatusFilterParser = parseAsStringLiteral(SALE_STATUS_FILTER_VALUES)
	.withDefault("ALL")
	.withOptions({ history: "replace" });

const SALES_FILTERS_STORAGE_KEY = "finax:sales:list:filters";
const SALES_COLUMNS_STORAGE_KEY = "finax:sales:list:columns";

function readStorageJson<T>(key: string, fallback: T): T {
	if (typeof window === "undefined") {
		return fallback;
	}

	try {
		const rawValue = window.localStorage.getItem(key);
		if (!rawValue) {
			return fallback;
		}

		return JSON.parse(rawValue) as T;
	} catch {
		return fallback;
	}
}

function formatSaleDate(value: string) {
	const dateOnly = value.slice(0, 10);
	const parsedDate = parse(dateOnly, "yyyy-MM-dd", new Date());
	return format(parsedDate, "dd/MM/yyyy");
}

function formatDateTime(value: string) {
	return format(parseISO(value), "dd/MM/yyyy HH:mm");
}

function buildProductPathMap(
	nodes: ProductTreeNode[],
	parentPath: string[] = [],
	map = new Map<string, string>(),
) {
	for (const node of nodes) {
		const currentPath = [...parentPath, node.name];
		map.set(node.id, currentPath.join(" -> "));

		const children = Array.isArray(node.children) ? node.children : [];
		buildProductPathMap(children, currentPath, map);
	}

	return map;
}

const salesGlobalFilterFn: FilterFn<SaleTableRow> = (
	row,
	_columnId,
	filterValue,
) => {
	const term = String(filterValue ?? "")
		.trim()
		.toLowerCase();
	if (!term) {
		return true;
	}

	const searchableContent = [
		row.original.customer.name,
		row.original.productLabel,
		row.original.company.name,
		row.original.unit?.name,
		row.original.responsible?.name,
		row.original.notes,
		SALE_STATUS_LABEL[row.original.status as SaleStatus],
	]
		.filter(Boolean)
		.join(" ")
		.toLowerCase();

	return searchableContent.includes(term);
};

interface SalesDataTableProps {
	sales: SaleRow[];
	isLoading: boolean;
	isError: boolean;
	onRetry: () => void;
}

interface SaleTableRowActionsProps {
	sale: SaleTableRow;
	onOpenInstallments(sale: SaleTableRow): void;
}

function SaleTableRowActions({
	sale,
	onOpenInstallments,
}: SaleTableRowActionsProps) {
	const ability = useAbility();
	const canUpdateSale = ability.can("access", "sales.update");
	const canDuplicateSale = ability.can("access", "sales.create");
	const canChangeSaleStatus = ability.can("access", "sales.status.change");
	const canDeleteSalePermission = ability.can("access", "sales.delete");
	const canManageCommissions = ability.can("access", "sales.commissions.manage");
	const canChangeCommissionInstallmentStatus = ability.can(
		"access",
		"sales.commissions.installments.status.change",
	);
	const canUpdateCommissionInstallment = ability.can(
		"access",
		"sales.commissions.installments.update",
	);
	const canDeleteCommissionInstallment = ability.can(
		"access",
		"sales.commissions.installments.delete",
	);
	const canAccessCommissionInstallments =
		canManageCommissions ||
		canChangeCommissionInstallmentStatus ||
		canUpdateCommissionInstallment ||
		canDeleteCommissionInstallment;
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const { mutateAsync: deleteSale, isPending } = useDeleteSale();

	async function handleConfirmDelete() {
		try {
			await deleteSale({
				saleId: sale.id,
			});
			setDeleteDialogOpen(false);
		} catch {
			// erro tratado no hook
		}
	}

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button variant="ghost" size="icon" disabled={isPending}>
						<EllipsisVertical className="size-4" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					<DropdownMenuLabel>Ações</DropdownMenuLabel>
					<DropdownMenuSeparator />
					<DropdownMenuItem asChild>
						<Link to="/sales/$saleId" params={{ saleId: sale.id }}>
							<Eye className="size-4" />
							Ver detalhes
						</Link>
					</DropdownMenuItem>
					{canUpdateSale ? (
						<DropdownMenuItem asChild>
							<Link to="/sales/update/$saleId" params={{ saleId: sale.id }}>
								<Pencil className="size-4" />
								Editar
							</Link>
						</DropdownMenuItem>
					) : null}
					{canDuplicateSale ? (
						<DropdownMenuItem asChild>
							<Link
								to="/sales/create"
								search={{
									duplicateSaleId: sale.id,
								}}
							>
								<Copy className="size-4" />
								Duplicar
							</Link>
						</DropdownMenuItem>
					) : null}
					{canAccessCommissionInstallments ? (
						<DropdownMenuItem
							onSelect={(event) => {
								event.preventDefault();
								onOpenInstallments(sale);
							}}
						>
							<ListTree className="size-4" />
							Ver parcelas
						</DropdownMenuItem>
					) : null}
					{canChangeSaleStatus ? (
						<>
							<DropdownMenuSeparator />
							<SaleStatusAction
								saleId={sale.id}
								currentStatus={sale.status as SaleStatus}
								trigger="dropdown-item"
							/>
						</>
					) : null}
					{canDeleteSalePermission ? (
						<>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								variant="destructive"
								disabled={isPending}
								onSelect={(event) => {
									event.preventDefault();
									setDeleteDialogOpen(true);
								}}
							>
								<Trash2 className="size-4" />
								Excluir
							</DropdownMenuItem>
						</>
					) : null}
				</DropdownMenuContent>
			</DropdownMenu>

			<AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Excluir venda</AlertDialogTitle>
						<AlertDialogDescription>
							Tem certeza que deseja excluir a venda do cliente{" "}
							<strong>{sale.customer.name}</strong>? Esta ação não pode ser
							desfeita.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
						<AlertDialogAction
							variant="destructive"
							onClick={handleConfirmDelete}
							disabled={isPending}
						>
							{isPending ? "Excluindo..." : "Excluir venda"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}

export function SalesDataTable({
	sales,
	isLoading,
	isError,
	onRetry,
}: SalesDataTableProps) {
	const ability = useAbility();
	const canCreateSale = ability.can("access", "sales.create");
	const canUpdateSale = ability.can("access", "sales.update");
	const canChangeSaleStatus = ability.can("access", "sales.status.change");
	const canDeleteSale = ability.can("access", "sales.delete");
	const canManageCommissions = ability.can("access", "sales.commissions.manage");
	const canChangeCommissionInstallmentStatus = ability.can(
		"access",
		"sales.commissions.installments.status.change",
	);
	const canUpdateCommissionInstallment = ability.can(
		"access",
		"sales.commissions.installments.update",
	);
	const canDeleteCommissionInstallment = ability.can(
		"access",
		"sales.commissions.installments.delete",
	);
	const canAccessCommissionInstallments =
		canManageCommissions ||
		canChangeCommissionInstallmentStatus ||
		canUpdateCommissionInstallment ||
		canDeleteCommissionInstallment;
	const canUseBulkActions = canChangeSaleStatus || canDeleteSale;
	const { organization } = useApp();
	const slug = organization?.slug ?? "";
	const [sorting, setSorting] = useState<SortingState>([]);
	const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
		() => readStorageJson<VisibilityState>(SALES_COLUMNS_STORAGE_KEY, {}),
	);
	const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
	const [bulkStatus, setBulkStatus] = useState<SaleStatus | "">("");
	const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
	const restoredFiltersRef = useRef(false);
	const [globalFilter, setGlobalFilter] = useQueryState("q", textFilterParser);
	const [companyIdFilter, setCompanyIdFilter] = useQueryState(
		"companyId",
		entityFilterParser,
	);
	const [unitIdFilter, setUnitIdFilter] = useQueryState(
		"unitId",
		entityFilterParser,
	);
	const [statusFilter, setStatusFilter] = useQueryState(
		"status",
		saleStatusFilterParser,
	);
	const { mutateAsync: patchSalesStatusBulk, isPending: isBulkStatusPending } =
		usePatchSalesStatusBulk();
	const { mutateAsync: deleteSalesBulk, isPending: isBulkDeletePending } =
		useDeleteSalesBulk();
	const columnFilters = useMemo<ColumnFiltersState>(
		() =>
			statusFilter === "ALL" ? [] : [{ id: "status", value: statusFilter }],
		[statusFilter],
	);
	const [installmentsDrawerSale, setInstallmentsDrawerSale] =
		useState<SaleTableRow | null>(null);

	useEffect(() => {
		if (typeof window === "undefined") {
			return;
		}

		window.localStorage.setItem(
			SALES_COLUMNS_STORAGE_KEY,
			JSON.stringify(columnVisibility),
		);
	}, [columnVisibility]);

	useEffect(() => {
		if (restoredFiltersRef.current) {
			return;
		}

		restoredFiltersRef.current = true;
		const storedFilters = readStorageJson<{
			q?: string;
			status?: SaleStatusFilter;
			companyId?: string;
			unitId?: string;
		}>(SALES_FILTERS_STORAGE_KEY, {});

		if (!globalFilter && storedFilters.q) {
			void setGlobalFilter(storedFilters.q);
		}

		if (
			statusFilter === "ALL" &&
			storedFilters.status &&
			storedFilters.status !== "ALL"
		) {
			void setStatusFilter(storedFilters.status);
		}

		if (!companyIdFilter && storedFilters.companyId) {
			void setCompanyIdFilter(storedFilters.companyId);
		}

		if (!unitIdFilter && storedFilters.unitId) {
			void setUnitIdFilter(storedFilters.unitId);
		}
	}, [
		companyIdFilter,
		globalFilter,
		setCompanyIdFilter,
		setGlobalFilter,
		setStatusFilter,
		setUnitIdFilter,
		statusFilter,
		unitIdFilter,
	]);

	useEffect(() => {
		if (typeof window === "undefined") {
			return;
		}

		window.localStorage.setItem(
			SALES_FILTERS_STORAGE_KEY,
			JSON.stringify({
				q: globalFilter,
				status: statusFilter,
				companyId: companyIdFilter,
				unitId: unitIdFilter,
			}),
		);
	}, [companyIdFilter, globalFilter, statusFilter, unitIdFilter]);
	const productsQuery = useGetOrganizationsSlugProducts(
		{ slug },
		{
			query: {
				enabled: Boolean(organization?.slug),
			},
		},
	);
	const companiesQuery = useGetOrganizationsSlugCompanies(
		{ slug },
		{
			query: {
				enabled: Boolean(organization?.slug),
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

		return companies.find((company) => company.id === companyIdFilter)?.units ?? [];
	}, [companies, companyIdFilter]);

	useEffect(() => {
		if (!unitIdFilter || !companyIdFilter) {
			return;
		}

		const unitExistsInSelectedCompany = unitsBySelectedCompany.some(
			(unit) => unit.id === unitIdFilter,
		);
		if (!unitExistsInSelectedCompany) {
			void setUnitIdFilter("");
		}
	}, [companyIdFilter, setUnitIdFilter, unitIdFilter, unitsBySelectedCompany]);
	const productPathById = useMemo(
		() =>
			buildProductPathMap(
				(productsQuery.data?.products ?? []) as ProductTreeNode[],
			),
		[productsQuery.data?.products],
	);
	const filteredSales = useMemo(
		() =>
			sales.filter((sale) => {
				const matchesCompany =
					!companyIdFilter || sale.company.id === companyIdFilter;
				const matchesUnit = !unitIdFilter || sale.unit?.id === unitIdFilter;
				return matchesCompany && matchesUnit;
			}),
		[companyIdFilter, sales, unitIdFilter],
	);
	const tableData = useMemo<SaleTableRow[]>(
		() =>
			filteredSales
				.map((sale) => ({
					...sale,
					productLabel:
						productPathById.get(sale.product.id) ?? sale.product.name,
				}))
				.sort((saleA, saleB) => {
					const statusDiff =
						(SALE_STATUS_SORT_PRIORITY[saleA.status as SaleStatus] ??
							Number.MAX_SAFE_INTEGER) -
						(SALE_STATUS_SORT_PRIORITY[saleB.status as SaleStatus] ??
							Number.MAX_SAFE_INTEGER);

					if (statusDiff !== 0) {
						return statusDiff;
					}

					return saleB.createdAt.localeCompare(saleA.createdAt);
				}),
		[filteredSales, productPathById],
	);

	const columns = useMemo<ColumnDef<SaleTableRow>[]>(
		() => [
			{
				id: "select",
				enableHiding: false,
				header: ({ table }) => (
					<Checkbox
						checked={
							canUseBulkActions
								? table.getIsAllPageRowsSelected()
									? true
									: table.getIsSomePageRowsSelected()
										? "indeterminate"
										: false
								: false
						}
						onCheckedChange={(value) => {
							if (!canUseBulkActions) {
								return;
							}
							table.toggleAllPageRowsSelected(Boolean(value));
						}}
						disabled={!canUseBulkActions}
						aria-label="Selecionar página atual"
					/>
				),
				cell: ({ row }) => (
					<Checkbox
						checked={row.getIsSelected()}
						onCheckedChange={(value) => {
							if (!canUseBulkActions) {
								return;
							}
							row.toggleSelected(Boolean(value));
						}}
						disabled={!canUseBulkActions}
						aria-label={`Selecionar venda ${row.original.id}`}
					/>
				),
			},
			{
				accessorKey: "saleDate",
				header: ({ column }) => (
					<Button
						variant="ghost"
						className="h-8 px-2"
						onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
					>
						Data
						<ArrowUpDown className="ml-2 size-4" />
					</Button>
				),
				cell: ({ row }) => formatSaleDate(row.original.saleDate),
			},
			{
				accessorKey: "customer",
				header: "Cliente",
				cell: ({ row }) => row.original.customer.name,
			},
			{
				accessorKey: "productLabel",
				header: "Produto",
				cell: ({ row }) => row.original.productLabel,
			},
			{
				id: "companyUnit",
				header: "Empresa/Unidade",
				cell: ({ row }) => (
					<div className="flex flex-col">
						<span>{row.original.company.name}</span>
						<span className="text-xs text-muted-foreground">
							{row.original.unit?.name ?? "Sem unidade"}
						</span>
					</div>
				),
			},
			{
				accessorKey: "responsible",
				header: "Responsável",
				cell: ({ row }) => (
					<div className="flex flex-col">
						<span>{row.original.responsible?.name ?? "Não informado"}</span>
						<span className="text-xs text-muted-foreground">
							{row.original.responsible
								? row.original.responsible.type === "SELLER"
									? "Vendedor"
									: "Parceiro"
								: "Sem vínculo"}
						</span>
					</div>
				),
			},
			{
				accessorKey: "totalAmount",
				header: ({ column }) => (
					<Button
						variant="ghost"
						className="h-8 px-2"
						onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
					>
						Valor
						<ArrowUpDown className="ml-2 size-4" />
					</Button>
				),
				cell: ({ row }) => (
					<span className="font-semibold">
						{formatCurrencyBRL(row.original.totalAmount / 100)}
					</span>
				),
			},
			{
				id: "commissionInstallments",
				header: "Parcelas",
				cell: ({ row }) => {
					const summary = row.original.commissionInstallmentsSummary;
					if (!canAccessCommissionInstallments) {
						return (
							<span className="text-sm text-muted-foreground">
								{summary.total === 0
									? "Sem parcelas"
									: `${summary.paid}/${summary.total} pagas`}
							</span>
						);
					}
					return (
						<Button
							type="button"
							variant="ghost"
							className="h-auto px-2 py-1 justify-start"
							onClick={() => setInstallmentsDrawerSale(row.original)}
						>
							{summary.total === 0
								? "Sem parcelas"
								: `${summary.paid}/${summary.total} pagas`}
						</Button>
					);
				},
			},
			{
				accessorKey: "status",
				header: "Status",
				filterFn: (row, columnId, value) => {
					if (!value) {
						return true;
					}

					return row.getValue(columnId) === value;
				},
				cell: ({ row }) => (
					<SaleStatusBadge status={row.original.status as SaleStatus} />
				),
			},
			{
				accessorKey: "updatedAt",
				header: ({ column }) => (
					<Button
						variant="ghost"
						className="h-8 px-2"
						onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
					>
						Atualização
						<ArrowUpDown className="ml-2 size-4" />
					</Button>
				),
				cell: ({ row }) => formatDateTime(row.original.updatedAt),
			},
			{
				id: "actions",
				enableHiding: false,
				header: "",
				cell: ({ row }) => (
					<div className="flex justify-end">
						<SaleTableRowActions
							sale={row.original}
							onOpenInstallments={(sale) => setInstallmentsDrawerSale(sale)}
						/>
					</div>
				),
			},
		],
		[canAccessCommissionInstallments, canUseBulkActions],
	);

	const table = useReactTable({
		data: tableData,
		columns,
		state: {
			sorting,
			columnFilters,
			columnVisibility,
			globalFilter,
			rowSelection,
		},
		getRowId: (row) => row.id,
		onSortingChange: setSorting,
		onColumnVisibilityChange: setColumnVisibility,
		onRowSelectionChange: setRowSelection,
		enableRowSelection: true,
		globalFilterFn: salesGlobalFilterFn,
		getCoreRowModel: getCoreRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
	});

	const selectedSales = table
		.getSelectedRowModel()
		.rows.map((row) => row.original);
	const selectedSaleIds = selectedSales.map((sale) => sale.id);

	const availableBulkStatuses = useMemo<SaleStatus[]>(() => {
		if (selectedSales.length === 0) {
			return [];
		}

		const allowedStatuses = selectedSales.reduce<Set<SaleStatus>>(
			(accumulator, sale, index) => {
				const saleAllowedStatuses = new Set(
					SALE_STATUS_TRANSITIONS[sale.status as SaleStatus],
				);

				if (index === 0) {
					return saleAllowedStatuses;
				}

				return new Set(
					Array.from(accumulator).filter((status) =>
						saleAllowedStatuses.has(status),
					),
				);
			},
			new Set<SaleStatus>(),
		);

		return SaleStatusSchema.options.filter((status) =>
			allowedStatuses.has(status),
		);
	}, [selectedSales]);

	useEffect(() => {
		if (!bulkStatus) {
			return;
		}

		if (!availableBulkStatuses.includes(bulkStatus)) {
			setBulkStatus("");
		}
	}, [availableBulkStatuses, bulkStatus]);

	async function handleApplyBulkStatus() {
		if (!bulkStatus || selectedSaleIds.length === 0) {
			return;
		}

		try {
			await patchSalesStatusBulk({
				saleIds: selectedSaleIds,
				status: bulkStatus,
			});
			setRowSelection({});
			setBulkStatus("");
		} catch {
			// erro tratado no hook
		}
	}

	async function handleConfirmBulkDelete() {
		if (selectedSaleIds.length === 0) {
			return;
		}

		try {
			await deleteSalesBulk({
				saleIds: selectedSaleIds,
			});
			setRowSelection({});
			setBulkStatus("");
			setBulkDeleteDialogOpen(false);
		} catch {
			// erro tratado no hook
		}
	}

	function clearFilters() {
		setRowSelection({});
		void setGlobalFilter("");
		void setStatusFilter("ALL");
		void setCompanyIdFilter("");
		void setUnitIdFilter("");
	}

	if (isLoading) {
		return (
			<Card className="p-6">
				<span className="text-muted-foreground">Carregando vendas...</span>
			</Card>
		);
	}

	if (isError) {
		return (
			<Card className="p-6 flex flex-col gap-4">
				<p className="text-destructive">Erro ao carregar vendas.</p>
				<Button variant="outline" className="w-fit" onClick={onRetry}>
					<RefreshCcw className="size-4" />
					Tentar novamente
				</Button>
			</Card>
		);
	}

	if (sales.length === 0) {
		return (
			<Card className="p-6 flex flex-col gap-4">
				<div className="flex flex-col gap-1">
					<h2 className="font-semibold text-lg">Nenhuma venda cadastrada</h2>
					<p className="text-sm text-muted-foreground">
						Cadastre sua primeira venda para começar a acompanhar o pipeline.
					</p>
				</div>
				{canCreateSale ? (
					<Button asChild className="w-fit">
						<Link to="/sales/create">
							<Plus className="size-4" />
							Nova Venda
						</Link>
					</Button>
				) : null}
			</Card>
		);
	}

	return (
		<div className="space-y-4">
			<FilterPanel className="lg:grid-cols-4 xl:grid-cols-6 xl:items-end">
				<div className="space-y-1 xl:col-span-2">
					<p className="text-xs text-muted-foreground">Busca</p>
					<Input
						placeholder="Buscar por cliente, produto (com hierarquia) ou empresa..."
						value={globalFilter}
						onChange={(event) => setGlobalFilter(event.target.value)}
						className="w-full"
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
						<SelectTrigger className="w-full">
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
						<SelectTrigger className="w-full">
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

				<div className="space-y-1">
					<p className="text-xs text-muted-foreground">Status</p>
					<Select
						value={statusFilter}
						onValueChange={(value) => {
							setStatusFilter(value as SaleStatusFilter);
						}}
					>
						<SelectTrigger className="w-full">
							<SelectValue placeholder="Status" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="ALL">Todos os status</SelectItem>
							{SaleStatusSchema.options.map((status) => (
								<SelectItem key={status} value={status}>
									{SALE_STATUS_LABEL[status]}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				<Button
					type="button"
					variant="outline"
					className="w-full xl:justify-self-stretch"
					onClick={clearFilters}
				>
					<RefreshCcw className="size-4" />
					Limpar
				</Button>
			</FilterPanel>

			<div className="flex justify-end">
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="outline" className="w-full sm:w-auto">
							<ListFilter className="size-4" />
							Colunas
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						{table
							.getAllColumns()
							.filter((column) => column.getCanHide())
							.map((column) => (
								<DropdownMenuCheckboxItem
									key={column.id}
									className="capitalize"
									checked={column.getIsVisible()}
									onCheckedChange={(value) =>
										column.toggleVisibility(Boolean(value))
									}
								>
									{column.id === "saleDate"
										? "data"
										: column.id === "customer"
											? "cliente"
											: column.id === "productLabel"
												? "produto"
												: column.id === "companyUnit"
													? "empresa/unidade"
													: column.id === "responsible"
														? "responsável"
														: column.id === "totalAmount"
															? "valor"
															: column.id === "commissionInstallments"
																? "parcelas"
																: column.id === "status"
																	? "status"
																	: "atualização"}
								</DropdownMenuCheckboxItem>
							))}
					</DropdownMenuContent>
				</DropdownMenu>
			</div>

			{selectedSaleIds.length > 0 && canUseBulkActions ? (
				<div className="flex flex-col gap-3 rounded-md border border-blue-300 bg-blue-50 p-4 md:flex-row md:items-center md:justify-between">
					<p className="text-sm text-blue-900">
						{selectedSaleIds.length} venda(s) selecionada(s)
					</p>
					<div className="flex flex-col gap-2 md:flex-row md:items-center">
						{canChangeSaleStatus ? (
							<>
								<Select
									value={bulkStatus || undefined}
									onValueChange={(value) => setBulkStatus(value as SaleStatus)}
									disabled={availableBulkStatuses.length === 0}
								>
									<SelectTrigger className="w-full md:w-52">
										<SelectValue
											placeholder={
												availableBulkStatuses.length === 0
													? "Sem transição disponível"
													: "Novo status"
											}
										/>
									</SelectTrigger>
									<SelectContent>
										{availableBulkStatuses.map((status) => (
											<SelectItem key={status} value={status}>
												{SALE_STATUS_LABEL[status]}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<Button
									type="button"
									onClick={() => void handleApplyBulkStatus()}
									disabled={!bulkStatus || isBulkStatusPending}
								>
									{isBulkStatusPending
										? "Aplicando..."
										: "Alterar status em lote"}
								</Button>
							</>
						) : null}
						{canDeleteSale ? (
							<Button
								type="button"
								variant="destructive"
								onClick={() => setBulkDeleteDialogOpen(true)}
								disabled={isBulkDeletePending}
							>
								{isBulkDeletePending ? "Excluindo..." : "Excluir em lote"}
							</Button>
						) : null}
					</div>
				</div>
			) : null}

			{canDeleteSale ? (
				<AlertDialog
					open={bulkDeleteDialogOpen}
					onOpenChange={setBulkDeleteDialogOpen}
				>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>Excluir vendas em lote</AlertDialogTitle>
							<AlertDialogDescription>
								Tem certeza que deseja excluir{" "}
								<strong>{selectedSaleIds.length}</strong> venda(s) selecionada(s)?
								Esta ação não pode ser desfeita.
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel disabled={isBulkDeletePending}>
								Cancelar
							</AlertDialogCancel>
							<AlertDialogAction
								variant="destructive"
								onClick={() => void handleConfirmBulkDelete()}
								disabled={isBulkDeletePending}
							>
								{isBulkDeletePending ? "Excluindo..." : "Confirmar exclusão"}
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			) : null}

			<ResponsiveDataView
				mobile={
					<div className="space-y-3">
						{canUseBulkActions ? (
							<Card className="p-3">
								<div className="flex items-center justify-between gap-3">
									<div className="flex items-center gap-2 text-sm">
										<Checkbox
											checked={
												table.getIsAllPageRowsSelected()
													? true
													: table.getIsSomePageRowsSelected()
														? "indeterminate"
														: false
											}
											onCheckedChange={(value) =>
												table.toggleAllPageRowsSelected(Boolean(value))
											}
											aria-label="Selecionar página atual"
										/>
										<span>Selecionar vendas da página</span>
									</div>
									<span className="text-xs text-muted-foreground">
										{table.getRowModel().rows.length} registro(s)
									</span>
								</div>
							</Card>
						) : null}

						{table.getRowModel().rows.length === 0 ? (
							<Card className="p-6 text-center text-sm text-muted-foreground">
								Nenhum resultado encontrado para os filtros aplicados.
							</Card>
						) : (
							table.getRowModel().rows.map((row) => {
								const sale = row.original;
								const summary = sale.commissionInstallmentsSummary;

								return (
									<Card key={row.id} className="space-y-3 p-4">
										<div className="flex items-start justify-between gap-3">
											<div className="min-w-0">
												<p className="truncate text-sm font-semibold">
													{sale.customer.name}
												</p>
												<p className="truncate text-xs text-muted-foreground">
													{sale.productLabel}
												</p>
											</div>
											<Checkbox
												checked={row.getIsSelected()}
												onCheckedChange={(value) =>
													row.toggleSelected(Boolean(value))
												}
												disabled={!canUseBulkActions}
												aria-label={`Selecionar venda ${sale.id}`}
											/>
										</div>

										<div className="grid grid-cols-2 gap-2 text-xs">
											<div className="space-y-0.5">
												<p className="text-muted-foreground">Data</p>
												<p>{formatSaleDate(sale.saleDate)}</p>
											</div>
											<div className="space-y-0.5">
												<p className="text-muted-foreground">Atualização</p>
												<p>{formatDateTime(sale.updatedAt)}</p>
											</div>
											<div className="space-y-0.5">
												<p className="text-muted-foreground">Empresa</p>
												<p>{sale.company.name}</p>
											</div>
											<div className="space-y-0.5">
												<p className="text-muted-foreground">Unidade</p>
												<p>{sale.unit?.name ?? "Sem unidade"}</p>
											</div>
										</div>

										<div className="flex items-center justify-between gap-3">
											<SaleStatusBadge status={sale.status as SaleStatus} />
											<p className="text-sm font-semibold">
												{formatCurrencyBRL(sale.totalAmount / 100)}
											</p>
										</div>

										<div className="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
											Parcelas:{" "}
											{summary.total === 0
												? "Sem parcelas"
												: `${summary.paid}/${summary.total} pagas`}
										</div>

										<div className="grid grid-cols-2 gap-2">
											<Button variant="outline" size="sm" asChild>
												<Link to="/sales/$saleId" params={{ saleId: sale.id }}>
													<Eye className="size-4" />
													Detalhes
												</Link>
											</Button>
											{canUpdateSale ? (
												<Button variant="outline" size="sm" asChild>
													<Link
														to="/sales/update/$saleId"
														params={{ saleId: sale.id }}
													>
														<Pencil className="size-4" />
														Editar
													</Link>
												</Button>
											) : null}
											{canCreateSale ? (
												<Button variant="outline" size="sm" asChild>
													<Link
														to="/sales/create"
														search={{ duplicateSaleId: sale.id }}
													>
														<Copy className="size-4" />
														Duplicar
													</Link>
												</Button>
											) : null}
											{canAccessCommissionInstallments ? (
												<Button
													type="button"
													variant="outline"
													size="sm"
													className="!min-h-8"
													disabled={summary.total === 0}
													onClick={() => setInstallmentsDrawerSale(sale)}
												>
													<ListTree className="size-4" />
													Parcelas
												</Button>
											) : null}
										</div>

										{canChangeSaleStatus ? (
											<SaleStatusAction
												saleId={sale.id}
												currentStatus={sale.status as SaleStatus}
											/>
										) : null}
									</Card>
								);
							})
						)}
					</div>
				}
				desktop={
					<div className="overflow-x-auto rounded-md border bg-card">
						<Table>
							<TableHeader>
								{table.getHeaderGroups().map((headerGroup) => (
									<TableRow key={headerGroup.id}>
										{headerGroup.headers.map((header) => (
											<TableHead key={header.id}>
												{header.isPlaceholder
													? null
													: flexRender(
															header.column.columnDef.header,
															header.getContext(),
														)}
											</TableHead>
										))}
									</TableRow>
								))}
							</TableHeader>
							<TableBody>
								{table.getRowModel().rows.length > 0 ? (
									table.getRowModel().rows.map((row) => (
										<TableRow key={row.id}>
											{row.getVisibleCells().map((cell) => (
												<TableCell key={cell.id}>
													{flexRender(
														cell.column.columnDef.cell,
														cell.getContext(),
													)}
												</TableCell>
											))}
										</TableRow>
									))
								) : (
									<TableRow>
										<TableCell
											colSpan={columns.length}
											className="h-24 text-center"
										>
											Nenhum resultado encontrado para os filtros aplicados.
										</TableCell>
									</TableRow>
								)}
							</TableBody>
						</Table>
					</div>
				}
			/>

			<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
				<span className="text-sm text-muted-foreground">
					Página {table.getState().pagination.pageIndex + 1} de{" "}
					{table.getPageCount()}
				</span>
				<div className="flex w-full items-center gap-2 md:w-auto">
					<Button
						variant="outline"
						size="sm"
						className="flex-1 md:flex-none"
						onClick={() => table.previousPage()}
						disabled={!table.getCanPreviousPage()}
					>
						Anterior
					</Button>
					<Button
						variant="outline"
						size="sm"
						className="flex-1 md:flex-none"
						onClick={() => table.nextPage()}
						disabled={!table.getCanNextPage()}
					>
						Próxima
					</Button>
				</div>
			</div>

			{installmentsDrawerSale ? (
				<SaleInstallmentsDrawer
					open={Boolean(installmentsDrawerSale)}
					onOpenChange={(open) => {
						if (!open) {
							setInstallmentsDrawerSale(null);
						}
					}}
					saleId={installmentsDrawerSale.id}
					saleStatus={installmentsDrawerSale.status as SaleStatus}
				/>
			) : null}
		</div>
	);
}
