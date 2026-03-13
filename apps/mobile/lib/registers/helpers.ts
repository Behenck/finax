import type { Category, ProductNode } from "@/types/registers";

export function parseDateInput(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim();
  if (!normalized) {
    return undefined;
  }

  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return date.toISOString();
}

export type FlattenedProductNode = ProductNode & {
  depth: number;
};

export function flattenProducts(
  nodes: ProductNode[],
  depth = 0,
): FlattenedProductNode[] {
  const flattened: FlattenedProductNode[] = [];

  for (const node of nodes) {
    flattened.push({ ...node, depth });
    flattened.push(...flattenProducts(node.children ?? [], depth + 1));
  }

  return flattened;
}

export function flattenCategories(categories: Category[]) {
  return categories.flatMap((category) => [category, ...(category.children ?? [])]);
}

export function normalizeSearchValue(value: string): string {
  return value.trim().toLowerCase();
}
