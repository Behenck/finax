import type { ProductNode } from "@/types/registers";

function pad2(value: number): string {
  return value.toString().padStart(2, "0");
}

export function formatCurrencyBRLFromCents(valueInCents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valueInCents / 100);
}

export function formatCurrencyInput(rawValue: string): string {
  const digits = rawValue.replace(/\D/g, "");
  if (!digits) {
    return "";
  }

  return formatCurrencyBRLFromCents(Number(digits));
}

export function parseCurrencyToCents(rawValue: string): number {
  const digits = rawValue.replace(/\D/g, "");
  if (!digits) {
    return 0;
  }

  return Number(digits);
}

export function toDateInputValue(value?: string | null): string {
  if (!value) {
    return "";
  }

  return value.slice(0, 10);
}

export function toMonthInputValue(date = new Date()): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
}

export function shiftMonth(month: string, delta: number): string {
  const [yearText, monthText] = month.split("-");
  const year = Number(yearText);
  const monthNumber = Number(monthText);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(monthNumber) ||
    monthNumber < 1 ||
    monthNumber > 12
  ) {
    return toMonthInputValue();
  }

  const date = new Date(year, monthNumber - 1 + delta, 1);
  return toMonthInputValue(date);
}

export function toIsoDate(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return undefined;
  }

  return normalized;
}

export function toIsoMonth(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim();
  if (!/^\d{4}-\d{2}$/.test(normalized)) {
    return undefined;
  }

  return normalized;
}

export function formatDateBR(value?: string | null): string {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("pt-BR").format(date);
}

export function formatDateTimeBR(value?: string | null): string {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

type ProductOption = {
  id: string;
  name: string;
  path: string[];
  label: string;
};

export function flattenActiveProductOptions(
  nodes: ProductNode[],
  parentPath: string[] = [],
): ProductOption[] {
  return nodes.flatMap((node) => {
    const currentPath = [...parentPath, node.name];
    const children = node.children ?? [];

    const currentOption = node.isActive
      ? [
          {
            id: node.id,
            name: node.name,
            path: currentPath,
            label: currentPath.join(" -> "),
          },
        ]
      : [];

    return [...currentOption, ...flattenActiveProductOptions(children, currentPath)];
  });
}

export function buildProductPathMap(
  nodes: ProductNode[],
  parentPath: string[] = [],
  map = new Map<string, string>(),
): Map<string, string> {
  for (const node of nodes) {
    const currentPath = [...parentPath, node.name];
    map.set(node.id, currentPath.join(" -> "));
    buildProductPathMap(node.children ?? [], currentPath, map);
  }

  return map;
}

export function normalizeSearchValue(value: string): string {
  return value.trim().toLowerCase();
}
