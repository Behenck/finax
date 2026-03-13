import { deleteOrganizationsSlugSalesSaleid } from "@/http/generated/deleteOrganizationsSlugSalesSaleid";
import { deleteOrganizationsSlugSalesSaleidCommissionInstallmentsInstallmentid } from "@/http/generated/deleteOrganizationsSlugSalesSaleidCommissionInstallmentsInstallmentid";
import { getOrganizationsSlugCommissionsInstallments } from "@/http/generated/getOrganizationsSlugCommissionsInstallments";
import { getOrganizationsSlugMembersRole } from "@/http/generated/getOrganizationsSlugMembersRole";
import { getOrganizationsSlugProductsIdCommissionScenarios } from "@/http/generated/getOrganizationsSlugProductsIdCommissionScenarios";
import { getOrganizationsSlugProductsIdSaleFields } from "@/http/generated/getOrganizationsSlugProductsIdSaleFields";
import { getOrganizationsSlugSales } from "@/http/generated/getOrganizationsSlugSales";
import { getOrganizationsSlugSalesDashboard } from "@/http/generated/getOrganizationsSlugSalesDashboard";
import { getOrganizationsSlugSalesSaleid } from "@/http/generated/getOrganizationsSlugSalesSaleid";
import { getOrganizationsSlugSalesSaleidCommissionInstallments } from "@/http/generated/getOrganizationsSlugSalesSaleidCommissionInstallments";
import { getOrganizationsSlugSalesSaleidHistory } from "@/http/generated/getOrganizationsSlugSalesSaleidHistory";
import type { GetOrganizationsSlugCommissionsInstallmentsQueryParams } from "@/http/generated/models/GetOrganizationsSlugCommissionsInstallments";
import type { PatchOrganizationsSlugSalesSaleidCommissionInstallmentsInstallmentidMutationRequest } from "@/http/generated/models/PatchOrganizationsSlugSalesSaleidCommissionInstallmentsInstallmentid";
import type { PatchOrganizationsSlugSalesSaleidCommissionInstallmentsInstallmentidStatusMutationRequest } from "@/http/generated/models/PatchOrganizationsSlugSalesSaleidCommissionInstallmentsInstallmentidStatus";
import type { PatchOrganizationsSlugSalesSaleidStatusMutationRequestStatusEnumKey } from "@/http/generated/models/PatchOrganizationsSlugSalesSaleidStatus";
import type { PatchOrganizationsSlugSalesStatusBulkMutationRequestStatusEnumKey } from "@/http/generated/models/PatchOrganizationsSlugSalesStatusBulk";
import { patchOrganizationsSlugSalesSaleidCommissionInstallmentsInstallmentid } from "@/http/generated/patchOrganizationsSlugSalesSaleidCommissionInstallmentsInstallmentid";
import { patchOrganizationsSlugSalesSaleidCommissionInstallmentsInstallmentidStatus } from "@/http/generated/patchOrganizationsSlugSalesSaleidCommissionInstallmentsInstallmentidStatus";
import { patchOrganizationsSlugSalesSaleidStatus } from "@/http/generated/patchOrganizationsSlugSalesSaleidStatus";
import { patchOrganizationsSlugSalesStatusBulk } from "@/http/generated/patchOrganizationsSlugSalesStatusBulk";
import { postOrganizationsSlugSales } from "@/http/generated/postOrganizationsSlugSales";
import { putOrganizationsSlugSalesSaleid } from "@/http/generated/putOrganizationsSlugSalesSaleid";
import type {
  CommissionInstallment,
  CommissionsFiltersInput,
  CreateSalePayload,
  ProductCommissionScenarios,
  ProductSaleFields,
  SaleDetail,
  SaleFormOptionSet,
  SaleHistoryEvent,
  SaleInstallment,
  SalesDashboardData,
  SaleListItem,
  UpdateSalePayload,
} from "@/lib/sales/types";
import {
  listCompanies,
  listCustomers,
  listPartners,
  listProducts,
  listSellers,
} from "@/lib/registers";

export async function listSales(slug: string): Promise<SaleListItem[]> {
  const data = await getOrganizationsSlugSales({ slug });
  return data.sales as SaleListItem[];
}

export async function getSale(slug: string, saleId: string): Promise<SaleDetail> {
  const data = await getOrganizationsSlugSalesSaleid({ slug, saleId });
  return data.sale as SaleDetail;
}

export async function createSale(slug: string, payload: CreateSalePayload): Promise<string> {
  const data = await postOrganizationsSlugSales({ slug, data: payload });
  return data.saleId;
}

export async function updateSale(
  slug: string,
  saleId: string,
  payload: UpdateSalePayload,
): Promise<void> {
  await putOrganizationsSlugSalesSaleid({
    slug,
    saleId,
    data: payload,
  });
}

export async function deleteSale(slug: string, saleId: string): Promise<void> {
  await deleteOrganizationsSlugSalesSaleid({ slug, saleId });
}

