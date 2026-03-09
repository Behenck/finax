import { format, parse, startOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatCurrencyBRL } from "@/utils/format-amount";

const monthPattern = /^\d{4}-\d{2}$/;

export function getCurrentMonthValue() {
	return format(new Date(), "yyyy-MM");
}

export function isMonthValue(value?: string | null): value is string {
	if (!value || !monthPattern.test(value)) {
		return false;
	}

	const parsed = parse(`${value}-01`, "yyyy-MM-dd", new Date());
	return format(parsed, "yyyy-MM") === value;
}

export function normalizeMonthValue(value?: string | null) {
	return isMonthValue(value) ? value : getCurrentMonthValue();
}

export function monthValueToDate(value: string) {
	return startOfMonth(parse(`${value}-01`, "yyyy-MM-dd", new Date()));
}

export function formatMonthLabel(value: string) {
	return format(monthValueToDate(value), "MMMM 'de' yyyy", {
		locale: ptBR,
	});
}

export function formatMonthShortLabel(value: string) {
	return format(monthValueToDate(value), "MMM/yyyy", {
		locale: ptBR,
	});
}

export function getPreviousMonthValue(value: string) {
	return format(subMonths(monthValueToDate(value), 1), "yyyy-MM");
}

export function formatDayLabel(value: string) {
	return format(parse(value.slice(0, 10), "yyyy-MM-dd", new Date()), "dd");
}

export function formatCents(value: number) {
	return formatCurrencyBRL(value / 100);
}

export function formatSignedCents(value: number) {
	const absoluteValue = formatCents(Math.abs(value));
	return value >= 0 ? `+${absoluteValue}` : `-${absoluteValue}`;
}

export function buildDelta(current: number, previous: number) {
	const difference = current - previous;
	const percentage =
		previous === 0 ? (current === 0 ? 0 : null) : (difference / previous) * 100;

	return {
		difference,
		percentage,
	};
}

export function formatDeltaPercentage(value: number | null) {
	if (value === null) {
		return "novo no período";
	}

	const prefix = value > 0 ? "+" : "";
	return `${prefix}${value.toFixed(1)}%`;
}

export type ProductTreeNode = {
	id: string;
	name: string;
	children?: ProductTreeNode[];
};

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
