export const registersQueryKeys = {
  customers: (slug: string) => ["registers", "customers", slug] as const,
  customer: (slug: string, customerId: string) =>
    ["registers", "customers", slug, customerId] as const,
  sellers: (slug: string) => ["registers", "sellers", slug] as const,
  seller: (slug: string, sellerId: string) =>
    ["registers", "sellers", slug, sellerId] as const,
  partners: (slug: string) => ["registers", "partners", slug] as const,
  partner: (slug: string, partnerId: string) =>
    ["registers", "partners", slug, partnerId] as const,
  products: (slug: string) => ["registers", "products", slug] as const,
  product: (slug: string, productId: string) =>
    ["registers", "products", slug, productId] as const,
  companies: (slug: string) => ["registers", "companies", slug] as const,
  categories: (slug: string) => ["registers", "categories", slug] as const,
  costCenters: (slug: string) => ["registers", "cost-centers", slug] as const,
  employees: (slug: string) => ["registers", "employees", slug] as const,
} as const;
