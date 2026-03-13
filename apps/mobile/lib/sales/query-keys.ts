export type SalesDashboardFilters = {
  month: string;
};

export type CommissionsFilters = {
  page: number;
  pageSize: number;
  q: string;
  productId?: string;
  direction?: "INCOME" | "OUTCOME";
  status: "ALL" | "PENDING" | "PAID" | "CANCELED";
  expectedFrom?: string;
  expectedTo?: string;
};

export const salesQueryKeys = {
  root: ["sales"] as const,
  list: (slug: string) => ["sales", "list", slug] as const,
  detail: (slug: string, saleId: string) => ["sales", "detail", slug, saleId] as const,
  history: (slug: string, saleId: string) => ["sales", "history", slug, saleId] as const,
  installments: (slug: string, saleId: string) =>
    ["sales", "installments", slug, saleId] as const,
  dashboard: (slug: string, filters: SalesDashboardFilters) =>
    ["sales", "dashboard", slug, filters] as const,
  formOptions: (slug: string) => ["sales", "form-options", slug] as const,
  productCommissionScenarios: (slug: string, productId: string) =>
    ["sales", "product-commission-scenarios", slug, productId] as const,
  productSaleFields: (slug: string, productId: string) =>
    ["sales", "product-sale-fields", slug, productId] as const,
} as const;

export const commissionsQueryKeys = {
  root: ["commissions"] as const,
  list: (slug: string, filters: CommissionsFilters) =>
    ["commissions", "list", slug, filters] as const,
} as const;
