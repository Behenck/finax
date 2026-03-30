import { endOfMonth, format, parseISO, startOfMonth } from "date-fns";
import {
	CheckCircle2,
	CheckCheck,
	Eye,
	MoreHorizontal,
	Pencil,
	RefreshCcw,
	Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useQueryState } from "nuqs";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarDateInput } from "@/components/ui/calendar-date-input";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { FilterPanel } from "@/components/filter-panel";
import { ResponsiveDataView } from "@/components/responsive-data-view";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApp } from "@/context/app-context";
import { useCommissionInstallments } from "@/hooks/commissions";
import {
	commissionDirectionParser,
	commissionInstallmentStatusParser,
	dateFilterParser,
	entityFilterParser,
	pageParser,
	pageSizeParser,
	productFilterParser,
	textFilterParser,
} from "@/hooks/filters/parsers";
import { useCheckboxMultiSelect } from "@/hooks/use-checkbox-multi-select";
import {
	useDeleteSaleCommissionInstallment,
	usePatchSaleCommissionInstallmentStatus,
	useUpdateSaleCommissionInstallment,
} from "@/hooks/sales";
import {
	type GetOrganizationsSlugCommissionsInstallments200,
	type GetOrganizationsSlugCommissionsInstallmentsQueryParamsDirectionEnumKey,
	type GetOrganizationsSlugCommissionsInstallmentsQueryParamsStatusEnumKey,
	useGetOrganizationsSlugCompanies,
	useGetOrganizationsSlugProducts,
} from "@/http/generated";
import {
	SALE_COMMISSION_DIRECTION_LABEL,
	SALE_COMMISSION_INSTALLMENT_STATUS_LABEL,
	SALE_COMMISSION_RECIPIENT_TYPE_LABEL,
	SALE_COMMISSION_SOURCE_TYPE_LABEL,
	type SaleCommissionInstallmentStatus,
	type SaleStatus,
} from "@/schemas/types/sales";
import {
	formatCurrencyBRL,
	parseBRLCurrencyToCents,
} from "@/utils/format-amount";
import { useAbility } from "@/permissions/access";

const COMMISSIONS_FILTERS_STORAGE_KEY = "finax:commissions:list:filters";

type CommissionInstallmentRow =
	GetOrganizationsSlugCommissionsInstallments200["items"][number];

type ProductTreeNode = {
	id: string;
	name: string;
	children?: ProductTreeNode[];
};

type InstallmentPayAction = {
	installment: CommissionInstallmentRow;
	paymentDate: string;
	amount: string;
};

type InstallmentEditState = {
	installment: CommissionInstallmentRow;
	percentage: string;
	amount: string;
	status: SaleCommissionInstallmentStatus;
	expectedPaymentDate: string;
	paymentDate: string;
};

type InstallmentSummaryBucket = {
	count: number;
	amount: number;
};

type InstallmentDirectionSummary = {
	total: InstallmentSummaryBucket;
	pending: InstallmentSummaryBucket;
	paid: InstallmentSummaryBucket;
	canceled: InstallmentSummaryBucket;
};

type SelectedInstallment = {
	id: string;
	saleId: string;
	amount: number;
};

type ProductOption = {
	id: string;
	label: string;
};

const EMPTY_DIRECTION_SUMMARY: InstallmentDirectionSummary = {
	total: {
		count: 0,
		amount: 0,
	},
	pending: {
		count: 0,
		amount: 0,
	},
	paid: {
		count: 0,
		amount: 0,
	},
	canceled: {
		count: 0,
		amount: 0,
	},
};

const INSTALLMENT_STATUS_BADGE_CLASSNAME: Record<
	SaleCommissionInstallmentStatus,
	string
> = {
	PENDING: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 border-yellow-500/30",
	PAID: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
	CANCELED: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
};

function formatDate(value: string) {
	return format(parseISO(value), "dd/MM/yyyy");
}

function toDateInputValue(value?: string | null) {
	return value ? value.slice(0, 10) : "";
}

function getTodayDateInputValue() {
	return format(new Date(), "yyyy-MM-dd");
}

function getCurrentMonthDateRange() {
	const now = new Date();
	return {
		from: format(startOfMonth(now), "yyyy-MM-dd"),
		to: format(endOfMonth(now), "yyyy-MM-dd"),
	};
}

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

function canUpdateInstallments(saleStatus: SaleStatus) {
	return saleStatus === "APPROVED" || saleStatus === "COMPLETED";
}

function canPayInstallment(installment: CommissionInstallmentRow) {
	return (
		installment.status === "PENDING" &&
		canUpdateInstallments(installment.saleStatus as SaleStatus)
	);
}

