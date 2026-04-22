import { Link } from "@tanstack/react-router";
import {
	CheckCheck,
	CheckCircle2,
	Eye,
	MoreHorizontal,
	Pencil,
	RotateCcw,
	Trash2,
	Undo2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { LoadingReveal } from "@/components/loading-reveal";
import { CardSectionSkeleton } from "@/components/loading-skeletons";
import { ResponsiveDataView } from "@/components/responsive-data-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApp } from "@/context/app-context";
import { useCommissionInstallments } from "@/hooks/commissions";
import { useCheckboxMultiSelect } from "@/hooks/use-checkbox-multi-select";
import {
	type GetOrganizationsSlugCommissionsInstallmentsQueryParamsDirectionEnumKey,
	useGetOrganizationsSlugCompanies,
	useGetOrganizationsSlugProducts,
} from "@/http/generated";
import { useAbility } from "@/permissions/access";
import {
	SALE_COMMISSION_DIRECTION_LABEL,
	SALE_COMMISSION_INSTALLMENT_STATUS_LABEL,
	SALE_COMMISSION_RECIPIENT_TYPE_LABEL,
	SALE_COMMISSION_SOURCE_TYPE_LABEL,
} from "@/schemas/types/sales";
import { formatCurrencyBRL } from "@/utils/format-amount";
import { CommissionsFiltersPanel } from "./commissions-filters-panel";
import { CommissionsInstallmentDialogs } from "./commissions-installment-dialogs";
import { CommissionsSummaryCards } from "./commissions-summary-cards";
import { useCommissionsInstallmentActions } from "./hooks/use-commissions-installment-actions";
import { useCommissionsInstallmentsFilters } from "./hooks/use-commissions-installments-filters";
import type {
	CommissionInstallmentRow,
	ProductTreeNode,
	SelectedInstallment,
} from "./types";
import {
	buildProductOptions,
	buildProductPathMap,
	canBulkChangeInstallmentStatus,
	canPayInstallment,
	canUpdateInstallments,
	formatDate,
	INSTALLMENT_STATUS_BADGE_CLASSNAME,
	resolveDirectionSummary,
} from "./utils";

export function CommissionsDataTable() {
	const { organization } = useApp();
	const ability = useAbility();
	const slug = organization?.slug ?? "";
	const canViewAllCommissions = ability.can(
		"access",
		"sales.commissions.view.all",
	);
	const canChangeInstallmentStatus = ability.can(
		"access",
		"sales.commissions.installments.status.change",
	);
	const canEditInstallment = ability.can(
		"access",
		"sales.commissions.installments.update",
	);
	const canDeleteInstallment = ability.can(
		"access",
		"sales.commissions.installments.delete",
	);
	const canPerformInstallmentActions =
		canChangeInstallmentStatus || canEditInstallment || canDeleteInstallment;

	const [selectedInstallmentsById, setSelectedInstallmentsById] = useState(
		() => new Map<string, SelectedInstallment>(),
	);

	function clearSelectedInstallments() {
		setSelectedInstallmentsById(new Map());
	}

	const {
		directionFilter,
		statusFilter,
		searchFilter,
		companyIdFilter,
		unitIdFilter,
		productIdFilter,
		currentPage,
		currentPageSize,
		effectiveExpectedFrom,
		effectiveExpectedTo,
		effectiveDirectionFilter,
		setPage,
		setUnitIdFilter,
		handleDirectionChange,
		handleStatusChange,
		handleSearchChange,
		handleCompanyIdChange,
		handleUnitIdChange,
		handleProductIdChange,
		handleExpectedFromChange,
		handleExpectedToChange,
		handlePageSizeChange,
		clearFilters,
	} = useCommissionsInstallmentsFilters({
		canViewAllCommissions,
		onBeforeFilterChange: clearSelectedInstallments,
	});

	const { data, isLoading, isError, refetch } = useCommissionInstallments({
		page: currentPage,
		pageSize: currentPageSize,
		q: searchFilter,
		companyId: companyIdFilter || undefined,
		unitId: unitIdFilter || undefined,
		productId: productIdFilter || undefined,
		direction: effectiveDirectionFilter,
		status: statusFilter,
		expectedFrom: effectiveExpectedFrom,
		expectedTo: effectiveExpectedTo,
	});

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

		return (
			companies.find((company) => company.id === companyIdFilter)?.units ?? []
		);
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

	useEffect(() => {
		if (!data?.pagination.totalPages) {
			return;
		}

		if (currentPage > data.pagination.totalPages) {
			setPage(data.pagination.totalPages);
		}
	}, [currentPage, data?.pagination.totalPages, setPage]);

	const installments = useMemo(() => data?.items ?? [], [data?.items]);
	const reversalAmountByOriginInstallmentId = useMemo(() => {
		const map = new Map<string, number>();

		for (const installment of installments) {
			if (!installment.originInstallmentId) {
				continue;
			}

			map.set(
				installment.originInstallmentId,
				(map.get(installment.originInstallmentId) ?? 0) + installment.amount,
			);
		}

		return map;
	}, [installments]);

	function resolveDisplayInstallmentAmount(
		installment: CommissionInstallmentRow,
	) {
		if (installment.originInstallmentId) {
			return installment.amount;
		}

		const totalReversedAmount =
			reversalAmountByOriginInstallmentId.get(installment.id) ?? 0;
		return installment.amount + totalReversedAmount;
	}
	const summaryByDirection = data?.summaryByDirection;
	const paySummary = resolveDirectionSummary(summaryByDirection, "OUTCOME");
	const receiveSummary = resolveDirectionSummary(summaryByDirection, "INCOME");
	const summaryForCurrentUser = canViewAllCommissions
		? receiveSummary
		: paySummary;
	const pendingSummaryForCurrentUser = summaryForCurrentUser.pending;
	const paidSummaryForCurrentUser = summaryForCurrentUser.paid;
	const reversedSummaryForCurrentUser = summaryForCurrentUser.reversed;
	const pagination = data?.pagination;
	const productPathById = useMemo(
		() =>
			buildProductPathMap(
				(productsQuery.data?.products ?? []) as ProductTreeNode[],
			),
		[productsQuery.data?.products],
	);
	const productOptions = useMemo(
		() =>
			buildProductOptions(
				(productsQuery.data?.products ?? []) as ProductTreeNode[],
			),
		[productsQuery.data?.products],
	);

	const eligibleInstallmentsOnPage = useMemo(
		() =>
			canChangeInstallmentStatus
				? installments.filter(canBulkChangeInstallmentStatus)
				: [],
		[canChangeInstallmentStatus, installments],
	);
	const allPageSelected =
		eligibleInstallmentsOnPage.length > 0 &&
		eligibleInstallmentsOnPage.every((installment) =>
			selectedInstallmentsById.has(installment.id),
		);
	const somePageSelected =
		!allPageSelected &&
		eligibleInstallmentsOnPage.some((installment) =>
			selectedInstallmentsById.has(installment.id),
		);
	const selectedInstallments = useMemo(
		() => Array.from(selectedInstallmentsById.values()),
		[selectedInstallmentsById],
	);
	const selectableInstallmentIds = useMemo(
		() =>
			new Set(eligibleInstallmentsOnPage.map((installment) => installment.id)),
		[eligibleInstallmentsOnPage],
	);
	const visibleInstallmentsById = useMemo(
		() =>
			new Map(installments.map((installment) => [installment.id, installment])),
		[installments],
	);
	const selectedInstallmentsTotalAmount = useMemo(
		() =>
			selectedInstallments.reduce(
				(sum, installment) => sum + installment.amount,
				0,
			),
		[selectedInstallments],
	);

	function removeSelectedInstallment(installmentId: string) {
		setSelectedInstallmentsById((current) => {
			if (!current.has(installmentId)) {
				return current;
			}

			const next = new Map(current);
			next.delete(installmentId);
			return next;
		});
	}

	function removeSelectedInstallments(installmentIds: string[]) {
		if (installmentIds.length === 0) {
			return;
		}

		setSelectedInstallmentsById((current) => {
			const next = new Map(current);
			for (const installmentId of installmentIds) {
				next.delete(installmentId);
			}
			return next;
		});
	}

	function toggleInstallmentSelection(
		installment: CommissionInstallmentRow,
		checked: boolean,
	) {
		if (!canChangeInstallmentStatus) {
			return;
		}

		setSelectedInstallmentsById((current) => {
			const next = new Map(current);

			if (checked) {
				if (!installment.saleId) {
					return next;
				}
				next.set(installment.id, {
					id: installment.id,
					saleId: installment.saleId,
					amount: installment.amount,
					status: installment.status,
				});
			} else {
				next.delete(installment.id);
			}

			return next;
		});
	}

	function togglePageSelection(checked: boolean) {
		if (!canChangeInstallmentStatus) {
			return;
		}

		setSelectedInstallmentsById((current) => {
			const next = new Map(current);

			for (const installment of eligibleInstallmentsOnPage) {
				if (checked) {
					if (!installment.saleId) {
						continue;
					}
					next.set(installment.id, {
						id: installment.id,
						saleId: installment.saleId,
						amount: installment.amount,
						status: installment.status,
					});
				} else {
					next.delete(installment.id);
				}
			}

			return next;
		});
	}

	function handleInstallmentCheckedChange(
		installmentId: string,
		checked: boolean,
	) {
		const installment = visibleInstallmentsById.get(installmentId);
		if (!installment) {
			return;
		}

		toggleInstallmentSelection(installment, checked);
	}

	function toggleVisibleInstallments(
		installmentIds: string[],
		checked: boolean,
	) {
		if (!canChangeInstallmentStatus) {
			return;
		}

		setSelectedInstallmentsById((current) => {
			const next = new Map(current);

			for (const installmentId of installmentIds) {
				const installment = visibleInstallmentsById.get(installmentId);
				if (!installment || !selectableInstallmentIds.has(installmentId)) {
					continue;
				}

				if (checked) {
					if (!installment.saleId) {
						continue;
					}
					next.set(installment.id, {
						id: installment.id,
						saleId: installment.saleId,
						amount: installment.amount,
						status: installment.status,
					});
				} else {
					next.delete(installment.id);
				}
			}

			return next;
		});
	}

	const installmentsMultiSelect = useCheckboxMultiSelect<string>({
		visibleIds: installments.map((installment) => installment.id),
		isSelectable: (installmentId) =>
			selectableInstallmentIds.has(installmentId),
		toggleOne: handleInstallmentCheckedChange,
		toggleMany: toggleVisibleInstallments,
		onClearSelection: clearSelectedInstallments,
		enabled: canChangeInstallmentStatus,
	});

	const {
		payAction,
		setPayAction,
		editingInstallment,
		setEditingInstallment,
		reversalAction,
		setReversalAction,
		reversalUndoAction,
		setReversalUndoAction,
		installmentToDelete,
		setInstallmentToDelete,
		isBulkStatusDialogOpen,
		setIsBulkStatusDialogOpen,
		bulkStatus,
		setBulkStatus,
		bulkStatusDate,
		setBulkStatusDate,
		isPaymentActionPending,
		isPreparingReversal,
		isPatchingStatus,
		isUpdatingInstallment,
		isReversingInstallment,
		isUndoingInstallmentReversal,
		isDeletingInstallment,
		requestInstallmentPayment,
		requestInstallmentEdition,
		requestInstallmentReversal,
		requestInstallmentReversalUndo,
		requestInstallmentDelete,
		handleConfirmInstallmentPayment,
		handlePayInstallmentToday,
		handleConfirmBulkStatusChange,
		handleConfirmInstallmentEdition,
		handleConfirmInstallmentReversal,
		handleConfirmInstallmentReversalUndo,
		handleConfirmInstallmentDelete,
		openBulkStatusDialog,
		resetBulkStatusDate,
	} = useCommissionsInstallmentActions({
		canChangeInstallmentStatus,
		canEditInstallment,
		canDeleteInstallment,
		selectedInstallments,
		onDeselectInstallment: removeSelectedInstallment,
		onDeselectInstallments: removeSelectedInstallments,
	});
	const isAnyInstallmentActionPending =
		isPatchingStatus ||
		isUpdatingInstallment ||
		isReversingInstallment ||
		isUndoingInstallmentReversal ||
		isDeletingInstallment ||
		isPreparingReversal ||
		isPaymentActionPending;

	return (
		<>
			<div className="space-y-4">
				{canViewAllCommissions ? (
					<Tabs
						value={directionFilter}
						onValueChange={(value) =>
							handleDirectionChange(
								value as GetOrganizationsSlugCommissionsInstallmentsQueryParamsDirectionEnumKey,
							)
						}
					>
						<TabsList className="w-fit rounded-sm">
							<TabsTrigger value="OUTCOME">A pagar</TabsTrigger>
							<TabsTrigger value="INCOME">A receber</TabsTrigger>
						</TabsList>
					</Tabs>
				) : null}

				<CommissionsSummaryCards
					canViewAllCommissions={canViewAllCommissions}
					paySummary={paySummary}
					receiveSummary={receiveSummary}
					pendingSummaryForCurrentUser={pendingSummaryForCurrentUser}
					paidSummaryForCurrentUser={paidSummaryForCurrentUser}
					reversedSummaryForCurrentUser={reversedSummaryForCurrentUser}
				/>

				<CommissionsFiltersPanel
					searchFilter={searchFilter}
					companyIdFilter={companyIdFilter}
					unitIdFilter={unitIdFilter}
					productIdFilter={productIdFilter}
					statusFilter={statusFilter}
					effectiveExpectedFrom={effectiveExpectedFrom}
					effectiveExpectedTo={effectiveExpectedTo}
					currentPageSize={currentPageSize}
					companies={companies}
					unitsBySelectedCompany={unitsBySelectedCompany}
					productOptions={productOptions}
					onSearchChange={handleSearchChange}
					onCompanyIdChange={handleCompanyIdChange}
					onUnitIdChange={handleUnitIdChange}
					onProductIdChange={handleProductIdChange}
					onStatusChange={handleStatusChange}
					onExpectedFromChange={handleExpectedFromChange}
					onExpectedToChange={handleExpectedToChange}
					onPageSizeChange={handlePageSizeChange}
					onClearFilters={clearFilters}
				/>

				{canChangeInstallmentStatus && selectedInstallments.length > 0 ? (
					<div className="flex flex-col gap-3 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-4 md:flex-row md:items-center md:justify-between">
						<p className="text-sm text-emerald-700 dark:text-emerald-300">
							{selectedInstallments.length} parcela(s) selecionada(s) · total{" "}
							{formatCurrencyBRL(selectedInstallmentsTotalAmount / 100)}
						</p>
						<div className="flex flex-col gap-2 md:flex-row">
							<Button
								type="button"
								disabled={isPaymentActionPending}
								onClick={openBulkStatusDialog}
							>
								Alterar status em lote
							</Button>
						</div>
					</div>
				) : null}

				{isError ? (
					<div className="space-y-3">
						<p className="text-sm text-destructive">
							Não foi possível carregar as comissões.
						</p>
						<Button type="button" variant="outline" onClick={() => refetch()}>
							Tentar novamente
						</Button>
					</div>
				) : (
					<LoadingReveal
						loading={isLoading}
						skeleton={
							<CardSectionSkeleton
								rows={5}
								cardClassName="border-dashed p-4 shadow-none"
							/>
						}
						contentKey={`${currentPage}-${currentPageSize}-${statusFilter}-${companyIdFilter}-${unitIdFilter}-${productIdFilter}`}
					>
						<ResponsiveDataView
							mobile={
								<div className="space-y-3">
									{canChangeInstallmentStatus ? (
										<Card className="p-3">
											<div className="flex items-center justify-between gap-3">
												<div className="flex items-center gap-2 text-sm">
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
														disabled={eligibleInstallmentsOnPage.length === 0}
														aria-label="Selecionar página atual"
													/>
													<span>Selecionar parcelas da página</span>
												</div>
												<span className="text-xs text-muted-foreground">
													{eligibleInstallmentsOnPage.length} elegível(is)
												</span>
											</div>
										</Card>
									) : null}

									{installments.length === 0 ? (
										<Card className="p-6 text-center text-sm text-muted-foreground">
											Nenhuma parcela encontrada para os filtros atuais.
										</Card>
									) : (
										installments.map((installment) => {
											const canEditRow = canUpdateInstallments(
												installment.saleStatus,
											);
											const isReversalMovement = Boolean(
												installment.originInstallmentId,
											);
											const canBulkStatusRow =
												canBulkChangeInstallmentStatus(installment) &&
												canChangeInstallmentStatus;
											const canPayRow = canPayInstallment(installment);
											const canChangeStatusRow =
												canPayRow && canChangeInstallmentStatus;
											const canEditRowAction = canEditRow && canEditInstallment;
											const canDeleteRowAction =
												canEditRow && canDeleteInstallment;
											const canReverseRow =
												canEditRow &&
												canChangeInstallmentStatus &&
												!isReversalMovement &&
												(installment.status === "PENDING" ||
													installment.status === "PAID");
											const canUndoReversalRow =
												canEditRow &&
												canChangeInstallmentStatus &&
												installment.status === "REVERSED";
											const canOpenRowActions =
												canChangeStatusRow ||
												canEditRowAction ||
												canReverseRow ||
												canUndoReversalRow ||
												canDeleteRowAction;
											const isSelected = selectedInstallmentsById.has(
												installment.id,
											);
											const displayAmount =
												resolveDisplayInstallmentAmount(installment);
											const hasLinkedReversal =
												!installment.originInstallmentId &&
												displayAmount !== installment.amount;
											const productLabel =
												productPathById.get(installment.product.id) ??
												installment.product.name;

											return (
												<Card key={installment.id} className="space-y-3 p-4">
													<div className="flex items-start justify-between gap-3">
														<div className="min-w-0">
															<p className="truncate text-sm font-medium">
																{installment.customer?.name ??
																	installment.bonusContext?.scenarioName ??
																	"Bônus"}
															</p>
															<p className="truncate text-xs text-muted-foreground">
																{productLabel}
															</p>
														</div>
														<Checkbox
															checked={isSelected}
															onClick={(event) =>
																installmentsMultiSelect.onCheckboxClick(
																	installment.id,
																	event,
																)
															}
															onCheckedChange={(checked) =>
																installmentsMultiSelect.onCheckboxCheckedChange(
																	installment.id,
																	Boolean(checked),
																)
															}
															disabled={!canBulkStatusRow}
															aria-label={`Selecionar parcela ${installment.installmentNumber}`}
														/>
													</div>

													<div className="flex items-center justify-between gap-3">
														<Badge
															variant="outline"
															className={
																INSTALLMENT_STATUS_BADGE_CLASSNAME[
																	installment.status
																]
															}
														>
															{
																SALE_COMMISSION_INSTALLMENT_STATUS_LABEL[
																	installment.status
																]
															}
														</Badge>
														<p className="text-sm font-semibold">
															{formatCurrencyBRL(displayAmount / 100)}
														</p>
													</div>
													{hasLinkedReversal ? (
														<p className="text-xs text-muted-foreground">
															Valor base:{" "}
															{formatCurrencyBRL(installment.amount / 100)}
														</p>
													) : null}

													<div className="grid grid-cols-2 gap-2 text-xs">
														<div className="space-y-0.5">
															<p className="text-muted-foreground">Previsão</p>
															<p>
																{formatDate(installment.expectedPaymentDate)}
															</p>
														</div>
														<div className="space-y-0.5">
															<p className="text-muted-foreground">Pagamento</p>
															<p>
																{installment.paymentDate
																	? formatDate(installment.paymentDate)
																	: "—"}
															</p>
														</div>
														<div className="space-y-0.5">
															<p className="text-muted-foreground">
																Beneficiário
															</p>
															<p>
																{installment.beneficiaryLabel ??
																	SALE_COMMISSION_RECIPIENT_TYPE_LABEL[
																		installment.recipientType
																	]}
															</p>
														</div>
														<div className="space-y-0.5">
															<p className="text-muted-foreground">Origem</p>
															<p>
																{
																	SALE_COMMISSION_SOURCE_TYPE_LABEL[
																		installment.sourceType
																	]
																}
															</p>
															{isReversalMovement ? (
																<p className="text-muted-foreground">
																	Estorno da parcela P
																	{installment.originInstallmentNumber ??
																		installment.installmentNumber}
																</p>
															) : null}
														</div>
													</div>

													<div className="grid grid-cols-2 gap-2">
														{installment.saleId ? (
															<Button variant="outline" size="sm" asChild>
																<Link
																	to="/sales/$saleId"
																	params={{ saleId: installment.saleId }}
																>
																	<Eye className="size-4" />
																	Ver venda
																</Link>
															</Button>
														) : (
															<Button variant="outline" size="sm" disabled>
																<Eye className="size-4" />
																Bônus
															</Button>
														)}
														<Button
															type="button"
															variant="outline"
															size="sm"
															className="!min-h-8"
															disabled={!canChangeStatusRow}
															onClick={() =>
																void handlePayInstallmentToday(installment)
															}
														>
															<CheckCheck className="size-4" />
															Pagar hoje
														</Button>
													</div>

													{canPerformInstallmentActions ? (
														<DropdownMenu>
															<DropdownMenuTrigger asChild>
																<Button
																	type="button"
																	variant="outline"
																	size="sm"
																	className="w-full"
																	disabled={
																		isAnyInstallmentActionPending ||
																		!canOpenRowActions
																	}
																>
																	<MoreHorizontal className="size-4" />
																	Mais ações
																</Button>
															</DropdownMenuTrigger>
															<DropdownMenuContent align="end">
																<DropdownMenuItem
																	disabled={!canEditRowAction}
																	onSelect={(event) => {
																		event.preventDefault();
																		if (!canEditRowAction) {
																			return;
																		}
																		requestInstallmentEdition(installment);
																	}}
																>
																	<Pencil className="size-4" />
																	Editar parcela
																</DropdownMenuItem>
																<DropdownMenuItem
																	disabled={!canChangeStatusRow}
																	onSelect={(event) => {
																		event.preventDefault();
																		if (!canChangeStatusRow) {
																			return;
																		}
																		requestInstallmentPayment(installment);
																	}}
																>
																	<CheckCircle2 className="size-4" />
																	Pagar parcela
																</DropdownMenuItem>
																<DropdownMenuItem
																	disabled={!canReverseRow}
																	onSelect={(event) => {
																		event.preventDefault();
																		if (!canReverseRow) {
																			return;
																		}
																		void requestInstallmentReversal(
																			installment,
																		);
																	}}
																>
																	<Undo2 className="size-4" />
																	Estornar parcela
																</DropdownMenuItem>
																<DropdownMenuItem
																	disabled={!canUndoReversalRow}
																	onSelect={(event) => {
																		event.preventDefault();
																		if (!canUndoReversalRow) {
																			return;
																		}
																		requestInstallmentReversalUndo(installment);
																	}}
																>
																	<RotateCcw className="size-4" />
																	Reverter estorno
																</DropdownMenuItem>
																<DropdownMenuItem
																	variant="destructive"
																	disabled={!canDeleteRowAction}
																	onSelect={(event) => {
																		event.preventDefault();
																		if (!canDeleteRowAction) {
																			return;
																		}
																		requestInstallmentDelete(installment);
																	}}
																>
																	<Trash2 className="size-4" />
																	Excluir parcela
																</DropdownMenuItem>
															</DropdownMenuContent>
														</DropdownMenu>
													) : null}
												</Card>
											);
										})
									)}
								</div>
							}
							desktop={
								<div className="hidden overflow-hidden rounded-md border bg-card md:block">
									<Table>
										<TableHeader>
											<TableRow>
												<TableHead className="w-[42px]">
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
														disabled={eligibleInstallmentsOnPage.length === 0}
														aria-label="Selecionar página atual"
													/>
												</TableHead>
												<TableHead>Previsão</TableHead>
												<TableHead>Recebido em</TableHead>
												<TableHead>Status</TableHead>
												<TableHead>Beneficiário</TableHead>
												<TableHead>Venda</TableHead>
												<TableHead>Valor</TableHead>
												<TableHead>%</TableHead>
												<TableHead>Origem</TableHead>
												{canPerformInstallmentActions ? (
													<TableHead className="w-[92px] text-right">
														Ações
													</TableHead>
												) : null}
											</TableRow>
										</TableHeader>
										<TableBody>
											{installments.length === 0 ? (
												<TableRow>
													<TableCell
														colSpan={canPerformInstallmentActions ? 10 : 9}
														className="h-20 text-center"
													>
														Nenhuma parcela encontrada para os filtros atuais.
													</TableCell>
												</TableRow>
											) : (
												installments.map((installment) => {
													const canEditRow = canUpdateInstallments(
														installment.saleStatus,
													);
													const isReversalMovement = Boolean(
														installment.originInstallmentId,
													);
													const canBulkStatusRow =
														canBulkChangeInstallmentStatus(installment) &&
														canChangeInstallmentStatus;
													const canPayRow = canPayInstallment(installment);
													const canChangeStatusRow =
														canPayRow && canChangeInstallmentStatus;
													const canEditRowAction =
														canEditRow && canEditInstallment;
													const canDeleteRowAction =
														canEditRow && canDeleteInstallment;
													const canReverseRow =
														canEditRow &&
														canChangeInstallmentStatus &&
														!isReversalMovement &&
														(installment.status === "PENDING" ||
															installment.status === "PAID");
													const canUndoReversalRow =
														canEditRow &&
														canChangeInstallmentStatus &&
														installment.status === "REVERSED";
													const canOpenRowActions =
														canChangeStatusRow ||
														canEditRowAction ||
														canReverseRow ||
														canUndoReversalRow ||
														canDeleteRowAction;
													const isSelected = selectedInstallmentsById.has(
														installment.id,
													);
													const displayAmount =
														resolveDisplayInstallmentAmount(installment);
													const hasLinkedReversal =
														!installment.originInstallmentId &&
														displayAmount !== installment.amount;
													const productLabel =
														productPathById.get(installment.product.id) ??
														installment.product.name;

													return (
														<TableRow key={installment.id}>
															<TableCell>
																<Checkbox
																	checked={isSelected}
																	onClick={(event) =>
																		installmentsMultiSelect.onCheckboxClick(
																			installment.id,
																			event,
																		)
																	}
																	onCheckedChange={(checked) =>
																		installmentsMultiSelect.onCheckboxCheckedChange(
																			installment.id,
																			Boolean(checked),
																		)
																	}
																	disabled={!canBulkStatusRow}
																	aria-label={`Selecionar parcela ${installment.installmentNumber}`}
																/>
															</TableCell>
															<TableCell>
																{formatDate(installment.expectedPaymentDate)}
															</TableCell>
															<TableCell>
																{installment.paymentDate
																	? formatDate(installment.paymentDate)
																	: "—"}
															</TableCell>
															<TableCell>
																<Badge
																	variant="outline"
																	className={
																		INSTALLMENT_STATUS_BADGE_CLASSNAME[
																			installment.status
																		]
																	}
																>
																	{
																		SALE_COMMISSION_INSTALLMENT_STATUS_LABEL[
																			installment.status
																		]
																	}
																</Badge>
															</TableCell>
															<TableCell>
																<p className="font-medium">
																	{installment.beneficiaryLabel ??
																		SALE_COMMISSION_RECIPIENT_TYPE_LABEL[
																			installment.recipientType
																		]}
																</p>
																<p className="text-xs text-muted-foreground">
																	{
																		SALE_COMMISSION_DIRECTION_LABEL[
																			installment.direction
																		]
																	}
																</p>
															</TableCell>
															<TableCell>
																<p className="font-medium">
																	{installment.customer?.name ??
																		installment.bonusContext?.scenarioName ??
																		"Bônus"}
																</p>
																<p className="text-xs text-muted-foreground">
																	{productLabel}
																</p>
																<p className="text-xs text-muted-foreground">
																	{installment.company?.name ?? "Bônus"}
																	{installment.unit
																		? ` -> ${installment.unit.name}`
																		: ""}
																</p>
															</TableCell>
															<TableCell>
																<p>{formatCurrencyBRL(displayAmount / 100)}</p>
																{hasLinkedReversal ? (
																	<p className="text-xs text-muted-foreground">
																		Valor base:{" "}
																		{formatCurrencyBRL(
																			installment.amount / 100,
																		)}
																	</p>
																) : null}
															</TableCell>
															<TableCell>{installment.percentage}%</TableCell>
															<TableCell>
																{
																	SALE_COMMISSION_SOURCE_TYPE_LABEL[
																		installment.sourceType
																	]
																}
																{isReversalMovement ? (
																	<p className="text-xs text-muted-foreground">
																		Estorno da parcela P
																		{installment.originInstallmentNumber ??
																			installment.installmentNumber}
																	</p>
																) : null}
															</TableCell>
															{canPerformInstallmentActions ? (
																<TableCell className="text-right">
																	<DropdownMenu>
																		<DropdownMenuTrigger asChild>
																			<Button
																				type="button"
																				variant="ghost"
																				size="icon"
																				disabled={
																					isAnyInstallmentActionPending ||
																					!canOpenRowActions
																				}
																			>
																				<MoreHorizontal className="size-4" />
																			</Button>
																		</DropdownMenuTrigger>
																		<DropdownMenuContent align="end">
																			{installment.saleId ? (
																				<>
																					<DropdownMenuItem asChild>
																						<Link
																							to="/sales/$saleId"
																							params={{
																								saleId: installment.saleId,
																							}}
																						>
																							<Eye className="size-4" />
																							Ver venda
																						</Link>
																					</DropdownMenuItem>
																					<DropdownMenuSeparator />
																				</>
																			) : null}
																			<DropdownMenuItem
																				disabled={!canEditRowAction}
																				onSelect={(event) => {
																					event.preventDefault();
																					if (!canEditRowAction) {
																						return;
																					}
																					requestInstallmentEdition(
																						installment,
																					);
																				}}
																			>
																				<Pencil className="size-4" />
																				Editar parcela
																			</DropdownMenuItem>
																			<DropdownMenuItem
																				disabled={!canChangeStatusRow}
																				onSelect={(event) => {
																					event.preventDefault();
																					if (!canChangeStatusRow) {
																						return;
																					}
																					requestInstallmentPayment(
																						installment,
																					);
																				}}
																			>
																				<CheckCircle2 className="size-4" />
																				Pagar parcela
																			</DropdownMenuItem>
																			<DropdownMenuItem
																				disabled={!canChangeStatusRow}
																				onSelect={(event) => {
																					event.preventDefault();
																					if (!canChangeStatusRow) {
																						return;
																					}
																					void handlePayInstallmentToday(
																						installment,
																					);
																				}}
																			>
																				<CheckCheck className="size-4" />
																				Pagar hoje
																			</DropdownMenuItem>
																			<DropdownMenuItem
																				disabled={!canReverseRow}
																				onSelect={(event) => {
																					event.preventDefault();
																					if (!canReverseRow) {
																						return;
																					}
																					void requestInstallmentReversal(
																						installment,
																					);
																				}}
																			>
																				<Undo2 className="size-4" />
																				Estornar parcela
																			</DropdownMenuItem>
																			<DropdownMenuItem
																				disabled={!canUndoReversalRow}
																				onSelect={(event) => {
																					event.preventDefault();
																					if (!canUndoReversalRow) {
																						return;
																					}
																					requestInstallmentReversalUndo(
																						installment,
																					);
																				}}
																			>
																				<RotateCcw className="size-4" />
																				Reverter estorno
																			</DropdownMenuItem>
																			<DropdownMenuItem
																				variant="destructive"
																				disabled={!canDeleteRowAction}
																				onSelect={(event) => {
																					event.preventDefault();
																					if (!canDeleteRowAction) {
																						return;
																					}
																					requestInstallmentDelete(installment);
																				}}
																			>
																				<Trash2 className="size-4" />
																				Excluir parcela
																			</DropdownMenuItem>
																		</DropdownMenuContent>
																	</DropdownMenu>
																</TableCell>
															) : null}
														</TableRow>
													);
												})
											)}
										</TableBody>
									</Table>
								</div>
							}
						/>

						<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
							<p className="text-sm text-muted-foreground">
								Página {pagination?.page ?? currentPage} de{" "}
								{pagination?.totalPages ?? 1} · {pagination?.total ?? 0}{" "}
								parcelas
							</p>
							<div className="flex items-center gap-2">
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={() => setPage(Math.max(1, currentPage - 1))}
									disabled={currentPage <= 1}
								>
									Anterior
								</Button>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={() => setPage(currentPage + 1)}
									disabled={currentPage >= (pagination?.totalPages ?? 1)}
								>
									Próxima
								</Button>
							</div>
						</div>
					</LoadingReveal>
				)}
			</div>

			<CommissionsInstallmentDialogs
				selectedInstallmentsCount={selectedInstallments.length}
				selectedInstallmentsTotalAmount={selectedInstallmentsTotalAmount}
				canChangeInstallmentStatus={canChangeInstallmentStatus}
				canEditInstallment={canEditInstallment}
				canDeleteInstallment={canDeleteInstallment}
				isBulkStatusDialogOpen={isBulkStatusDialogOpen}
				onBulkStatusDialogOpenChange={(open) => {
					setIsBulkStatusDialogOpen(open);
					if (open) {
						resetBulkStatusDate();
					}
				}}
				bulkStatus={bulkStatus}
				onBulkStatusChange={setBulkStatus}
				bulkStatusDate={bulkStatusDate}
				onBulkStatusDateChange={setBulkStatusDate}
				onConfirmBulkStatusChange={handleConfirmBulkStatusChange}
				isPaymentActionPending={isPaymentActionPending}
				payAction={payAction}
				onPayActionChange={setPayAction}
				onConfirmInstallmentPayment={handleConfirmInstallmentPayment}
				isPatchingStatus={isPatchingStatus}
				reversalAction={reversalAction}
				onReversalActionChange={setReversalAction}
				onConfirmInstallmentReversal={handleConfirmInstallmentReversal}
				isReversingInstallment={isReversingInstallment}
				reversalUndoAction={reversalUndoAction}
				onReversalUndoActionChange={setReversalUndoAction}
				onConfirmInstallmentReversalUndo={handleConfirmInstallmentReversalUndo}
				isUndoingInstallmentReversal={isUndoingInstallmentReversal}
				editingInstallment={editingInstallment}
				onEditingInstallmentChange={setEditingInstallment}
				onConfirmInstallmentEdition={handleConfirmInstallmentEdition}
				isUpdatingInstallment={isUpdatingInstallment}
				installmentToDelete={installmentToDelete}
				onInstallmentToDeleteChange={setInstallmentToDelete}
				onConfirmInstallmentDelete={handleConfirmInstallmentDelete}
				isDeletingInstallment={isDeletingInstallment}
			/>
		</>
	);
}
