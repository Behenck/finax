import { useQueryState } from "nuqs";
import { useEffect, useMemo, useState } from "react";
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
import type {
	GetOrganizationsSlugCommissionsInstallmentsQueryParamsDirectionEnumKey,
	GetOrganizationsSlugCommissionsInstallmentsQueryParamsStatusEnumKey,
} from "@/http/generated";
import {
	COMMISSIONS_FILTERS_STORAGE_KEY,
	getCurrentMonthDateRange,
	readStorageJson,
} from "../utils";

interface StoredCommissionsFilters {
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
}

interface UseCommissionsInstallmentsFiltersParams {
	canViewAllCommissions: boolean;
	onBeforeFilterChange?: () => void;
}

export function useCommissionsInstallmentsFilters({
	canViewAllCommissions,
	onBeforeFilterChange,
}: UseCommissionsInstallmentsFiltersParams) {
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
	const [hasRestoredFilters, setHasRestoredFilters] = useState(false);

	const currentPage = page >= 1 ? page : 1;
	const currentPageSize = Math.min(100, Math.max(1, pageSize));
	const effectiveExpectedFrom = expectedFromFilter || monthDateRange.from;
	const effectiveExpectedTo = expectedToFilter || monthDateRange.to;
	const effectiveDirectionFilter = canViewAllCommissions
		? directionFilter
		: "OUTCOME";

	useEffect(() => {
		if (hasRestoredFilters) {
			return;
		}

		setHasRestoredFilters(true);
		const storedFilters = readStorageJson<StoredCommissionsFilters>(
			COMMISSIONS_FILTERS_STORAGE_KEY,
			{},
		);

		if (
			canViewAllCommissions &&
			directionFilter === "OUTCOME" &&
			storedFilters.direction
		) {
			void setDirectionFilter(storedFilters.direction);
		}

		if (
			statusFilter === "ALL" &&
			storedFilters.status &&
			storedFilters.status !== "ALL"
		) {
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

		if (
			pageSize === 20 &&
			storedFilters.pageSize &&
			storedFilters.pageSize !== 20
		) {
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

	function handleDirectionChange(
		value: GetOrganizationsSlugCommissionsInstallmentsQueryParamsDirectionEnumKey,
	) {
		onBeforeFilterChange?.();
		setDirectionFilter(value);
		setPage(1);
	}

	function handleStatusChange(
		value: GetOrganizationsSlugCommissionsInstallmentsQueryParamsStatusEnumKey,
	) {
		onBeforeFilterChange?.();
		setStatusFilter(value);
		setPage(1);
	}

	function handleSearchChange(value: string) {
		onBeforeFilterChange?.();
		setSearchFilter(value);
		setPage(1);
	}

	function handleCompanyIdChange(value: string) {
		onBeforeFilterChange?.();
		setCompanyIdFilter(value);
		setUnitIdFilter("");
		setPage(1);
	}

	function handleUnitIdChange(value: string) {
		onBeforeFilterChange?.();
		setUnitIdFilter(value);
		setPage(1);
	}

	function handleProductIdChange(value: string) {
		onBeforeFilterChange?.();
		setProductIdFilter(value);
		setPage(1);
	}

	function handleExpectedFromChange(value: string) {
		onBeforeFilterChange?.();
		setExpectedFromFilter(value);
		setPage(1);
	}

	function handleExpectedToChange(value: string) {
		onBeforeFilterChange?.();
		setExpectedToFilter(value);
		setPage(1);
	}

	function handlePageSizeChange(value: string) {
		setPageSize(Number(value));
		setPage(1);
	}

	function clearFilters() {
		onBeforeFilterChange?.();
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

	return {
		monthDateRange,
		directionFilter,
		statusFilter,
		searchFilter,
		companyIdFilter,
		unitIdFilter,
		productIdFilter,
		expectedFromFilter,
		expectedToFilter,
		currentPage,
		currentPageSize,
		effectiveExpectedFrom,
		effectiveExpectedTo,
		effectiveDirectionFilter,
		setPage,
		setPageSize,
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
	};
}