function resolveDirectionSummary(
	summaryByDirection:
		| GetOrganizationsSlugCommissionsInstallments200["summaryByDirection"]
		| undefined,
	direction: "INCOME" | "OUTCOME",
): InstallmentDirectionSummary {
	return summaryByDirection?.[direction] ?? EMPTY_DIRECTION_SUMMARY;
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

function buildProductOptions(
	nodes: ProductTreeNode[],
	parentPath: string[] = [],
	options: ProductOption[] = [],
) {
	for (const node of nodes) {
		const currentPath = [...parentPath, node.name];
		options.push({
			id: node.id,
			label: currentPath.join(" -> "),
		});

		const children = Array.isArray(node.children) ? node.children : [];
		buildProductOptions(children, currentPath, options);
	}

	return options;
}

export function CommissionsDataTable() {
	const { organization } = useApp();
	const ability = useAbility();
	const slug = organization?.slug ?? "";
	const monthDateRange = useMemo(() => getCurrentMonthDateRange(), []);
	const [directionFilter, setDirectionFilter] = useQueryState(
		"direction",
		commissionDirectionParser,
	);
	const [statusFilter, setStatusFilter] = useQueryState(
		"status",
		commissionInstallmentStatusParser,
	);
	const [searchFilter, setSearchFilter] = useQueryState("q", textFilterParser);
	const [companyIdFilter, setCompanyIdFilter] = useQueryState(
		"companyId",
		entityFilterParser,
	);
	const [unitIdFilter, setUnitIdFilter] = useQueryState(
		"unitId",
		entityFilterParser,
	);
	const [productIdFilter, setProductIdFilter] = useQueryState(
		"productId",
		productFilterParser,
	);
	const [expectedFromFilter, setExpectedFromFilter] = useQueryState(
		"expectedFrom",
		dateFilterParser,
	);
	const [expectedToFilter, setExpectedToFilter] = useQueryState(
		"expectedTo",
		dateFilterParser,
	);
	const [page, setPage] = useQueryState("page", pageParser);
	const [pageSize, setPageSize] = useQueryState("pageSize", pageSizeParser);
	const [selectedInstallmentsById, setSelectedInstallmentsById] = useState(
		() => new Map<string, SelectedInstallment>(),
	);
	const [payAction, setPayAction] = useState<InstallmentPayAction | null>(null);
	const [editingInstallment, setEditingInstallment] =
		useState<InstallmentEditState | null>(null);
	const [installmentToDelete, setInstallmentToDelete] =
		useState<CommissionInstallmentRow | null>(null);
	const [isBulkPaymentDialogOpen, setIsBulkPaymentDialogOpen] =
		useState(false);
	const [bulkPaymentDate, setBulkPaymentDate] =
		useState(getTodayDateInputValue());
	const [isBulkPaying, setIsBulkPaying] = useState(false);
	const [isUndoingPayments, setIsUndoingPayments] = useState(false);
	const [hasRestoredFilters, setHasRestoredFilters] = useState(false);

	const currentPage = page >= 1 ? page : 1;
	const currentPageSize = Math.min(100, Math.max(1, pageSize));
	const effectiveExpectedFrom = expectedFromFilter || monthDateRange.from;
	const effectiveExpectedTo = expectedToFilter || monthDateRange.to;
	const canViewAllCommissions = ability.can(
		"access",
		"sales.commissions.view.all",
	);
	const effectiveDirectionFilter = canViewAllCommissions
		? directionFilter
		: "OUTCOME";
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

	useEffect(() => {
		if (hasRestoredFilters) {
			return;
		}

		setHasRestoredFilters(true);
		const storedFilters = readStorageJson<{
			direction?: GetOrganizationsSlugCommissionsInstallmentsQueryParamsDirectionEnumKey;
			status?: GetOrganizationsSlugCommissionsInstallmentsQueryParamsStatusEnumKey;
			q?: string;
			companyId?: string;
			unitId?: string;
			productId?: string;
			expectedFrom?: string;
			expectedTo?: string;
			page?: number;
			pageSize?: number;
		}>(COMMISSIONS_FILTERS_STORAGE_KEY, {});

		if (
			canViewAllCommissions &&
			directionFilter === "OUTCOME" &&
			storedFilters.direction
		) {
			void setDirectionFilter(storedFilters.direction);
		}

		if (statusFilter === "ALL" && storedFilters.status && storedFilters.status !== "ALL") {
			void setStatusFilter(storedFilters.status);
		}

		if (!searchFilter && storedFilters.q) {
			void setSearchFilter(storedFilters.q);
		}

		if (!companyIdFilter && storedFilters.companyId) {
			void setCompanyIdFilter(storedFilters.companyId);
		}

		if (!unitIdFilter && storedFilters.unitId) {
			void setUnitIdFilter(storedFilters.unitId);
		}

		if (!productIdFilter && storedFilters.productId) {
			void setProductIdFilter(storedFilters.productId);
		}

		if (!expectedFromFilter && storedFilters.expectedFrom) {
			void setExpectedFromFilter(storedFilters.expectedFrom);
		}

		if (!expectedToFilter && storedFilters.expectedTo) {
			void setExpectedToFilter(storedFilters.expectedTo);
		}

		if (page === 1 && storedFilters.page && storedFilters.page > 1) {
			void setPage(storedFilters.page);
		}

		if (pageSize === 20 && storedFilters.pageSize && storedFilters.pageSize !== 20) {
			void setPageSize(storedFilters.pageSize);
		}
	}, [
		directionFilter,
		expectedFromFilter,
		expectedToFilter,
		hasRestoredFilters,
		canViewAllCommissions,
		page,
		pageSize,
		companyIdFilter,
		productIdFilter,
		searchFilter,
		setDirectionFilter,
		setCompanyIdFilter,
		setExpectedFromFilter,
		setExpectedToFilter,
		setPage,
		setPageSize,
		setProductIdFilter,
		setSearchFilter,
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
			COMMISSIONS_FILTERS_STORAGE_KEY,
			JSON.stringify({
				direction: effectiveDirectionFilter,
				status: statusFilter,
				q: searchFilter,
				companyId: companyIdFilter,
				unitId: unitIdFilter,
				productId: productIdFilter,
				expectedFrom: effectiveExpectedFrom,
				expectedTo: effectiveExpectedTo,
				page: currentPage,
				pageSize: currentPageSize,
			}),
		);
	}, [
		currentPage,
		currentPageSize,
		effectiveDirectionFilter,
		effectiveExpectedFrom,
		effectiveExpectedTo,
		companyIdFilter,
		productIdFilter,
		searchFilter,
		statusFilter,
		unitIdFilter,
	]);

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

		return companies.find((company) => company.id === companyIdFilter)?.units ?? [];
	}, [companies, companyIdFilter]);

	const { mutateAsync: patchInstallmentStatus, isPending: isPatchingStatus } =
		usePatchSaleCommissionInstallmentStatus();
	const { mutateAsync: updateInstallment, isPending: isUpdatingInstallment } =
		useUpdateSaleCommissionInstallment();
	const { mutateAsync: deleteInstallment, isPending: isDeletingInstallment } =
		useDeleteSaleCommissionInstallment();
	const isPaymentActionPending = isBulkPaying || isUndoingPayments;

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
		if (expectedFromFilter || expectedToFilter) {
			return;
		}

		setExpectedFromFilter(monthDateRange.from);
		setExpectedToFilter(monthDateRange.to);
		setPage(1);
	}, [
		expectedFromFilter,
		expectedToFilter,
		monthDateRange.from,
		monthDateRange.to,
		setExpectedFromFilter,
		setExpectedToFilter,
		setPage,
	]);

	useEffect(() => {
		if (!data?.pagination.totalPages) {
			return;
		}

		if (currentPage > data.pagination.totalPages) {
			setPage(data.pagination.totalPages);
		}
	}, [currentPage, data?.pagination.totalPages, setPage]);

	const installments = useMemo(() => data?.items ?? [], [data?.items]);
	const summaryByDirection = data?.summaryByDirection;
	const paySummary = resolveDirectionSummary(summaryByDirection, "OUTCOME");
	const receiveSummary = resolveDirectionSummary(summaryByDirection, "INCOME");
	const summaryForCurrentUser = canViewAllCommissions
		? receiveSummary
		: paySummary;
	const pendingSummaryForCurrentUser = summaryForCurrentUser.pending;
	const paidSummaryForCurrentUser = summaryForCurrentUser.paid;
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
			canChangeInstallmentStatus ? installments.filter(canPayInstallment) : [],
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
		() => new Set(eligibleInstallmentsOnPage.map((installment) => installment.id)),
		[eligibleInstallmentsOnPage],
	);
	const visibleInstallmentsById = useMemo(
		() =>
			new Map(
				installments.map((installment) => [installment.id, installment]),
			),
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

	function clearSelectedInstallments() {
		setSelectedInstallmentsById(new Map());
	}

	function handleDirectionChange(
		value: GetOrganizationsSlugCommissionsInstallmentsQueryParamsDirectionEnumKey,
	) {
		clearSelectedInstallments();
		setDirectionFilter(value);
		setPage(1);
	}

	function handleStatusChange(
		value: GetOrganizationsSlugCommissionsInstallmentsQueryParamsStatusEnumKey,
	) {
		clearSelectedInstallments();
		setStatusFilter(value);
		setPage(1);
	}

	function handleSearchChange(value: string) {
		clearSelectedInstallments();
		setSearchFilter(value);
		setPage(1);
	}

	function handleCompanyIdChange(value: string) {
		clearSelectedInstallments();
		setCompanyIdFilter(value);
		setUnitIdFilter("");
		setPage(1);
	}

	function handleUnitIdChange(value: string) {
		clearSelectedInstallments();
		setUnitIdFilter(value);
		setPage(1);
	}

	function handleProductIdChange(value: string) {
		clearSelectedInstallments();
		setProductIdFilter(value);
		setPage(1);
	}

	function handleExpectedFromChange(value: string) {
		clearSelectedInstallments();
		setExpectedFromFilter(value);
		setPage(1);
	}

	function handleExpectedToChange(value: string) {
		clearSelectedInstallments();
		setExpectedToFilter(value);
		setPage(1);
	}

	function handlePageSizeChange(value: string) {
		setPageSize(Number(value));
		setPage(1);
	}

	function clearFilters() {
		clearSelectedInstallments();
		setDirectionFilter("OUTCOME");
		setSearchFilter("");
		setCompanyIdFilter("");
		setUnitIdFilter("");
		setProductIdFilter("");
		setStatusFilter("ALL");
		setExpectedFromFilter(monthDateRange.from);
		setExpectedToFilter(monthDateRange.to);
		setPage(1);
		setPageSize(20);
	}

	function requestInstallmentPayment(installment: CommissionInstallmentRow) {
		if (!canChangeInstallmentStatus) {
			return;
		}

		setPayAction({
			installment,
			paymentDate:
				toDateInputValue(installment.paymentDate) || getTodayDateInputValue(),
			amount: formatCurrencyBRL(installment.amount / 100),
		});
	}

	function requestInstallmentEdition(installment: CommissionInstallmentRow) {
		if (!canEditInstallment) {
			return;
		}

		setEditingInstallment({
			installment,
			percentage: String(installment.percentage),
			amount: formatCurrencyBRL(installment.amount / 100),
			status: installment.status,
			expectedPaymentDate: toDateInputValue(installment.expectedPaymentDate),
			paymentDate: toDateInputValue(installment.paymentDate),
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
				next.set(installment.id, {
					id: installment.id,
					saleId: installment.saleId,
					amount: installment.amount,
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
					next.set(installment.id, {
						id: installment.id,
						saleId: installment.saleId,
						amount: installment.amount,
					});
				} else {
					next.delete(installment.id);
				}
			}

			return next;
		});
	}

	function handleInstallmentCheckedChange(installmentId: string, checked: boolean) {
		const installment = visibleInstallmentsById.get(installmentId);
		if (!installment) {
			return;
		}

		toggleInstallmentSelection(installment, checked);
	}

	function toggleVisibleInstallments(installmentIds: string[], checked: boolean) {
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
					next.set(installment.id, {
						id: installment.id,
						saleId: installment.saleId,
						amount: installment.amount,
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

	async function undoInstallmentsPayment(installments: SelectedInstallment[]) {
		if (installments.length === 0) {
			return;
		}

		setIsUndoingPayments(true);

		const results = await Promise.allSettled(
			installments.map((installment) =>
				updateInstallment({
					saleId: installment.saleId,
					installmentId: installment.id,
					data: {
						status: "PENDING",
						paymentDate: null,
						amount: installment.amount,
					},
					silent: true,
				}),
			),
		);

		let restoredCount = 0;
		let failedCount = 0;
		for (const result of results) {
			if (result.status === "fulfilled") {
				restoredCount += 1;
			} else {
				failedCount += 1;
			}
		}

		if (restoredCount > 0) {
			toast.success(`${restoredCount} parcela(s) retornaram para pendente.`);
		}
		if (failedCount > 0) {
			toast.error(`Não foi possível desfazer ${failedCount} parcela(s).`);
		}

		setIsUndoingPayments(false);
	}

	async function handleConfirmInstallmentPayment() {
		if (!payAction || !canChangeInstallmentStatus) {
			return;
		}

		try {
			await patchInstallmentStatus({
				saleId: payAction.installment.saleId,
				installmentId: payAction.installment.id,
				status: "PAID",
				amount: parseBRLCurrencyToCents(payAction.amount),
				paymentDate: payAction.paymentDate || undefined,
				silent: true,
			});

			setSelectedInstallmentsById((current) => {
				if (!current.has(payAction.installment.id)) {
					return current;
				}

				const next = new Map(current);
				next.delete(payAction.installment.id);
				return next;
			});
			setPayAction(null);
			toast.success("Parcela marcada como paga.", {
				action: {
					label: "Desfazer",
					onClick: () => {
						void undoInstallmentsPayment([
							{
								id: payAction.installment.id,
								saleId: payAction.installment.saleId,
								amount: parseBRLCurrencyToCents(payAction.amount),
							},
						]);
					},
				},
			});
		} catch {
			// erro tratado no hook
		}
	}

	async function handlePayInstallmentToday(installment: CommissionInstallmentRow) {
		if (!canChangeInstallmentStatus) {
			return;
		}

		try {
			await patchInstallmentStatus({
				saleId: installment.saleId,
				installmentId: installment.id,
				status: "PAID",
				paymentDate: getTodayDateInputValue(),
				amount: installment.amount,
				silent: true,
			});

			setSelectedInstallmentsById((current) => {
				if (!current.has(installment.id)) {
					return current;
				}

				const next = new Map(current);
				next.delete(installment.id);
				return next;
			});
			toast.success("Parcela marcada como paga.", {
				action: {
					label: "Desfazer",
					onClick: () => {
						void undoInstallmentsPayment([
							{
								id: installment.id,
								saleId: installment.saleId,
								amount: installment.amount,
							},
						]);
					},
				},
			});
		} catch {
			// erro tratado no hook
		}
	}

	async function processBulkPayment(
		paymentDate: string,
		closeDialogOnSuccess: boolean,
	) {
		if (!canChangeInstallmentStatus) {
			return;
		}

		if (!paymentDate) {
			toast.error("Informe a data de pagamento.");
			return;
		}

		if (selectedInstallments.length === 0) {
			if (closeDialogOnSuccess) {
				setIsBulkPaymentDialogOpen(false);
			}
			return;
		}

		setIsBulkPaying(true);

		const results = await Promise.allSettled(
			selectedInstallments.map((installment) =>
				patchInstallmentStatus({
					saleId: installment.saleId,
					installmentId: installment.id,
					status: "PAID",
					paymentDate,
					amount: installment.amount,
					silent: true,
				}),
			),
		);

		const successfulInstallments: SelectedInstallment[] = [];
		let failedCount = 0;

		for (const [index, result] of results.entries()) {
			if (result.status === "fulfilled") {
				const installment = selectedInstallments[index];
				if (installment) {
					successfulInstallments.push(installment);
				}
			} else {
				failedCount += 1;
			}
		}

		if (successfulInstallments.length > 0) {
			const successfulIds = successfulInstallments.map(
				(installment) => installment.id,
			);
			setSelectedInstallmentsById((current) => {
				const next = new Map(current);
				for (const id of successfulIds) {
					next.delete(id);
				}
				return next;
			});
			toast.success(`${successfulIds.length} parcela(s) marcadas como pagas.`, {
				action: {
					label: "Desfazer",
					onClick: () => {
						void undoInstallmentsPayment(successfulInstallments);
					},
				},
			});
		}

		if (failedCount > 0) {
			toast.error(`Não foi possível pagar ${failedCount} parcela(s).`);
		}

		if (failedCount === 0 && closeDialogOnSuccess) {
			setIsBulkPaymentDialogOpen(false);
		}

		setIsBulkPaying(false);
	}

	async function handleConfirmBulkPayment() {
		await processBulkPayment(bulkPaymentDate, true);
	}

	async function handlePaySelectedToday() {
		await processBulkPayment(getTodayDateInputValue(), false);
	}

	async function handleConfirmInstallmentEdition() {
		if (!editingInstallment || !canEditInstallment) {
			return;
		}

		const parsedPercentage = Number(
			editingInstallment.percentage.replace(",", "."),
		);

		if (Number.isNaN(parsedPercentage)) {
			toast.error("Informe um percentual válido.");
			return;
		}

		if (!editingInstallment.expectedPaymentDate) {
			toast.error("Informe a previsão de pagamento.");
			return;
		}

		try {
			await updateInstallment({
				saleId: editingInstallment.installment.saleId,
				installmentId: editingInstallment.installment.id,
				data: {
					percentage: parsedPercentage,
					amount: parseBRLCurrencyToCents(editingInstallment.amount),
					status: editingInstallment.status,
					expectedPaymentDate: editingInstallment.expectedPaymentDate,
					paymentDate:
						editingInstallment.status === "PAID"
							? editingInstallment.paymentDate || null
							: null,
				},
			});
			setEditingInstallment(null);
		} catch {
			// erro tratado no hook
		}
	}

	async function handleConfirmInstallmentDelete() {
		if (!installmentToDelete || !canDeleteInstallment) {
			return;
		}

		try {
			await deleteInstallment({
				saleId: installmentToDelete.saleId,
				installmentId: installmentToDelete.id,
			});
			setSelectedInstallmentsById((current) => {
				if (!current.has(installmentToDelete.id)) {
					return current;
				}

				const next = new Map(current);
				next.delete(installmentToDelete.id);
				return next;
			});
			setInstallmentToDelete(null);
		} catch {
			// erro tratado no hook
		}
	}

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

				<div className="grid gap-3 md:grid-cols-2">
					{canViewAllCommissions ? (
						<>
							<Card className="p-4">
								<p className="text-sm text-muted-foreground">A pagar</p>
								<p className="text-xl font-semibold">
									{formatCurrencyBRL(paySummary.total.amount / 100)}
								</p>
								<p className="text-xs text-muted-foreground">
									Pendente: {formatCurrencyBRL(paySummary.pending.amount / 100)} ·{" "}
									{paySummary.pending.count}/{paySummary.total.count} parcelas
								</p>
							</Card>

							<Card className="p-4">
								<p className="text-sm text-muted-foreground">A receber</p>
								<p className="text-xl font-semibold">
									{formatCurrencyBRL(receiveSummary.total.amount / 100)}
								</p>
								<p className="text-xs text-muted-foreground">
									Pendente: {formatCurrencyBRL(receiveSummary.pending.amount / 100)} ·{" "}
									{receiveSummary.pending.count}/{receiveSummary.total.count} parcelas
								</p>
							</Card>
						</>
					) : (
						<>
							<Card className="p-4">
								<p className="text-sm text-muted-foreground">A receber</p>
								<p className="text-xl font-semibold">
									{formatCurrencyBRL(pendingSummaryForCurrentUser.amount / 100)}
								</p>
								<p className="text-xs text-muted-foreground">
									{pendingSummaryForCurrentUser.count} parcela(s) pendente(s)
								</p>
							</Card>

							<Card className="p-4">
								<p className="text-sm text-muted-foreground">Recebido</p>
								<p className="text-xl font-semibold">
									{formatCurrencyBRL(paidSummaryForCurrentUser.amount / 100)}
								</p>
								<p className="text-xs text-muted-foreground">
									{paidSummaryForCurrentUser.count} parcela(s) recebida(s)
								</p>
							</Card>
						</>
					)}
				</div>

				<FilterPanel className="xl:grid-cols-10 xl:items-end">
					<div className="space-y-1 xl:col-span-2">
						<p className="text-xs text-muted-foreground">Busca</p>
						<Input
							placeholder="Cliente, produto, empresa, beneficiário..."
							value={searchFilter}
							onChange={(event) => handleSearchChange(event.target.value)}
						/>
					</div>

					<div className="space-y-1">
						<p className="text-xs text-muted-foreground">Empresa</p>
						<Select
							value={companyIdFilter || "ALL"}
							onValueChange={(value) =>
								handleCompanyIdChange(value === "ALL" ? "" : value)
							}
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
							onValueChange={(value) =>
								handleUnitIdChange(value === "ALL" ? "" : value)
							}
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
						<p className="text-xs text-muted-foreground">Produto</p>
						<Select
							value={productIdFilter || "ALL"}
							onValueChange={(value) =>
								handleProductIdChange(value === "ALL" ? "" : value)
							}
						>
							<SelectTrigger className="w-full">
								<SelectValue placeholder="Todos os produtos" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="ALL">Todos os produtos</SelectItem>
								{productOptions.map((product) => (
									<SelectItem key={product.id} value={product.id}>
										{product.label}
									</SelectItem>
								))}
							</SelectContent>
							</Select>
						</div>

					<div className="space-y-1">
						<p className="text-xs text-muted-foreground">Status</p>
						<Select
							value={statusFilter}
							onValueChange={(value) =>
								handleStatusChange(
									value as GetOrganizationsSlugCommissionsInstallmentsQueryParamsStatusEnumKey,
								)
							}
						>
							<SelectTrigger className="w-full">
								<SelectValue placeholder="Status" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="ALL">Todos</SelectItem>
								<SelectItem value="PENDING">Pendente</SelectItem>
								<SelectItem value="PAID">Paga</SelectItem>
								<SelectItem value="CANCELED">Cancelada</SelectItem>
							</SelectContent>
							</Select>
						</div>

					<div className="space-y-1">
						<p className="text-xs text-muted-foreground">Previsão de</p>
						<CalendarDateInput
							value={effectiveExpectedFrom}
							onChange={handleExpectedFromChange}
						/>
					</div>

					<div className="space-y-1">
						<p className="text-xs text-muted-foreground">Previsão até</p>
						<CalendarDateInput
							value={effectiveExpectedTo}
							onChange={handleExpectedToChange}
						/>
					</div>

					<div className="space-y-1">
						<p className="text-xs text-muted-foreground">Por página</p>
						<Select
							value={String(currentPageSize)}
							onValueChange={handlePageSizeChange}
						>
							<SelectTrigger className="w-full">
								<SelectValue placeholder="Tamanho" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="20">20</SelectItem>
								<SelectItem value="50">50</SelectItem>
								<SelectItem value="100">100</SelectItem>
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

					{canChangeInstallmentStatus && selectedInstallments.length > 0 ? (
						<div className="flex flex-col gap-3 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-4 md:flex-row md:items-center md:justify-between">
							<p className="text-sm text-emerald-700 dark:text-emerald-300">
								{selectedInstallments.length} parcela(s) selecionada(s) · total{" "}
								{formatCurrencyBRL(selectedInstallmentsTotalAmount / 100)}
							</p>
							<div className="flex flex-col gap-2 md:flex-row">
								<Button
									type="button"
									variant="outline"
									disabled={isPaymentActionPending}
									onClick={() => void handlePaySelectedToday()}
								>
									<CheckCheck className="size-4" />
									{isPaymentActionPending ? "Processando..." : "Pagar hoje"}
								</Button>
								<Button
									type="button"
									disabled={isPaymentActionPending}
									onClick={() => {
										setBulkPaymentDate(getTodayDateInputValue());
										setIsBulkPaymentDialogOpen(true);
									}}
								>
									Pagar selecionadas
								</Button>
							</div>
						</div>
					) : null}

				{isLoading ? (
					<p className="text-sm text-muted-foreground">Carregando comissões...</p>
				) : isError ? (
					<div className="space-y-3">
						<p className="text-sm text-destructive">
							Não foi possível carregar as comissões.
						</p>
						<Button type="button" variant="outline" onClick={() => refetch()}>
							Tentar novamente
						</Button>
					</div>
				) : (
					<>
						<ResponsiveDataView
							mobile={
								<div className="space-y-3">
									{canChangeInstallmentStatus ? (
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
														disabled={eligibleInstallmentsOnPage.length === 0}
														aria-label="Selecionar página atual"
													/>
													<span>Selecionar parcelas da página</span>
												</label>
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
												installment.saleStatus as SaleStatus,
											);
											const canPayRow = canPayInstallment(installment);
											const canChangeStatusRow =
												canPayRow && canChangeInstallmentStatus;
											const canEditRowAction =
												canEditRow && canEditInstallment;
											const canDeleteRowAction =
												canEditRow && canDeleteInstallment;
											const canOpenRowActions =
												canChangeStatusRow ||
												canEditRowAction ||
												canDeleteRowAction;
											const isSelected = selectedInstallmentsById.has(
												installment.id,
											);
											const productLabel =
												productPathById.get(installment.product.id) ??
												installment.product.name;

											return (
												<Card key={installment.id} className="space-y-3 p-4">
													<div className="flex items-start justify-between gap-3">
														<div className="min-w-0">
															<p className="truncate text-sm font-medium">
																{installment.customer.name}
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
															disabled={!canChangeStatusRow}
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
															{formatCurrencyBRL(installment.amount / 100)}
														</p>
													</div>

													<div className="grid grid-cols-2 gap-2 text-xs">
														<div className="space-y-0.5">
															<p className="text-muted-foreground">Previsão</p>
															<p>{formatDate(installment.expectedPaymentDate)}</p>
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
															<p className="text-muted-foreground">Beneficiário</p>
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
														</div>
													</div>

													<div className="grid grid-cols-2 gap-2">
														<Button variant="outline" size="sm" asChild>
															<Link to="/sales/$saleId" params={{ saleId: installment.saleId }}>
																<Eye className="size-4" />
																Ver venda
															</Link>
														</Button>
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
																	isPatchingStatus ||
																	isUpdatingInstallment ||
																	isDeletingInstallment ||
																	isPaymentActionPending ||
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
																	variant="destructive"
																	disabled={!canDeleteRowAction}
																	onSelect={(event) => {
																		event.preventDefault();
																		if (!canDeleteRowAction) {
																			return;
																		}
																		setInstallmentToDelete(installment);
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
												<TableHead>Pagamento</TableHead>
												<TableHead>Status</TableHead>
												<TableHead>Beneficiário</TableHead>
												<TableHead>Venda</TableHead>
												<TableHead>Valor</TableHead>
												<TableHead>%</TableHead>
												<TableHead>Origem</TableHead>
												{canPerformInstallmentActions ? (
													<TableHead className="w-[92px] text-right">Ações</TableHead>
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
														installment.saleStatus as SaleStatus,
													);
													const canPayRow = canPayInstallment(installment);
													const canChangeStatusRow =
														canPayRow && canChangeInstallmentStatus;
													const canEditRowAction =
														canEditRow && canEditInstallment;
													const canDeleteRowAction =
														canEditRow && canDeleteInstallment;
													const canOpenRowActions =
														canChangeStatusRow ||
														canEditRowAction ||
														canDeleteRowAction;
													const isSelected = selectedInstallmentsById.has(
														installment.id,
													);
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
																	disabled={!canChangeStatusRow}
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
																	{SALE_COMMISSION_DIRECTION_LABEL[installment.direction]}
																</p>
															</TableCell>
															<TableCell>
																<p className="font-medium">{installment.customer.name}</p>
																<p className="text-xs text-muted-foreground">
																	{productLabel}
																</p>
																<p className="text-xs text-muted-foreground">
																	{installment.company.name}
																	{installment.unit ? ` -> ${installment.unit.name}` : ""}
																</p>
															</TableCell>
															<TableCell>
																{formatCurrencyBRL(installment.amount / 100)}
															</TableCell>
															<TableCell>{installment.percentage}%</TableCell>
															<TableCell>
																{
																	SALE_COMMISSION_SOURCE_TYPE_LABEL[
																		installment.sourceType
																	]
																}
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
																						isPatchingStatus ||
																						isUpdatingInstallment ||
																						isDeletingInstallment ||
																						isPaymentActionPending ||
																						!canOpenRowActions
																					}
																				>
																					<MoreHorizontal className="size-4" />
																				</Button>
																			</DropdownMenuTrigger>
																			<DropdownMenuContent align="end">
																				<DropdownMenuItem asChild>
																					<Link to="/sales/$saleId" params={{ saleId: installment.saleId }}>
																						<Eye className="size-4" />
																						Ver venda
																					</Link>
																				</DropdownMenuItem>
																				<DropdownMenuSeparator />
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
																					disabled={!canChangeStatusRow}
																					onSelect={(event) => {
																						event.preventDefault();
																						if (!canChangeStatusRow) {
																							return;
																						}
																						void handlePayInstallmentToday(installment);
																					}}
																				>
																					<CheckCheck className="size-4" />
																					Pagar hoje
																				</DropdownMenuItem>
																				<DropdownMenuItem
																					variant="destructive"
																					disabled={!canDeleteRowAction}
																					onSelect={(event) => {
																						event.preventDefault();
																						if (!canDeleteRowAction) {
																							return;
																						}
																						setInstallmentToDelete(installment);
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
								Página {pagination?.page ?? currentPage} de {pagination?.totalPages ?? 1} ·{" "}
								{pagination?.total ?? 0} parcelas
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
					</>
				)}
			</div>

			<Dialog
				open={isBulkPaymentDialogOpen}
				onOpenChange={(open) => {
					setIsBulkPaymentDialogOpen(open);
					if (open) {
						setBulkPaymentDate(getTodayDateInputValue());
					}
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Pagar parcelas selecionadas</DialogTitle>
						<DialogDescription>
							Pagamento em lote para {selectedInstallments.length} parcela(s).
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-3">
						<p className="text-sm text-muted-foreground">
							Total selecionado: {formatCurrencyBRL(selectedInstallmentsTotalAmount / 100)}
						</p>
						<div className="space-y-1">
							<p className="text-sm font-medium">Data de pagamento</p>
							<CalendarDateInput
								value={bulkPaymentDate}
								onChange={setBulkPaymentDate}
							/>
						</div>
					</div>

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => setIsBulkPaymentDialogOpen(false)}
							disabled={isPaymentActionPending}
						>
							Cancelar
						</Button>
						<Button
							type="button"
							onClick={handleConfirmBulkPayment}
							disabled={
								isPaymentActionPending ||
								selectedInstallments.length === 0 ||
								!canChangeInstallmentStatus
							}
						>
							{isPaymentActionPending ? "Pagando..." : "Confirmar pagamento"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<AlertDialog
				open={Boolean(payAction)}
				onOpenChange={(open) => {
					if (!open) {
						setPayAction(null);
					}
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Marcar parcela como paga</AlertDialogTitle>
						<AlertDialogDescription>
							Confirmar pagamento da parcela{" "}
							{payAction ? `P${payAction.installment.installmentNumber}` : ""}?
						</AlertDialogDescription>
					</AlertDialogHeader>

					<div className="space-y-3">
						<div className="space-y-1">
							<p className="text-sm font-medium">Valor da parcela</p>
							<Input
								placeholder="R$ 0,00"
								value={payAction?.amount ?? ""}
								onChange={(event) => {
									setPayAction((current) =>
										current
											? {
													...current,
													amount: formatCurrencyBRL(event.target.value),
												}
											: current,
									);
								}}
							/>
						</div>
						<div className="space-y-1">
							<p className="text-sm font-medium">Data de pagamento</p>
							<CalendarDateInput
								value={payAction?.paymentDate ?? ""}
								onChange={(value) => {
									setPayAction((current) =>
										current
											? {
													...current,
													paymentDate: value,
												}
											: current,
									);
								}}
							/>
						</div>
					</div>

					<AlertDialogFooter>
						<AlertDialogCancel
							disabled={isPatchingStatus || isPaymentActionPending}
						>
							Cancelar
						</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleConfirmInstallmentPayment}
							disabled={
								isPatchingStatus ||
								isPaymentActionPending ||
								!canChangeInstallmentStatus
							}
						>
							{isPatchingStatus ? "Salvando..." : "Confirmar"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			<Dialog
				open={Boolean(editingInstallment)}
				onOpenChange={(open) => {
					if (!open) {
						setEditingInstallment(null);
					}
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Editar parcela</DialogTitle>
						<DialogDescription>
							Ajuste percentual, valor, status e datas da parcela.
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4">
						<div className="grid gap-4 md:grid-cols-2">
							<div className="space-y-1">
								<p className="text-sm font-medium">Percentual (%)</p>
								<Input
									type="number"
									step="0.0001"
									min={0}
									max={100}
									value={editingInstallment?.percentage ?? ""}
									onChange={(event) => {
										setEditingInstallment((current) =>
											current
												? {
														...current,
														percentage: event.target.value,
													}
												: current,
										);
									}}
								/>
							</div>
							<div className="space-y-1">
								<p className="text-sm font-medium">Valor</p>
								<Input
									placeholder="R$ 0,00"
									value={editingInstallment?.amount ?? ""}
									onChange={(event) => {
										setEditingInstallment((current) =>
											current
												? {
														...current,
														amount: formatCurrencyBRL(event.target.value),
													}
												: current,
										);
									}}
								/>
							</div>
						</div>

						<div className="grid gap-4 md:grid-cols-2">
							<div className="space-y-1">
								<p className="text-sm font-medium">Status</p>
								<Select
									value={editingInstallment?.status}
									onValueChange={(value) => {
										setEditingInstallment((current) =>
											current
												? {
														...current,
														status: value as SaleCommissionInstallmentStatus,
													}
												: current,
										);
									}}
								>
									<SelectTrigger>
										<SelectValue placeholder="Selecione" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="PENDING">Pendente</SelectItem>
										<SelectItem value="PAID">Paga</SelectItem>
										<SelectItem value="CANCELED">Cancelada</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div className="space-y-1">
								<p className="text-sm font-medium">Previsão de pagamento</p>
								<CalendarDateInput
									value={editingInstallment?.expectedPaymentDate ?? ""}
									onChange={(value) => {
										setEditingInstallment((current) =>
											current
												? {
														...current,
														expectedPaymentDate: value,
													}
												: current,
										);
									}}
								/>
							</div>
						</div>

						{editingInstallment?.status === "PAID" ? (
							<div className="space-y-1">
								<p className="text-sm font-medium">Data de pagamento</p>
								<CalendarDateInput
									value={editingInstallment.paymentDate}
									onChange={(value) => {
										setEditingInstallment((current) =>
											current
												? {
														...current,
														paymentDate: value,
													}
												: current,
										);
									}}
								/>
							</div>
						) : null}
					</div>

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => setEditingInstallment(null)}
							disabled={isUpdatingInstallment}
						>
							Cancelar
						</Button>
						<Button
							type="button"
							onClick={handleConfirmInstallmentEdition}
							disabled={isUpdatingInstallment || !canEditInstallment}
						>
							{isUpdatingInstallment ? "Salvando..." : "Salvar alterações"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<AlertDialog
				open={Boolean(installmentToDelete)}
				onOpenChange={(open) => {
					if (!open) {
						setInstallmentToDelete(null);
					}
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Excluir parcela</AlertDialogTitle>
						<AlertDialogDescription>
							Tem certeza que deseja excluir a parcela{" "}
							{installmentToDelete
								? `P${installmentToDelete.installmentNumber}`
								: ""}
							? Essa ação não pode ser desfeita.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={isDeletingInstallment}>
							Cancelar
						</AlertDialogCancel>
						<AlertDialogAction
							variant="destructive"
							onClick={handleConfirmInstallmentDelete}
							disabled={isDeletingInstallment || !canDeleteInstallment}
						>
							{isDeletingInstallment ? "Excluindo..." : "Excluir parcela"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