export async function patchSaleStatus(
  slug: string,
  saleId: string,
  status: PatchOrganizationsSlugSalesSaleidStatusMutationRequestStatusEnumKey,
): Promise<void> {
  await patchOrganizationsSlugSalesSaleidStatus({
    slug,
    saleId,
    data: { status },
  });
}

export async function patchSalesStatusBulk(
  slug: string,
  saleIds: string[],
  status: PatchOrganizationsSlugSalesStatusBulkMutationRequestStatusEnumKey,
): Promise<number> {
  const data = await patchOrganizationsSlugSalesStatusBulk({
    slug,
    data: { saleIds, status },
  });

  return data.updated;
}

export async function listSaleHistory(slug: string, saleId: string): Promise<SaleHistoryEvent[]> {
  const data = await getOrganizationsSlugSalesSaleidHistory({ slug, saleId });
  return data.history as SaleHistoryEvent[];
}

export async function listSaleInstallments(
  slug: string,
  saleId: string,
): Promise<SaleInstallment[]> {
  const data = await getOrganizationsSlugSalesSaleidCommissionInstallments({ slug, saleId });
  return data.installments as SaleInstallment[];
}

export async function patchSaleInstallment(
  slug: string,
  saleId: string,
  installmentId: string,
  payload: PatchOrganizationsSlugSalesSaleidCommissionInstallmentsInstallmentidMutationRequest,
): Promise<void> {
  await patchOrganizationsSlugSalesSaleidCommissionInstallmentsInstallmentid({
    slug,
    saleId,
    installmentId,
    data: payload,
  });
}

export async function patchSaleInstallmentStatus(
  slug: string,
  saleId: string,
  installmentId: string,
  payload: PatchOrganizationsSlugSalesSaleidCommissionInstallmentsInstallmentidStatusMutationRequest,
): Promise<void> {
  await patchOrganizationsSlugSalesSaleidCommissionInstallmentsInstallmentidStatus({
    slug,
    saleId,
    installmentId,
    data: payload,
  });
}

export async function deleteSaleInstallment(
  slug: string,
  saleId: string,
  installmentId: string,
): Promise<void> {
  await deleteOrganizationsSlugSalesSaleidCommissionInstallmentsInstallmentid({
    slug,
    saleId,
    installmentId,
  });
}

export async function listCommissionsInstallments(
  slug: string,
  params: CommissionsFiltersInput,
): Promise<{
  items: CommissionInstallment[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  summaryByDirection: {
    INCOME: {
      total: { count: number; amount: number };
      pending: { count: number; amount: number };
      paid: { count: number; amount: number };
      canceled: { count: number; amount: number };
    };
    OUTCOME: {
      total: { count: number; amount: number };
      pending: { count: number; amount: number };
      paid: { count: number; amount: number };
      canceled: { count: number; amount: number };
    };
  };
}> {
  const data = await getOrganizationsSlugCommissionsInstallments({
    slug,
    params: params as GetOrganizationsSlugCommissionsInstallmentsQueryParams,
  });

  return {
    items: data.items as CommissionInstallment[],
    pagination: data.pagination,
    summaryByDirection: data.summaryByDirection,
  };
}

export async function getSalesDashboardData(
  slug: string,
  month: string,
): Promise<SalesDashboardData> {
  return getOrganizationsSlugSalesDashboard({
    slug,
    params: { month },
  }) as Promise<SalesDashboardData>;
}

export async function getProductCommissionScenarios(
  slug: string,
  productId: string,
): Promise<ProductCommissionScenarios> {
  const data = await getOrganizationsSlugProductsIdCommissionScenarios({
    slug,
    id: productId,
  });
  return data.scenarios as ProductCommissionScenarios;
}

export async function getProductSaleFields(
  slug: string,
  productId: string,
): Promise<ProductSaleFields> {
  const data = await getOrganizationsSlugProductsIdSaleFields({
    slug,
    id: productId,
    params: {
      includeInherited: true,
    },
  });

  return data.fields as ProductSaleFields;
}

export async function listSaleFormOptions(slug: string): Promise<SaleFormOptionSet> {
  const [companies, customers, products, sellers, partners, supervisorsData] =
    await Promise.all([
      listCompanies(slug),
      listCustomers(slug),
      listProducts(slug),
      listSellers(slug),
      listPartners(slug),
      getOrganizationsSlugMembersRole({
        slug,
        role: "SUPERVISOR",
      }),
    ]);

  return {
    companies,
    customers: customers.filter((customer) => customer.status === "ACTIVE"),
    products,
    sellers: sellers.filter((seller) => seller.status === "ACTIVE"),
    partners: partners.filter((partner) => partner.status === "ACTIVE"),
    supervisors: supervisorsData.members.map((member) => ({
      id: member.id,
      name: member.name ?? member.email,
    })),
  };
}
