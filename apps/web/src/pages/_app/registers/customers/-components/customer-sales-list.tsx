import { format, parse } from "date-fns";
import { EllipsisVertical, Eye, TriangleAlert } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { DataTablePagination } from "@/components/data-table-pagination";
import { ResponsiveDataView } from "@/components/responsive-data-view";
import { Button } from "@/components/ui/button";
import { CalendarDateInput } from "@/components/ui/calendar-date-input";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { resolveErrorMessage } from "@/errors";
import { normalizeApiError } from "@/errors/api-error";
import {
	type LinkedSalesOwner,
	type MarkLinkedSalesAsDelinquentResult,
	type ResolveLinkedSalesDelinquenciesResult,
	useLinkedSalesDelinquencyBulkActions,
} from "@/hooks/sales";
import { useTablePagination } from "@/hooks/filters/use-table-pagination";
import { useCheckboxMultiSelect } from "@/hooks/use-checkbox-multi-select";
import type { GetOrganizationsSlugCustomersCustomerid200 } from "@/http/generated";
import { formatCurrencyBRL } from "@/utils/format-amount";
import { SaleDelinquencyBadge } from "@/pages/_app/sales/-components/sale-delinquency-badge";
import { SaleStatusBadge } from "@/pages/_app/sales/-components/sale-status-badge";
import type { SaleStatus } from "@/schemas/types/sales";

export type LinkedSale = {
	id: string;
	saleDate: string;
	totalAmount: number;
	status: string;
	createdAt: string;
	updatedAt: string;
	customer?: {
		id: string;
		name: string;
	};
	product: {
		id: string;
		name: string;
	};
	company: {
		id: string;
		name: string;
	};
	unit: {
		id: string;
		name: string;
	} | null;
	responsible: {
		type: string;
		id: string | null;
		name: string;
	} | null;
	delinquencySummary: {
		hasOpen: boolean;
		openCount: number;
		oldestDueDate: string | null;
		latestDueDate: string | null;
	};
	openDelinquencies: Array<{
		id: string;
	}>;
};

interface CustomerSalesListProps {
	sales: GetOrganizationsSlugCustomersCustomerid200["customer"]["sales"];
	customerId: string;
	canManageDelinquencies: boolean;
}

interface LinkedSalesListProps<TSale extends LinkedSale> {
	sales: TSale[];
	owner: LinkedSalesOwner;
	canManageDelinquencies: boolean;
	showCustomer?: boolean;
	emptyMessage?: string;
}

interface LinkedSaleActionsProps {
	sale: LinkedSale;
	canManageDelinquencies: boolean;
	onOpenMarkDelinquencyForSale: (saleId: string) => void;
	onOpenResolveDelinquencyForSale: (saleId: string) => void;
}

function formatDate(value: string) {
	return format(
		parse(value.slice(0, 10), "yyyy-MM-dd", new Date()),
		"dd/MM/yyyy",
	);
}

