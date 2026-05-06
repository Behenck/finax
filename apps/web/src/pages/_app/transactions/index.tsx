import { CalendarDateInput } from "@/components/ui/calendar-date-input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { FilterPanel } from "@/components/filter-panel";
import { Input } from "@/components/ui/input";
import { ListPageSkeleton } from "@/components/loading-skeletons";
import { PageHeader } from "@/components/page-header";
import { ResponsiveDataView } from "@/components/responsive-data-view";
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
import {
	dateFilterParser,
	entityFilterParser,
	pageParser,
	pageSizeParser,
	sortDirectionParser,
	textFilterParser,
	transactionSortByParser,
	transactionStatusFilterParser,
	transactionTypeFilterParser,
} from "@/hooks/filters/parsers";
import { useCheckboxMultiSelect } from "@/hooks/use-checkbox-multi-select";
import { usePatchTransactionsPaymentBulk } from "@/hooks/transactions/use-patch-transactions-payment-bulk";
import { useRestoreTransactionsPending } from "@/hooks/transactions/use-restore-transactions-pending";
import { useTransactions } from "@/hooks/transactions/use-transactions";
import { useGetOrganizationsSlugCompanies } from "@/http/generated";
import { useAbility } from "@/permissions/access";
import { createFileRoute, Link } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import {
	CheckCheck,
	Copy,
	EllipsisVertical,
	Plus,
	RefreshCcw,
} from "lucide-react";
import { useQueryState } from "nuqs";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { BadgeStatus } from "./-components/badge-status";
import { TransactionAmount } from "./-components/transaction-amount";
import { TransactionType } from "./-components/transaction-type";

const TRANSACTIONS_FILTERS_STORAGE_KEY = "finax:transactions:list:filters";

type SelectedTransaction = {
	id: string;
	status: "PENDING" | "PAID" | "CANCELED";
};

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

export const Route = createFileRoute("/_app/transactions/")({
	component: TransactionsPage,
});

