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
import { useDeleteSale } from "@/hooks/sales";
import {
	useGetOrganizationsSlugProducts,
	type GetOrganizationsSlugSales200,
} from "@/http/generated";
import {
	SALE_STATUS_LABEL,
	SaleStatusSchema,
	type SaleStatus,
} from "@/schemas/types/sales";
import { textFilterParser } from "@/hooks/filters/parsers";
import { formatCurrencyBRL } from "@/utils/format-amount";
import { Link } from "@tanstack/react-router";
import {
	flexRender,
	getCoreRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	useReactTable,
	type ColumnDef,
	type ColumnFiltersState,
	type FilterFn,
	type SortingState,
	type VisibilityState,
} from "@tanstack/react-table";
import { format, parse, parseISO } from "date-fns";
import {
	ArrowUpDown,
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
import { useMemo, useState } from "react";
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

const saleStatusFilterParser = parseAsStringLiteral(SALE_STATUS_FILTER_VALUES)
	.withDefault("ALL")
	.withOptions({ history: "replace" });

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
	const term = String(filterValue ?? "").trim().toLowerCase();
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

function SaleTableRowActions({ sale, onOpenInstallments }: SaleTableRowActionsProps) {
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
						<DropdownMenuItem asChild>
							<Link to="/sales/update/$saleId" params={{ saleId: sale.id }}>
								<Pencil className="size-4" />
								Editar
							</Link>
						</DropdownMenuItem>
						<DropdownMenuItem
							onSelect={(event) => {
								event.preventDefault();
								onOpenInstallments(sale);
							}}
						>
							<ListTree className="size-4" />
							Ver parcelas
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<SaleStatusAction
						saleId={sale.id}
						currentStatus={sale.status as SaleStatus}
						trigger="dropdown-item"
					/>
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
	const { organization } = useApp();
	const slug = organization?.slug ?? "";
	const [sorting, setSorting] = useState<SortingState>([]);
	const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
	const [globalFilter, setGlobalFilter] = useQueryState("q", textFilterParser);
	const [statusFilter, setStatusFilter] = useQueryState(
		"status",
		saleStatusFilterParser,
	);
	const columnFilters = useMemo<ColumnFiltersState>(
		() =>
			statusFilter === "ALL"
				? []
				: [{ id: "status", value: statusFilter }],
		[statusFilter],
	);
	const [installmentsDrawerSale, setInstallmentsDrawerSale] =
		useState<SaleTableRow | null>(null);
	const productsQuery = useGetOrganizationsSlugProducts(
		{ slug },
		{
			query: {
				enabled: Boolean(organization?.slug),
			},
		},
	);
	const productPathById = useMemo(
		() =>
			buildProductPathMap(
				(productsQuery.data?.products ?? []) as ProductTreeNode[],
			),
		[productsQuery.data?.products],
	);
	const tableData = useMemo<SaleTableRow[]>(
		() =>
			sales.map((sale) => ({
				...sale,
				productLabel: productPathById.get(sale.product.id) ?? sale.product.name,
			})),
		[sales, productPathById],
	);

	const columns = useMemo<ColumnDef<SaleTableRow>[]>(
		() => [
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
			[],
		);

	const table = useReactTable({
		data: tableData,
		columns,
		state: {
			sorting,
			columnFilters,
			columnVisibility,
			globalFilter,
		},
		onSortingChange: setSorting,
		onColumnVisibilityChange: setColumnVisibility,
		globalFilterFn: salesGlobalFilterFn,
		getCoreRowModel: getCoreRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
	});

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
				<Button asChild className="w-fit">
					<Link to="/sales/create">
						<Plus className="size-4" />
						Nova Venda
					</Link>
				</Button>
			</Card>
		);
	}

	return (
		<div className="space-y-4">
			<div className="flex items-center gap-2">
				<Input
					placeholder="Buscar por cliente, produto (com hierarquia) ou empresa..."
					value={globalFilter}
					onChange={(event) => setGlobalFilter(event.target.value)}
					className="h-10 max-w-md"
				/>

				<Select
					value={statusFilter}
					onValueChange={(value) => {
						setStatusFilter(value as SaleStatusFilter);
					}}
				>
					<SelectTrigger className="w-52 h-10">
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

				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="outline" className="ml-auto">
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
									onCheckedChange={(value) => column.toggleVisibility(Boolean(value))}
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

			<div className="rounded-md border bg-card">
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
								<TableCell colSpan={columns.length} className="h-24 text-center">
									Nenhum resultado encontrado para os filtros aplicados.
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</div>

				<div className="flex items-center justify-between">
				<span className="text-sm text-muted-foreground">
					Página {table.getState().pagination.pageIndex + 1} de{" "}
					{table.getPageCount()}
				</span>
				<div className="flex items-center gap-2">
					<Button
						variant="outline"
						size="sm"
						onClick={() => table.previousPage()}
						disabled={!table.getCanPreviousPage()}
					>
						Anterior
					</Button>
					<Button
						variant="outline"
						size="sm"
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
