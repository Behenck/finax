import { useEffect, useMemo, useRef } from "react";
import { useQueryState } from "nuqs";
import { pageParser, pageSizeParser } from "./parsers";

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

type UseTablePaginationParams<TItem> = {
	items: TItem[];
	pageSizeOptions?: readonly number[];
	resetKeys?: readonly unknown[];
};

type UseTablePaginationResult<TItem> = {
	currentPage: number;
	currentPageSize: number;
	totalItems: number;
	totalPages: number;
	paginatedItems: TItem[];
	pageSizeOptions: readonly number[];
	handlePageChange: (page: number) => Promise<void>;
	handlePageSizeChange: (pageSize: number) => Promise<void>;
};

function buildResetKey(resetKeys: readonly unknown[]) {
	return JSON.stringify(resetKeys);
}

function normalizePageSize(
	pageSize: number,
	pageSizeOptions: readonly number[],
) {
	if (pageSizeOptions.includes(pageSize)) {
		return pageSize;
	}

	return pageSizeOptions[0] ?? 20;
}

export function useTablePagination<TItem>({
	items,
	pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
	resetKeys = [],
}: UseTablePaginationParams<TItem>): UseTablePaginationResult<TItem> {
	const [page, setPage] = useQueryState("page", pageParser);
	const [pageSize, setPageSize] = useQueryState("pageSize", pageSizeParser);
	const didMountRef = useRef(false);
	const previousResetKeyRef = useRef(buildResetKey(resetKeys));
	const previousPageSizeRef = useRef(pageSize);

	const normalizedPageSize = useMemo(
		() => normalizePageSize(pageSize, pageSizeOptions),
		[pageSize, pageSizeOptions],
	);
	const totalItems = items.length;
	const totalPages = Math.max(1, Math.ceil(totalItems / normalizedPageSize));
	const currentPage =
		totalItems === 0 ? 1 : Math.min(Math.max(page, 1), totalPages);

	const paginatedItems = useMemo(() => {
		const startIndex = (currentPage - 1) * normalizedPageSize;
		return items.slice(startIndex, startIndex + normalizedPageSize);
	}, [currentPage, items, normalizedPageSize]);

	useEffect(() => {
		if (pageSize !== normalizedPageSize) {
			void setPageSize(normalizedPageSize);
		}
	}, [normalizedPageSize, pageSize, setPageSize]);

	useEffect(() => {
		if (page !== currentPage) {
			void setPage(currentPage);
		}
	}, [currentPage, page, setPage]);

	useEffect(() => {
		if (!didMountRef.current) {
			didMountRef.current = true;
			previousPageSizeRef.current = normalizedPageSize;
			previousResetKeyRef.current = buildResetKey(resetKeys);
			return;
		}

		if (previousPageSizeRef.current !== normalizedPageSize) {
			previousPageSizeRef.current = normalizedPageSize;
			if (currentPage !== 1) {
				void setPage(1);
			}
		}
	}, [currentPage, normalizedPageSize, resetKeys, setPage]);

	useEffect(() => {
		if (!didMountRef.current) {
			return;
		}

		const nextResetKey = buildResetKey(resetKeys);
		if (previousResetKeyRef.current === nextResetKey) {
			return;
		}

		previousResetKeyRef.current = nextResetKey;
		if (currentPage !== 1) {
			void setPage(1);
		}
	}, [currentPage, resetKeys, setPage]);

	async function handlePageChange(nextPage: number) {
		const boundedPage = Math.min(Math.max(nextPage, 1), totalPages);
		await setPage(boundedPage);
	}

	async function handlePageSizeChange(nextPageSize: number) {
		const normalizedNextPageSize = normalizePageSize(
			nextPageSize,
			pageSizeOptions,
		);

		await setPageSize(normalizedNextPageSize);
		await setPage(1);
	}

	return {
		currentPage,
		currentPageSize: normalizedPageSize,
		totalItems,
		totalPages,
		paginatedItems,
		pageSizeOptions,
		handlePageChange,
		handlePageSizeChange,
	};
}