function TransactionsPage() {
	const ability = useAbility();
	const { organization } = useApp();
	const canViewTransactions = ability.can("access", "transactions.view");
	const canCreateTransactions = ability.can("access", "transactions.create");
	const canUpdateTransactions = ability.can("access", "transactions.update");
	const canManagePayments = ability.can(
		"access",
		"transactions.payment.manage",
	);
	const slug = organization?.slug ?? "";
	const [q, setQ] = useQueryState("q", textFilterParser);
	const [status, setStatus] = useQueryState(
		"status",
		transactionStatusFilterParser,
	);
	const [type, setType] = useQueryState("type", transactionTypeFilterParser);
	const [companyId, setCompanyId] = useQueryState(
		"companyId",
		entityFilterParser,
	);
	const [unitId, setUnitId] = useQueryState("unitId", entityFilterParser);
	const [dueFrom, setDueFrom] = useQueryState("dueFrom", dateFilterParser);
	const [dueTo, setDueTo] = useQueryState("dueTo", dateFilterParser);
	const [page, setPage] = useQueryState("page", pageParser);
	const [pageSize, setPageSize] = useQueryState("pageSize", pageSizeParser);
	const [sortBy, setSortBy] = useQueryState("sortBy", transactionSortByParser);
	const [sortDir, setSortDir] = useQueryState("sortDir", sortDirectionParser);
	const [hasRestoredFilters, setHasRestoredFilters] = useState(false);
	const [selectedTransactionsById, setSelectedTransactionsById] = useState(
		() => new Map<string, SelectedTransaction>(),
	);
	const { mutateAsync: patchTransactionsPaymentBulk, isPending: isBulkPaying } =
		usePatchTransactionsPaymentBulk();
	const {
		mutateAsync: restoreTransactionsPending,
		isPending: isRestoringPayment,
	} = useRestoreTransactionsPending();
	const isPaymentActionPending = isBulkPaying || isRestoringPayment;

	useEffect(() => {
		if (hasRestoredFilters) {
			return;
		}

		setHasRestoredFilters(true);
		const storedFilters = readStorageJson<{
			q?: string;
			status?: "ALL" | "PENDING" | "PAID" | "CANCELED";
			type?: "ALL" | "INCOME" | "OUTCOME";
			companyId?: string;
			unitId?: string;
			dueFrom?: string;
			dueTo?: string;
			page?: number;
			pageSize?: number;
			sortBy?:
				| "dueDate"
				| "expectedPaymentDate"
				| "description"
				| "totalAmount"
				| "status"
				| "createdAt";
			sortDir?: "asc" | "desc";
		}>(TRANSACTIONS_FILTERS_STORAGE_KEY, {});

		if (!q && storedFilters.q) {
			void setQ(storedFilters.q);
		}
		if (
			status === "ALL" &&
			storedFilters.status &&
			storedFilters.status !== "ALL"
		) {
			void setStatus(storedFilters.status);
		}
		if (type === "ALL" && storedFilters.type && storedFilters.type !== "ALL") {
			void setType(storedFilters.type);
		}
		if (!companyId && storedFilters.companyId) {
			void setCompanyId(storedFilters.companyId);
		}
		if (!unitId && storedFilters.unitId) {
			void setUnitId(storedFilters.unitId);
		}
		if (!dueFrom && storedFilters.dueFrom) {
			void setDueFrom(storedFilters.dueFrom);
		}
		if (!dueTo && storedFilters.dueTo) {
			void setDueTo(storedFilters.dueTo);
		}
		if (page === 1 && storedFilters.page && storedFilters.page > 1) {
			void setPage(storedFilters.page);
		}
		if (
			pageSize === 10 &&
			storedFilters.pageSize &&
			storedFilters.pageSize !== 10
		) {
			void setPageSize(storedFilters.pageSize);
		}
		if (sortBy === "dueDate" && storedFilters.sortBy) {
			void setSortBy(storedFilters.sortBy);
		}
		if (sortDir === "desc" && storedFilters.sortDir) {
			void setSortDir(storedFilters.sortDir);
		}
	}, [
		companyId,
		dueFrom,
		dueTo,
		hasRestoredFilters,
		page,
		pageSize,
		q,
		setCompanyId,
		setDueFrom,
		setDueTo,
		setPage,
		setPageSize,
		setQ,
		setSortBy,
		setSortDir,
		setStatus,
		setType,
		setUnitId,
		sortBy,
		sortDir,
		status,
		type,
		unitId,
	]);

	const currentPage = page >= 1 ? page : 1;
	const currentPageSize = Math.min(100, Math.max(1, pageSize));

	useEffect(() => {
		if (typeof window === "undefined") {
			return;
		}

		window.localStorage.setItem(
			TRANSACTIONS_FILTERS_STORAGE_KEY,
			JSON.stringify({
				q,
				status,
				type,
				companyId,
				unitId,
				dueFrom,
				dueTo,
				page: currentPage,
				pageSize: currentPageSize,
				sortBy,
				sortDir,
			}),
		);
	}, [
		companyId,
		currentPage,
		currentPageSize,
		dueFrom,
		dueTo,
		q,
		sortBy,
		sortDir,
		status,
		type,
		unitId,
	]);

	const companiesQuery = useGetOrganizationsSlugCompanies(
		{
			slug,
		},
		{
			query: {
				enabled: Boolean(slug),
			},
		},
	);

	const companies = companiesQuery.data?.companies ?? [];
	const unitsBySelectedCompany = useMemo(() => {
		if (!companyId) {
			return [];
		}

		return companies.find((company) => company.id === companyId)?.units ?? [];
	}, [companies, companyId]);

	useEffect(() => {
		if (!unitId || !companyId) {
			return;
		}

		const unitExistsInSelectedCompany = unitsBySelectedCompany.some(
			(unit) => unit.id === unitId,
		);
		if (!unitExistsInSelectedCompany) {
			void setUnitId("");
		}
	}, [companyId, setUnitId, unitId, unitsBySelectedCompany]);

	const transactionsQuery = useTransactions({
		q,
		status: status === "ALL" ? undefined : status,
		type: type === "ALL" ? undefined : type,
		companyId: companyId || undefined,
		unitId: unitId || undefined,
		dueFrom: dueFrom || undefined,
		dueTo: dueTo || undefined,
		page: currentPage,
		pageSize: currentPageSize,
		sortBy,
		sortDir,
	});

	const transactions = transactionsQuery.data?.transactions ?? [];
	const pagination = transactionsQuery.data?.pagination;
	const eligibleTransactions = useMemo(
		() =>
			transactions.filter((transaction) => transaction.status === "PENDING"),
		[transactions],
	);

	const allPageSelected =
		eligibleTransactions.length > 0 &&
		eligibleTransactions.every((transaction) =>
			selectedTransactionsById.has(transaction.id),
		);
	const somePageSelected =
		!allPageSelected &&
		eligibleTransactions.some((transaction) =>
			selectedTransactionsById.has(transaction.id),
		);
	const selectedTransactions = useMemo(
		() => Array.from(selectedTransactionsById.values()),
		[selectedTransactionsById],
	);
	const selectableTransactionIds = useMemo(
		() => new Set(eligibleTransactions.map((transaction) => transaction.id)),
		[eligibleTransactions],
	);
	const visibleTransactionsById = useMemo(
		() =>
			new Map(
				transactions.map((transaction) => [
					transaction.id,
					{
						id: transaction.id,
						status: transaction.status,
					},
				]),
			),
		[transactions],
	);

	function clearSelectedTransactions() {
		setSelectedTransactionsById(new Map());
	}

	function clearFilters() {
		clearSelectedTransactions();
		void setQ("");
		void setStatus("ALL");
		void setType("ALL");
		void setCompanyId("");
		void setUnitId("");
		void setDueFrom("");
		void setDueTo("");
		void setPage(1);
		void setPageSize(10);
		void setSortBy("dueDate");
		void setSortDir("desc");
	}

	function toggleTransactionSelection(
		transaction: {
			id: string;
			status: "PENDING" | "PAID" | "CANCELED";
		},
		checked: boolean,
	) {
		setSelectedTransactionsById((current) => {
			const next = new Map(current);
			if (checked) {
				next.set(transaction.id, transaction);
			} else {
				next.delete(transaction.id);
			}
			return next;
		});
	}

	function togglePageSelection(checked: boolean) {
		setSelectedTransactionsById((current) => {
			const next = new Map(current);
			for (const transaction of eligibleTransactions) {
				if (checked) {
					next.set(transaction.id, {
						id: transaction.id,
						status: transaction.status,
					});
				} else {
					next.delete(transaction.id);
				}
			}
			return next;
		});
	}

	function handleTransactionCheckedChange(
		transactionId: string,
		checked: boolean,
	) {
		const transaction = visibleTransactionsById.get(transactionId);
		if (!transaction) {
			return;
		}

		toggleTransactionSelection(transaction, checked);
	}

	function toggleVisibleTransactions(
		transactionIds: string[],
		checked: boolean,
	) {
		setSelectedTransactionsById((current) => {
			const next = new Map(current);

			for (const transactionId of transactionIds) {
				const transaction = visibleTransactionsById.get(transactionId);
				if (!transaction || !selectableTransactionIds.has(transactionId)) {
					continue;
				}

				if (checked) {
					next.set(transaction.id, transaction);
				} else {
					next.delete(transaction.id);
				}
			}

			return next;
		});
	}

	const transactionMultiSelect = useCheckboxMultiSelect<string>({
		visibleIds: transactions.map((transaction) => transaction.id),
		isSelectable: (transactionId) =>
			selectableTransactionIds.has(transactionId),
		toggleOne: handleTransactionCheckedChange,
		toggleMany: toggleVisibleTransactions,
		onClearSelection: clearSelectedTransactions,
		enabled: canManagePayments,
	});

	async function handleBulkPayToday() {
		if (selectedTransactions.length === 0) {
			return;
		}

		const selectedTransactionIds = new Set(
			selectedTransactions.map((item) => item.id),
		);
		const selectedTransactionsSnapshot = transactions.filter((transaction) =>
			selectedTransactionIds.has(transaction.id),
		);

		try {
			const response = await patchTransactionsPaymentBulk({
				transactionIds: selectedTransactions.map((item) => item.id),
				paymentDate: new Date(),
				silent: true,
			});
			clearSelectedTransactions();

			const skippedIds = new Set(
				response.skipped.map((skipped) => skipped.transactionId),
			);
			const updatedTransactions = selectedTransactionsSnapshot.filter(
				(transaction) => !skippedIds.has(transaction.id),
			);

			if (updatedTransactions.length > 0) {
				toast.success(
					`${updatedTransactions.length} transação(ões) baixada(s).`,
					{
						action: {
							label: "Desfazer",
							onClick: () => {
								void restoreTransactionsPending({
									transactions: updatedTransactions,
								});
							},
						},
					},
				);
			}

			if (response.skipped.length > 0) {
				toast.warning(
					`${response.skipped.length} transação(ões) ignorada(s) por status não elegível.`,
				);
			}
		} catch {
			// erro tratado no hook
		}
	}

	async function handlePayToday(transactionId: string) {
		const targetTransaction = transactions.find(
			(transaction) => transaction.id === transactionId,
		);
		if (!targetTransaction) {
			return;
		}

		try {
			const response = await patchTransactionsPaymentBulk({
				transactionIds: [transactionId],
				paymentDate: new Date(),
				silent: true,
			});
			setSelectedTransactionsById((current) => {
				if (!current.has(transactionId)) {
					return current;
				}
				const next = new Map(current);
				next.delete(transactionId);
				return next;
			});

			const updatedTransaction =
				response.updatedCount > 0 &&
				!response.skipped.some(
					(skipped) => skipped.transactionId === transactionId,
				)
					? targetTransaction
					: null;
			if (updatedTransaction) {
				toast.success("Transação baixada.", {
					action: {
						label: "Desfazer",
						onClick: () => {
							void restoreTransactionsPending({
								transactions: [updatedTransaction],
							});
						},
					},
				});
			}
			if (response.skipped.length > 0) {
				toast.warning("Transação ignorada por status não elegível.");
			}
		} catch {
			// erro tratado no hook
		}
	}

	if (!canViewTransactions) {
		return (
			<Card className="p-6">
				<span className="text-muted-foreground">
					Você não possui permissão para visualizar transações.
				</span>
			</Card>
		);
	}

	if (transactionsQuery.isLoading) {
		return (
			<ListPageSkeleton
				actionCount={canCreateTransactions ? 1 : 0}
				filterCount={6}
				itemCount={6}
			/>
		);
	}

	if (transactionsQuery.isError) {
		return (
			<Card className="p-6 flex flex-col gap-4">
				<p className="text-destructive">
					Não foi possível carregar as transações.
				</p>
				<Button
					variant="outline"
					className="w-fit"
					onClick={() => transactionsQuery.refetch()}
				>
					<RefreshCcw className="size-4" />
					Tentar novamente
				</Button>
			</Card>
		);
	}

	return (
		<main className="w-full space-y-6">
			<PageHeader
				title="Gerenciar Transações"
				description="Acompanhe e opere receitas e despesas com filtros, paginação e ações em lote."
				actions={
					canCreateTransactions ? (
						<Button asChild className="w-full sm:w-auto">
							<Link to="/transactions/create">
								<Plus className="size-4" />
								Nova Transação
							</Link>
						</Button>
					) : null
				}
			/>

			<FilterPanel className="xl:grid-cols-8">
				<div className="space-y-1 sm:col-span-2 lg:col-span-2">
					<p className="text-xs text-muted-foreground">Busca</p>
					<Input
						placeholder="Código ou descrição..."
						value={q}
						onChange={(event) => {
							clearSelectedTransactions();
							void setQ(event.target.value);
							void setPage(1);
						}}
					/>
				</div>

				<div className="space-y-1">
					<p className="text-xs text-muted-foreground">Status</p>
					<Select
						value={status}
						onValueChange={(value) => {
							clearSelectedTransactions();
							void setStatus(value as "ALL" | "PENDING" | "PAID" | "CANCELED");
							void setPage(1);
						}}
					>
						<SelectTrigger className="w-full">
							<SelectValue placeholder="Todos" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="ALL">Todos</SelectItem>
							<SelectItem value="PENDING">Pendente</SelectItem>
							<SelectItem value="PAID">Pago</SelectItem>
							<SelectItem value="CANCELED">Cancelado</SelectItem>
						</SelectContent>
					</Select>
				</div>

				<div className="space-y-1">
					<p className="text-xs text-muted-foreground">Tipo</p>
					<Select
						value={type}
						onValueChange={(value) => {
							clearSelectedTransactions();
							void setType(value as "ALL" | "INCOME" | "OUTCOME");
							void setPage(1);
						}}
					>
						<SelectTrigger className="w-full">
							<SelectValue placeholder="Todos" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="ALL">Todos</SelectItem>
							<SelectItem value="INCOME">Entrada</SelectItem>
							<SelectItem value="OUTCOME">Saída</SelectItem>
						</SelectContent>
					</Select>
				</div>

				<div className="space-y-1">
					<p className="text-xs text-muted-foreground">Empresa</p>
					<Select
						value={companyId || "ALL"}
						onValueChange={(value) => {
							clearSelectedTransactions();
							void setCompanyId(value === "ALL" ? "" : value);
							if (value === "ALL") {
								void setUnitId("");
							}
							void setPage(1);
						}}
					>
						<SelectTrigger className="w-full">
							<SelectValue placeholder="Todas" />
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
						value={unitId || "ALL"}
						onValueChange={(value) => {
							clearSelectedTransactions();
							void setUnitId(value === "ALL" ? "" : value);
							void setPage(1);
						}}
						disabled={!companyId}
					>
						<SelectTrigger className="w-full">
							<SelectValue placeholder="Todas" />
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
					<p className="text-xs text-muted-foreground">Vencimento de</p>
					<CalendarDateInput
						value={dueFrom}
						onChange={(value) => {
							clearSelectedTransactions();
							void setDueFrom(value);
							void setPage(1);
						}}
					/>
				</div>

				<div className="space-y-1">
					<p className="text-xs text-muted-foreground">Vencimento até</p>
					<CalendarDateInput
						value={dueTo}
						onChange={(value) => {
							clearSelectedTransactions();
							void setDueTo(value);
							void setPage(1);
						}}
					/>
				</div>

				<Button
					type="button"
					variant="outline"
					className="w-full sm:w-auto xl:justify-self-end"
					onClick={clearFilters}
				>
					<RefreshCcw className="size-4" />
					Limpar
				</Button>
			</FilterPanel>

			<FilterPanel className="lg:grid-cols-3">
				<div className="space-y-1">
					<p className="text-xs text-muted-foreground">Ordenar por</p>
					<Select
						value={sortBy}
						onValueChange={(value) => {
							void setSortBy(
								value as
									| "dueDate"
									| "expectedPaymentDate"
									| "description"
									| "totalAmount"
									| "status"
									| "createdAt",
							);
							void setPage(1);
						}}
					>
						<SelectTrigger className="w-full">
							<SelectValue placeholder="Campo" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="dueDate">Vencimento</SelectItem>
							<SelectItem value="expectedPaymentDate">
								Prev. pagamento
							</SelectItem>
							<SelectItem value="description">Descrição</SelectItem>
							<SelectItem value="totalAmount">Valor</SelectItem>
							<SelectItem value="status">Status</SelectItem>
							<SelectItem value="createdAt">Criação</SelectItem>
						</SelectContent>
					</Select>
				</div>

				<div className="space-y-1">
					<p className="text-xs text-muted-foreground">Direção</p>
					<Select
						value={sortDir}
						onValueChange={(value) => {
							void setSortDir(value as "asc" | "desc");
							void setPage(1);
						}}
					>
						<SelectTrigger className="w-full">
							<SelectValue placeholder="Direção" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="desc">Descendente</SelectItem>
							<SelectItem value="asc">Ascendente</SelectItem>
						</SelectContent>
					</Select>
				</div>

				<div className="space-y-1">
					<p className="text-xs text-muted-foreground">Por página</p>
					<Select
						value={String(currentPageSize)}
						onValueChange={(value) => {
							void setPageSize(Number(value));
							void setPage(1);
						}}
					>
						<SelectTrigger className="w-full">
							<SelectValue placeholder="20" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="20">20</SelectItem>
							<SelectItem value="50">50</SelectItem>
							<SelectItem value="100">100</SelectItem>
						</SelectContent>
					</Select>
				</div>
			</FilterPanel>

			{selectedTransactions.length > 0 && canManagePayments ? (
				<div className="flex flex-col gap-3 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-4 md:flex-row md:items-center md:justify-between">
					<p className="text-sm text-emerald-700 dark:text-emerald-300">
						{selectedTransactions.length} transação(ões) selecionada(s)
					</p>
					<Button
						type="button"
						className="w-full md:w-auto"
						onClick={() => void handleBulkPayToday()}
						disabled={isPaymentActionPending}
					>
						<CheckCheck className="size-4" />
						{isPaymentActionPending
							? "Processando..."
							: "Baixar selecionadas (hoje)"}
					</Button>
				</div>
			) : null}

			<ResponsiveDataView
				mobile={
					<div className="space-y-3">
						{transactions.length === 0 ? (
							<Card className="p-6 text-center">
								<p className="text-sm text-muted-foreground">
									Nenhuma transação encontrada para os filtros atuais.
								</p>
							</Card>
						) : (
							<>
								{canManagePayments ? (
									<Card className="p-3">
										<div className="flex items-center justify-between gap-3">
											<label className="flex items-center gap-2 text-sm">
												<Checkbox
													checked={
														allPageSelected
															? true
															: somePageSelected
																? "indeterminate"
																: false
													}
													onCheckedChange={(checked) =>
														togglePageSelection(Boolean(checked))
													}
													disabled={eligibleTransactions.length === 0}
													aria-label="Selecionar pendentes da página"
												/>
												<span>Selecionar pendentes da página</span>
											</label>
											<span className="text-xs text-muted-foreground">
												{eligibleTransactions.length} elegível(is)
											</span>
										</div>
									</Card>
								) : null}

								{transactions.map((transaction) => {
									const isSelectable =
										canManagePayments && transaction.status === "PENDING";
									const isSelected = selectedTransactionsById.has(
										transaction.id,
									);
									const dueDate = format(
										parseISO(transaction.dueDate),
										"dd/MM/yyyy",
									);
									const expectedPaymentDate = format(
										parseISO(transaction.expectedPaymentDate),
										"dd/MM/yyyy",
									);

									return (
										<Card key={transaction.id} className="p-4 space-y-3">
											<div className="flex items-start justify-between gap-3">
												<div className="min-w-0">
													<p className="font-medium text-sm truncate">
														{transaction.description}
													</p>
													<p className="text-xs text-muted-foreground">
														{transaction.code} · {transaction.company.name}
													</p>
												</div>
												<Checkbox
													checked={isSelected}
													onClick={(event) =>
														transactionMultiSelect.onCheckboxClick(
															transaction.id,
															event,
														)
													}
													onCheckedChange={(checked) =>
														transactionMultiSelect.onCheckboxCheckedChange(
															transaction.id,
															Boolean(checked),
														)
													}
													disabled={!isSelectable}
													aria-label={`Selecionar transação ${transaction.code}`}
												/>
											</div>

											<div className="grid grid-cols-2 gap-2 text-xs">
												<div className="space-y-0.5">
													<p className="text-muted-foreground">Vencimento</p>
													<p>{dueDate}</p>
												</div>
												<div className="space-y-0.5">
													<p className="text-muted-foreground">
														Prev. pagamento
													</p>
													<p>{expectedPaymentDate}</p>
												</div>
												<div className="space-y-0.5">
													<p className="text-muted-foreground">Categoria</p>
													<p>
														{transaction.category.children?.name ??
															transaction.category.name}
													</p>
												</div>
												<div className="space-y-0.5">
													<p className="text-muted-foreground">
														Centro de custo
													</p>
													<p>{transaction.costCenter.name}</p>
												</div>
											</div>

											<div className="flex items-center justify-between gap-3">
												<BadgeStatus
													status={transaction.status}
													dueDate={transaction.dueDate}
												/>
												<TransactionAmount type={transaction.type}>
													{transaction.totalAmount}
												</TransactionAmount>
											</div>

											<div className="flex flex-wrap gap-2">
												{canManagePayments &&
												transaction.status === "PENDING" ? (
													<Button
														type="button"
														size="sm"
														variant="outline"
														onClick={() => void handlePayToday(transaction.id)}
														disabled={isPaymentActionPending}
														className="flex-1"
													>
														Pagar hoje
													</Button>
												) : null}
												{canCreateTransactions ? (
													<Button
														size="sm"
														variant="outline"
														asChild
														className="flex-1"
													>
														<Link
															to="/transactions/create"
															search={{
																duplicateTransactionId: transaction.id,
															}}
														>
															<Copy className="size-4" />
															Duplicar
														</Link>
													</Button>
												) : null}
												{canUpdateTransactions ? (
													<Button
														size="sm"
														variant="ghost"
														asChild
														className="flex-1"
													>
														<Link
															to="/transactions/update/$transactionId"
															params={{ transactionId: transaction.id }}
														>
															<EllipsisVertical className="size-4" />
															Editar
														</Link>
													</Button>
												) : null}
											</div>
										</Card>
									);
								})}
							</>
						)}
					</div>
				}
				desktop={
					<div className="overflow-hidden rounded-md border bg-card">
						<div className="overflow-x-auto">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead className="w-[42px]">
											<Checkbox
												checked={
													canManagePayments
														? allPageSelected
															? true
															: somePageSelected
																? "indeterminate"
																: false
														: false
												}
												onCheckedChange={(checked) =>
													togglePageSelection(Boolean(checked))
												}
												disabled={
													!canManagePayments ||
													eligibleTransactions.length === 0
												}
												aria-label="Selecionar página atual"
											/>
										</TableHead>
										<TableHead>Vencimento</TableHead>
										<TableHead>Descrição</TableHead>
										<TableHead>Código</TableHead>
										<TableHead>Empresa</TableHead>
										<TableHead>Tipo</TableHead>
										<TableHead>Categoria</TableHead>
										<TableHead>Valor</TableHead>
										<TableHead>Status</TableHead>
										<TableHead className="w-[130px] text-right">
											Ações
										</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{transactions.length === 0 ? (
										<TableRow>
											<TableCell colSpan={10} className="h-24 text-center">
												Nenhuma transação encontrada para os filtros atuais.
											</TableCell>
										</TableRow>
									) : (
										transactions.map((transaction) => {
											const isSelectable =
												canManagePayments && transaction.status === "PENDING";
											const isSelected = selectedTransactionsById.has(
												transaction.id,
											);
											const dueDate = format(
												parseISO(transaction.dueDate),
												"dd/MM/yyyy",
											);
											const expectedPaymentDate = format(
												parseISO(transaction.expectedPaymentDate),
												"dd/MM/yyyy",
											);

											return (
												<TableRow key={transaction.id}>
													<TableCell>
														<Checkbox
															checked={isSelected}
															onClick={(event) =>
																transactionMultiSelect.onCheckboxClick(
																	transaction.id,
																	event,
																)
															}
															onCheckedChange={(checked) =>
																transactionMultiSelect.onCheckboxCheckedChange(
																	transaction.id,
																	Boolean(checked),
																)
															}
															disabled={!isSelectable}
															aria-label={`Selecionar transação ${transaction.code}`}
														/>
													</TableCell>
													<TableCell>
														<div className="flex flex-col gap-0">
															<span className="text-sm font-medium">
																{dueDate}
															</span>
															<span className="text-xs text-muted-foreground">
																Prev: {expectedPaymentDate}
															</span>
														</div>
													</TableCell>
													<TableCell>
														<div className="flex flex-col gap-0">
															<span className="text-sm font-medium">
																{transaction.description}
															</span>
															<span className="text-xs text-muted-foreground">
																{transaction.costCenter.name}
															</span>
														</div>
													</TableCell>
													<TableCell>{transaction.code}</TableCell>
													<TableCell>{transaction.company.name}</TableCell>
													<TableCell>
														<TransactionType
															type={transaction.type}
															refundedBy={transaction.refundedByEmployee}
														/>
													</TableCell>
													<TableCell>
														<div className="flex flex-col gap-0">
															<span>{transaction.category.name}</span>
															{transaction.category.children ? (
																<span className="text-xs text-muted-foreground">
																	{transaction.category.children.name}
																</span>
															) : null}
														</div>
													</TableCell>
													<TableCell>
														<TransactionAmount type={transaction.type}>
															{transaction.totalAmount}
														</TransactionAmount>
													</TableCell>
													<TableCell>
														<BadgeStatus
															status={transaction.status}
															dueDate={transaction.dueDate}
														/>
													</TableCell>
													<TableCell>
														<div className="flex items-center justify-end gap-1">
															{canManagePayments &&
															transaction.status === "PENDING" ? (
																<Button
																	type="button"
																	size="sm"
																	variant="outline"
																	onClick={() =>
																		void handlePayToday(transaction.id)
																	}
																	disabled={isPaymentActionPending}
																>
																	Pagar hoje
																</Button>
															) : null}
															{canCreateTransactions ? (
																<Button variant="ghost" size="icon" asChild>
																	<Link
																		to="/transactions/create"
																		search={{
																			duplicateTransactionId: transaction.id,
																		}}
																	>
																		<Copy className="size-4" />
																	</Link>
																</Button>
															) : null}
															{canUpdateTransactions ? (
																<Button variant="ghost" size="icon" asChild>
																	<Link
																		to="/transactions/update/$transactionId"
																		params={{ transactionId: transaction.id }}
																	>
																		<EllipsisVertical className="size-4" />
																	</Link>
																</Button>
															) : null}
														</div>
													</TableCell>
												</TableRow>
											);
										})
									)}
								</TableBody>
							</Table>
						</div>
					</div>
				}
			/>

			<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
				<span className="text-sm text-muted-foreground">
					Página {pagination?.page ?? currentPage} de{" "}
					{pagination?.totalPages ?? 1} · {pagination?.total ?? 0} transações
				</span>
				<div className="flex w-full items-center gap-2 md:w-auto">
					<Button
						variant="outline"
						size="sm"
						className="flex-1 md:flex-none"
						onClick={() => void setPage(Math.max(1, currentPage - 1))}
						disabled={currentPage <= 1}
					>
						Anterior
					</Button>
					<Button
						variant="outline"
						size="sm"
						className="flex-1 md:flex-none"
						onClick={() => void setPage(currentPage + 1)}
						disabled={currentPage >= (pagination?.totalPages ?? 1)}
					>
						Próxima
					</Button>
				</div>
			</div>
		</main>
	);
}
