import { useMemo } from "react";
import { useSales } from "./use-sales";

export const SALE_NAVIGATION_CONTEXT_STORAGE_KEY =
	"finax:sales:navigation-context";

const MAX_NAVIGATION_CONTEXT_AGE_MS = 1000 * 60 * 60 * 24;

type SaleNavigationContext = {
	orderedSaleIds: string[];
	generatedAt: number;
};

function isSaleNavigationContext(
	value: unknown,
): value is SaleNavigationContext {
	if (!value || typeof value !== "object") {
		return false;
	}

	const candidate = value as Partial<SaleNavigationContext>;
	if (
		!Array.isArray(candidate.orderedSaleIds) ||
		typeof candidate.generatedAt !== "number"
	) {
		return false;
	}

	if (!Number.isFinite(candidate.generatedAt) || candidate.generatedAt <= 0) {
		return false;
	}

	return candidate.orderedSaleIds.every(
		(id) => typeof id === "string" && id.length > 0,
	);
}

function normalizeSaleIds(saleIds: string[]) {
	return Array.from(new Set(saleIds.filter((id) => id.length > 0)));
}

function readSaleNavigationContext(): SaleNavigationContext | null {
	if (typeof window === "undefined") {
		return null;
	}

	try {
		const rawValue = window.sessionStorage.getItem(
			SALE_NAVIGATION_CONTEXT_STORAGE_KEY,
		);
		if (!rawValue) {
			return null;
		}

		const parsed = JSON.parse(rawValue) as unknown;
		if (!isSaleNavigationContext(parsed)) {
			return null;
		}

		const age = Date.now() - parsed.generatedAt;
		if (age < -60_000 || age > MAX_NAVIGATION_CONTEXT_AGE_MS) {
			return null;
		}

		const orderedSaleIds = normalizeSaleIds(parsed.orderedSaleIds);
		if (orderedSaleIds.length === 0) {
			return null;
		}

		return {
			orderedSaleIds,
			generatedAt: parsed.generatedAt,
		};
	} catch {
		return null;
	}
}

export function persistSaleNavigationContext(orderedSaleIds: string[]) {
	if (typeof window === "undefined") {
		return;
	}

	const normalizedSaleIds = normalizeSaleIds(orderedSaleIds);
	if (normalizedSaleIds.length === 0) {
		return;
	}

	const payload: SaleNavigationContext = {
		orderedSaleIds: normalizedSaleIds,
		generatedAt: Date.now(),
	};

	window.sessionStorage.setItem(
		SALE_NAVIGATION_CONTEXT_STORAGE_KEY,
		JSON.stringify(payload),
	);
}

type ResolveOrderedSaleIdsForNavigationParams = {
	currentSaleId: string;
	contextOrderedSaleIds: string[];
	fallbackOrderedSaleIds: string[];
};

export function resolveOrderedSaleIdsForNavigation({
	currentSaleId,
	contextOrderedSaleIds,
	fallbackOrderedSaleIds,
}: ResolveOrderedSaleIdsForNavigationParams) {
	if (contextOrderedSaleIds.includes(currentSaleId)) {
		return contextOrderedSaleIds;
	}

	return fallbackOrderedSaleIds;
}

export function resolveAdjacentSaleIds(
	currentSaleId: string,
	orderedSaleIds: string[],
) {
	const currentIndex = orderedSaleIds.indexOf(currentSaleId);
	if (currentIndex < 0) {
		return {
			previousSaleId: undefined,
			nextSaleId: undefined,
		};
	}

	return {
		previousSaleId:
			currentIndex > 0 ? orderedSaleIds[currentIndex - 1] : undefined,
		nextSaleId:
			currentIndex < orderedSaleIds.length - 1
				? orderedSaleIds[currentIndex + 1]
				: undefined,
	};
}

export function useSaleNavigation(currentSaleId: string) {
	const salesQuery = useSales();
	const fallbackOrderedSaleIds = useMemo(
		() => (salesQuery.data?.sales ?? []).map((sale) => sale.id),
		[salesQuery.data?.sales],
	);
	const contextOrderedSaleIds = useMemo(() => {
		const context = readSaleNavigationContext();
		return context?.orderedSaleIds ?? [];
	}, [currentSaleId]);

	const orderedSaleIds = useMemo(
		() =>
			resolveOrderedSaleIdsForNavigation({
				currentSaleId,
				contextOrderedSaleIds,
				fallbackOrderedSaleIds,
			}),
		[currentSaleId, contextOrderedSaleIds, fallbackOrderedSaleIds],
	);
	const { previousSaleId, nextSaleId } = useMemo(
		() => resolveAdjacentSaleIds(currentSaleId, orderedSaleIds),
		[currentSaleId, orderedSaleIds],
	);

	return {
		previousSaleId,
		nextSaleId,
		isLoading:
			orderedSaleIds.length === 0 &&
			(salesQuery.isLoading || salesQuery.isFetching),
	};
}