function LinkedSaleActions({
	sale,
	canManageDelinquencies,
	onOpenMarkDelinquencyForSale,
	onOpenResolveDelinquencyForSale,
}: LinkedSaleActionsProps) {
	const hasOpenDelinquency = sale.delinquencySummary.hasOpen;
	const canHandleDelinquencyAction =
		hasOpenDelinquency || sale.status === "COMPLETED";
	const delinquencyActionLabel = hasOpenDelinquency
		? "Resolver inadimplência"
		: "Adicionar inadimplência";

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="outline" size="sm">
					<EllipsisVertical className="size-4" />
					Ações
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				{canManageDelinquencies ? (
					<>
						<DropdownMenuItem
							disabled={!canHandleDelinquencyAction}
							onSelect={(event) => {
								event.preventDefault();
								if (!canHandleDelinquencyAction) {
									return;
								}

								if (hasOpenDelinquency) {
									onOpenResolveDelinquencyForSale(sale.id);
									return;
								}

								onOpenMarkDelinquencyForSale(sale.id);
							}}
						>
							<TriangleAlert className="size-4" />
							{delinquencyActionLabel}
						</DropdownMenuItem>
						<DropdownMenuSeparator />
					</>
				) : null}
				<DropdownMenuItem asChild>
					<Link to="/sales/$saleId" params={{ saleId: sale.id }}>
						<Eye className="size-4" />
						Ver venda
					</Link>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

export function LinkedSalesList<TSale extends LinkedSale>({
	sales,
	owner,
	canManageDelinquencies,
	showCustomer = false,
	emptyMessage = "Nenhum registro de venda visível.",
}: LinkedSalesListProps<TSale>) {
	const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
	const [isMarkDialogOpen, setIsMarkDialogOpen] = useState(false);
	const [markDialogSaleIds, setMarkDialogSaleIds] = useState<string[] | null>(
		null,
	);
	const [dueDate, setDueDate] = useState("");
	const [dueDateError, setDueDateError] = useState<string | null>(null);
	const [isResolveDialogOpen, setIsResolveDialogOpen] = useState(false);
	const [resolveDialogSaleIds, setResolveDialogSaleIds] = useState<
		string[] | null
	>(null);
	const {
		markLinkedSalesAsDelinquent,
		isMarkingLinkedSalesAsDelinquent,
		resolveLinkedSalesDelinquencies,
		isResolvingLinkedSalesDelinquencies,
	} = useLinkedSalesDelinquencyBulkActions();
	const {
		currentPage,
		currentPageSize,
		totalItems,
		totalPages,
		paginatedItems: paginatedSales,
		handlePageChange,
		handlePageSizeChange,
	} = useTablePagination({
		items: sales,
	});

	const visibleSaleIds = useMemo(
		() => paginatedSales.map((sale) => sale.id),
		[paginatedSales],
	);
	const selectedSaleIds = useMemo(
		() =>
			sales
				.filter((sale) => Boolean(rowSelection[sale.id]))
				.map((sale) => sale.id),
		[rowSelection, sales],
	);
	const isAllVisibleSelected =
		visibleSaleIds.length > 0 &&
		visibleSaleIds.every((saleId) => Boolean(rowSelection[saleId]));
	const isSomeVisibleSelected =
		!isAllVisibleSelected &&
		visibleSaleIds.some((saleId) => Boolean(rowSelection[saleId]));
	const markTargetSaleIds = markDialogSaleIds ?? selectedSaleIds;
	const resolveTargetSaleIds = resolveDialogSaleIds ?? selectedSaleIds;

	useEffect(() => {
		setRowSelection((current) => {
			const availableSaleIds = new Set(sales.map((sale) => sale.id));
			const nextEntries = Object.entries(current).filter(
				([saleId, isSelected]) => {
					return isSelected && availableSaleIds.has(saleId);
				},
			);

			if (nextEntries.length === Object.keys(current).length) {
				return current;
			}

			return Object.fromEntries(nextEntries);
		});
	}, [sales]);

	function clearSelection() {
		setRowSelection({});
	}

	function toggleSaleSelectionById(saleId: string, checked: boolean) {
		setRowSelection((current) => {
			const next = { ...current };
			if (checked) {
				next[saleId] = true;
			} else {
				delete next[saleId];
			}
			return next;
		});
	}

	function toggleVisibleSalesSelection(saleIds: string[], checked: boolean) {
		setRowSelection((current) => {
			const next = { ...current };
			for (const saleId of saleIds) {
				if (checked) {
					next[saleId] = true;
				} else {
					delete next[saleId];
				}
			}
			return next;
		});
	}

	const saleMultiSelect = useCheckboxMultiSelect({
		visibleIds: visibleSaleIds,
		toggleOne: toggleSaleSelectionById,
		toggleMany: toggleVisibleSalesSelection,
		onClearSelection: clearSelection,
		enabled: canManageDelinquencies,
	});

	if (sales.length === 0) {
		return (
			<Card className="p-6 text-sm text-muted-foreground">{emptyMessage}</Card>
		);
	}

	function openMarkDelinquencyDialog(saleIds?: string[]) {
		setMarkDialogSaleIds(saleIds ?? null);
		setDueDate("");
		setDueDateError(null);
		setIsMarkDialogOpen(true);
	}

	function openResolveDelinquencyDialog(saleIds?: string[]) {
		setResolveDialogSaleIds(saleIds ?? null);
		setIsResolveDialogOpen(true);
	}

	function validateDueDate(value: string) {
		if (!value) {
			return "Informe a data de vencimento.";
		}

		if (value > format(new Date(), "yyyy-MM-dd")) {
			return "A data de vencimento não pode ser maior que hoje.";
		}

		return null;
	}

	function notifyMarkResult(result: MarkLinkedSalesAsDelinquentResult) {
		if (result.attemptedCount === 0) {
			if (result.ignoredNotCompletedCount > 0) {
				toast.warning(
					`${result.ignoredNotCompletedCount} venda(s) ignorada(s) por não estarem concluídas.`,
				);
				return;
			}

			toast.info("Nenhuma venda elegível para marcar como inadimplente.");
			return;
		}

		const summaryItems = [
			`${result.successCount} venda(s) marcada(s)`,
			result.ignoredNotCompletedCount > 0
				? `${result.ignoredNotCompletedCount} ignorada(s) por status`
				: null,
			result.failedCount > 0 ? `${result.failedCount} com falha` : null,
		].filter(Boolean);
		const summary = summaryItems.join(" · ");

		if (result.failedCount > 0) {
			if (result.successCount === 0) {
				toast.error(summary);
				return;
			}

			toast.warning(summary);
			return;
		}

		if (result.ignoredNotCompletedCount > 0) {
			toast.warning(summary);
			return;
		}

		toast.success(summary);
	}

	function notifyResolveResult(result: ResolveLinkedSalesDelinquenciesResult) {
		if (result.attemptedOccurrenceCount === 0) {
			if (result.skippedWithoutOpenCount > 0) {
				toast.warning(
					`${result.skippedWithoutOpenCount} venda(s) sem inadimplências em aberto.`,
				);
				return;
			}

			toast.info(
				"Nenhuma inadimplência em aberto foi encontrada nas vendas selecionadas.",
			);
			return;
		}

		const summaryItems = [
			`${result.resolvedCount} ocorrência(s) resolvida(s)`,
			result.skippedWithoutOpenCount > 0
				? `${result.skippedWithoutOpenCount} venda(s) sem ocorrência`
				: null,
			result.failedCount > 0 ? `${result.failedCount} com falha` : null,
		].filter(Boolean);
		const summary = summaryItems.join(" · ");

		if (result.failedCount > 0) {
			if (result.resolvedCount === 0) {
				toast.error(summary);
				return;
			}

			toast.warning(summary);
			return;
		}

		if (result.skippedWithoutOpenCount > 0) {
			toast.warning(summary);
			return;
		}

		toast.success(summary);
	}

	async function handleMarkSalesAsDelinquent() {
		const validatedDueDateError = validateDueDate(dueDate);
		if (validatedDueDateError) {
			setDueDateError(validatedDueDateError);
			return;
		}

		try {
			if (markTargetSaleIds.length === 0) {
				return;
			}

			const result = await markLinkedSalesAsDelinquent({
				owner,
				sales,
				selectedSaleIds: markTargetSaleIds,
				dueDate,
			});

			if (result.attemptedCount > 0) {
				clearSelection();
			}

			setIsMarkDialogOpen(false);
			setMarkDialogSaleIds(null);
			setDueDate("");
			setDueDateError(null);
			notifyMarkResult(result);
		} catch (error) {
			toast.error(resolveErrorMessage(normalizeApiError(error)));
		}
	}

	async function handleResolveSalesDelinquencies() {
		try {
			if (resolveTargetSaleIds.length === 0) {
				return;
			}

			const result = await resolveLinkedSalesDelinquencies({
				owner,
				sales,
				selectedSaleIds: resolveTargetSaleIds,
			});

			if (result.attemptedOccurrenceCount > 0) {
				clearSelection();
			}

			setIsResolveDialogOpen(false);
			setResolveDialogSaleIds(null);
			notifyResolveResult(result);
		} catch (error) {
			toast.error(resolveErrorMessage(normalizeApiError(error)));
		}
	}

	return (
		<div className="space-y-4">
			{canManageDelinquencies && selectedSaleIds.length > 0 ? (
				<div className="flex flex-col gap-3 rounded-md border border-blue-500/30 bg-blue-500/10 p-4 md:flex-row md:items-center md:justify-between">
					<p className="text-sm text-blue-700 dark:text-blue-300">
						{selectedSaleIds.length} venda(s) selecionada(s)
					</p>
					<div className="flex flex-col gap-2 md:flex-row">
						<Button
							type="button"
							variant="outline"
							onClick={() => openMarkDelinquencyDialog()}
							disabled={
								isMarkingLinkedSalesAsDelinquent ||
								isResolvingLinkedSalesDelinquencies
							}
						>
							Marcar inadimplente
						</Button>
						<Button
							type="button"
							variant="outline"
							onClick={() => openResolveDelinquencyDialog()}
							disabled={
								isResolvingLinkedSalesDelinquencies ||
								isMarkingLinkedSalesAsDelinquent
							}
						>
							Remover inadimplências
						</Button>
						<Button
							type="button"
							variant="ghost"
							onClick={clearSelection}
							disabled={
								isMarkingLinkedSalesAsDelinquent ||
								isResolvingLinkedSalesDelinquencies
							}
						>
							Limpar seleção
						</Button>
					</div>
				</div>
			) : null}

			<ResponsiveDataView
				mobile={
					<div className="space-y-3">
						{canManageDelinquencies ? (
							<Card className="p-3">
								<div className="flex items-center justify-between gap-3">
									<div className="flex items-center gap-2 text-sm">
										<Checkbox
											checked={
												isAllVisibleSelected
													? true
													: isSomeVisibleSelected
														? "indeterminate"
														: false
											}
											onCheckedChange={(checked) =>
												toggleVisibleSalesSelection(
													visibleSaleIds,
													Boolean(checked),
												)
											}
											aria-label="Selecionar todas as vendas visíveis"
										/>
										<span>Selecionar vendas visíveis</span>
									</div>
									<span className="text-xs text-muted-foreground">
										{paginatedSales.length} nesta página
									</span>
								</div>
							</Card>
						) : null}

						{paginatedSales.map((sale) => (
							<Card
								key={sale.id}
								className={`space-y-3 p-4 ${
									sale.delinquencySummary.hasOpen
										? "border-rose-500/30 bg-rose-500/5"
										: ""
								}`}
							>
								<div className="flex items-start justify-between gap-3">
									<div className="space-y-1">
										<p className="text-sm font-semibold">{sale.product.name}</p>
										<p className="text-xs text-muted-foreground">
											{sale.company.name}
											{sale.unit ? ` • ${sale.unit.name}` : ""}
										</p>
										{showCustomer && sale.customer ? (
											<p className="text-xs text-muted-foreground">
												Cliente: {sale.customer.name}
											</p>
										) : null}
									</div>
									{canManageDelinquencies ? (
										<Checkbox
											checked={Boolean(rowSelection[sale.id])}
											onClick={(event) =>
												saleMultiSelect.onCheckboxClick(sale.id, event)
											}
											onCheckedChange={(checked) =>
												saleMultiSelect.onCheckboxCheckedChange(
													sale.id,
													Boolean(checked),
												)
											}
											aria-label={`Selecionar venda ${sale.product.name}`}
										/>
									) : null}
								</div>

								<div className="grid grid-cols-2 gap-2 text-xs">
									<div className="space-y-0.5">
										<p className="text-muted-foreground">Data da venda</p>
										<p>{formatDate(sale.saleDate)}</p>
									</div>
									<div className="space-y-0.5">
										<p className="text-muted-foreground">Valor</p>
										<p className="font-semibold">
											{formatCurrencyBRL(sale.totalAmount / 100)}
										</p>
									</div>
								</div>

								<div className="flex flex-wrap items-center gap-2">
									<SaleStatusBadge status={sale.status as SaleStatus} />
									<SaleDelinquencyBadge summary={sale.delinquencySummary} />
								</div>

								<LinkedSaleActions
									sale={sale}
									canManageDelinquencies={canManageDelinquencies}
									onOpenMarkDelinquencyForSale={(saleId) =>
										openMarkDelinquencyDialog([saleId])
									}
									onOpenResolveDelinquencyForSale={(saleId) =>
										openResolveDelinquencyDialog([saleId])
									}
								/>
							</Card>
						))}
					</div>
				}
				desktop={
					<div className="overflow-hidden rounded-md border bg-card">
						<Table>
							<TableHeader>
								<TableRow>
									{canManageDelinquencies ? (
										<TableHead className="w-10">
											<Checkbox
												checked={
													isAllVisibleSelected
														? true
														: isSomeVisibleSelected
															? "indeterminate"
															: false
												}
												onCheckedChange={(checked) =>
													toggleVisibleSalesSelection(
														visibleSaleIds,
														Boolean(checked),
													)
												}
												aria-label="Selecionar todas as vendas visíveis"
											/>
										</TableHead>
									) : null}
									<TableHead>Venda</TableHead>
									{showCustomer ? <TableHead>Cliente</TableHead> : null}
									<TableHead>Empresa/Unidade</TableHead>
									<TableHead>Status</TableHead>
									<TableHead>Inadimplência</TableHead>
									<TableHead>Valor</TableHead>
									<TableHead></TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{paginatedSales.map((sale) => (
									<TableRow key={sale.id}>
										{canManageDelinquencies ? (
											<TableCell className="w-10">
												<Checkbox
													checked={Boolean(rowSelection[sale.id])}
													onClick={(event) =>
														saleMultiSelect.onCheckboxClick(sale.id, event)
													}
													onCheckedChange={(checked) =>
														saleMultiSelect.onCheckboxCheckedChange(
															sale.id,
															Boolean(checked),
														)
													}
													aria-label={`Selecionar venda ${sale.product.name}`}
												/>
											</TableCell>
										) : null}
										<TableCell>
											<div className="space-y-1">
												<p className="font-medium">{sale.product.name}</p>
												<p className="text-xs text-muted-foreground">
													{formatDate(sale.saleDate)}
												</p>
											</div>
										</TableCell>
										{showCustomer ? (
											<TableCell>
												<span className="text-sm">
													{sale.customer?.name ?? "Cliente não informado"}
												</span>
											</TableCell>
										) : null}
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
											{sale.delinquencySummary.hasOpen ? (
												<SaleDelinquencyBadge
													summary={sale.delinquencySummary}
												/>
											) : (
												<span className="text-sm text-muted-foreground">-</span>
											)}
										</TableCell>
										<TableCell className="font-semibold">
											{formatCurrencyBRL(sale.totalAmount / 100)}
										</TableCell>
										<TableCell>
											<div className="flex justify-end">
												<LinkedSaleActions
													sale={sale}
													canManageDelinquencies={canManageDelinquencies}
													onOpenMarkDelinquencyForSale={(saleId) =>
														openMarkDelinquencyDialog([saleId])
													}
													onOpenResolveDelinquencyForSale={(saleId) =>
														openResolveDelinquencyDialog([saleId])
													}
												/>
											</div>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
				}
			/>

			<DataTablePagination
				page={currentPage}
				pageSize={currentPageSize}
				totalItems={totalItems}
				totalPages={totalPages}
				onPageChange={handlePageChange}
				onPageSizeChange={handlePageSizeChange}
			/>

			<Dialog
				open={isMarkDialogOpen}
				onOpenChange={(open) => {
					setIsMarkDialogOpen(open);
					if (!open) {
						setMarkDialogSaleIds(null);
						setDueDate("");
						setDueDateError(null);
					}
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Marcar vendas como inadimplentes</DialogTitle>
						<DialogDescription>
							Informe a data de vencimento para aplicar{" "}
							{markTargetSaleIds.length === 1
								? "na venda selecionada."
								: "nas vendas selecionadas."}
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-2">
						<p className="text-sm font-medium">Data de vencimento</p>
						<CalendarDateInput
							value={dueDate}
							onChange={(value) => {
								setDueDate(value);
								setDueDateError(null);
							}}
							maxDate={new Date()}
						/>
						{dueDateError ? (
							<p className="text-sm text-destructive">{dueDateError}</p>
						) : null}
					</div>

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => setIsMarkDialogOpen(false)}
							disabled={isMarkingLinkedSalesAsDelinquent}
						>
							Cancelar
						</Button>
						<Button
							type="button"
							onClick={() => void handleMarkSalesAsDelinquent()}
							disabled={
								isMarkingLinkedSalesAsDelinquent ||
								markTargetSaleIds.length === 0
							}
						>
							{isMarkingLinkedSalesAsDelinquent
								? "Aplicando..."
								: "Marcar inadimplente"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<AlertDialog
				open={isResolveDialogOpen}
				onOpenChange={(open) => {
					setIsResolveDialogOpen(open);
					if (!open) {
						setResolveDialogSaleIds(null);
					}
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Remover inadimplências em lote</AlertDialogTitle>
						<AlertDialogDescription>
							As inadimplências em aberto das vendas selecionadas serão
							resolvidas{" "}
							{resolveTargetSaleIds.length === 1
								? "na venda selecionada."
								: "nas vendas selecionadas."}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={isResolvingLinkedSalesDelinquencies}>
							Cancelar
						</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => void handleResolveSalesDelinquencies()}
							disabled={
								isResolvingLinkedSalesDelinquencies ||
								resolveTargetSaleIds.length === 0
							}
						>
							{isResolvingLinkedSalesDelinquencies
								? "Removendo..."
								: "Remover inadimplências"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}

export function CustomerSalesList({
	sales,
	customerId,
	canManageDelinquencies,
}: CustomerSalesListProps) {
	return (
		<LinkedSalesList
			sales={sales}
			owner={{ type: "CUSTOMER", id: customerId }}
			canManageDelinquencies={canManageDelinquencies}
			emptyMessage="Este cliente ainda não possui vendas visíveis."
		/>
	);
}
