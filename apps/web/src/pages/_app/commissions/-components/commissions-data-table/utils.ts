import { endOfMonth, format, parse, startOfMonth } from "date-fns";
import type { GetOrganizationsSlugCommissionsInstallments200 } from "@/http/generated";
import type {
	SaleCommissionInstallmentStatus,
	SaleStatus,
} from "@/schemas/types/sales";
import type {
	CommissionInstallmentRow,
	InstallmentDirectionSummary,
	ProductOption,
	ProductTreeNode,
} from "./types";

export const COMMISSIONS_FILTERS_STORAGE_KEY = "finax:commissions:list:filters";

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
	reversed: {
		count: 0,
		amount: 0,
	},
};

export const INSTALLMENT_STATUS_BADGE_CLASSNAME: Record<
	SaleCommissionInstallmentStatus,
	string
> = {
	PENDING:
		"bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 border-yellow-500/30",
	PAID: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
	CANCELED: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
	REVERSED: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
};

export function formatDate(value: string) {
	const dateOnly = value.slice(0, 10);
	const parsedDate = parse(dateOnly, "yyyy-MM-dd", new Date());
	return format(parsedDate, "dd/MM/yyyy");
}

export function toDateInputValue(value?: string | null) {
	return value ? value.slice(0, 10) : "";
}

export function getTodayDateInputValue() {
	return format(new Date(), "yyyy-MM-dd");
}

export function getCurrentMonthDateRange() {
	const now = new Date();
	return {
		from: format(startOfMonth(now), "yyyy-MM-dd"),
		to: format(endOfMonth(now), "yyyy-MM-dd"),
	};
}

export function readStorageJson<T>(key: string, fallback: T): T {
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

export function canUpdateInstallments(saleStatus: SaleStatus) {
	return saleStatus === "APPROVED" || saleStatus === "COMPLETED";
}

export function canPayInstallment(installment: CommissionInstallmentRow) {
	return (
		installment.status === "PENDING" &&
		canUpdateInstallments(installment.saleStatus as SaleStatus)
	);
}

export function resolveDirectionSummary(
	summaryByDirection:
		| GetOrganizationsSlugCommissionsInstallments200["summaryByDirection"]
		| undefined,
	direction: "INCOME" | "OUTCOME",
): InstallmentDirectionSummary {
	return summaryByDirection?.[direction] ?? EMPTY_DIRECTION_SUMMARY;
}

export function buildProductPathMap(
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

export function buildProductOptions(
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
