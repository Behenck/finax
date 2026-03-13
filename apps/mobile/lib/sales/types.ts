import type {
  GetOrganizationsSlugCommissionsInstallments200,
  GetOrganizationsSlugCommissionsInstallmentsQueryParams,
} from "@/http/generated/models/GetOrganizationsSlugCommissionsInstallments";
import type { GetOrganizationsSlugMembersRole200 } from "@/http/generated/models/GetOrganizationsSlugMembersRole";
import type { GetOrganizationsSlugProductsIdCommissionScenarios200 } from "@/http/generated/models/GetOrganizationsSlugProductsIdCommissionScenarios";
import type { GetOrganizationsSlugProductsIdSaleFields200 } from "@/http/generated/models/GetOrganizationsSlugProductsIdSaleFields";
import type {
  GetOrganizationsSlugSales200,
  ResponsibleTypeEnum6Key,
  SalesStatusEnumKey,
} from "@/http/generated/models/GetOrganizationsSlugSales";
import type { GetOrganizationsSlugSalesDashboard200 } from "@/http/generated/models/GetOrganizationsSlugSalesDashboard";
import type { GetOrganizationsSlugSalesSaleid200 } from "@/http/generated/models/GetOrganizationsSlugSalesSaleid";
import type { GetOrganizationsSlugSalesSaleidCommissionInstallments200 } from "@/http/generated/models/GetOrganizationsSlugSalesSaleidCommissionInstallments";
import type { GetOrganizationsSlugSalesSaleidHistory200 } from "@/http/generated/models/GetOrganizationsSlugSalesSaleidHistory";
import type { PostOrganizationsSlugSalesMutationRequest } from "@/http/generated/models/PostOrganizationsSlugSales";
import type { PutOrganizationsSlugSalesSaleidMutationRequest } from "@/http/generated/models/PutOrganizationsSlugSalesSaleid";
import type { Company, Customer, Partner, ProductNode, Seller } from "@/types/registers";

export type SaleStatus = SalesStatusEnumKey;
export type SaleResponsibleType = ResponsibleTypeEnum6Key;
export type SaleListItem = GetOrganizationsSlugSales200["sales"][number];
export type SaleDetail = GetOrganizationsSlugSalesSaleid200["sale"];
export type SaleInstallment = GetOrganizationsSlugSalesSaleidCommissionInstallments200["installments"][number];
export type SaleHistoryEvent = GetOrganizationsSlugSalesSaleidHistory200["history"][number];
export type CommissionInstallment =
  GetOrganizationsSlugCommissionsInstallments200["items"][number];
export type CommissionsPagination =
  GetOrganizationsSlugCommissionsInstallments200["pagination"];
export type SalesDashboardData = GetOrganizationsSlugSalesDashboard200;
export type SalesDashboardStatusKey = keyof SalesDashboardData["sales"]["byStatus"];

export type ProductCommissionScenarios =
  GetOrganizationsSlugProductsIdCommissionScenarios200["scenarios"];
export type ProductSaleFields = GetOrganizationsSlugProductsIdSaleFields200["fields"];
export type SupervisorMember = GetOrganizationsSlugMembersRole200["members"][number];

export type CreateSalePayload = PostOrganizationsSlugSalesMutationRequest;
export type UpdateSalePayload = PutOrganizationsSlugSalesSaleidMutationRequest;
export type CommissionsFiltersInput = GetOrganizationsSlugCommissionsInstallmentsQueryParams;

export type SaleDynamicFieldType =
  | "TEXT"
  | "NUMBER"
  | "CURRENCY"
  | "RICH_TEXT"
  | "PHONE"
  | "SELECT"
  | "MULTI_SELECT"
  | "DATE"
  | "DATE_TIME";

export type SaleDynamicFieldSchemaItem = {
  fieldId: string;
  label: string;
  type: SaleDynamicFieldType;
  required: boolean;
  options: Array<{
    id: string;
    label: string;
    isDefault?: boolean;
  }>;
};

export type SaleFormOptionSet = {
  companies: Company[];
  customers: Customer[];
  products: ProductNode[];
  sellers: Seller[];
  partners: Partner[];
  supervisors: Array<{
    id: string;
    name: string;
  }>;
};

export type SaleProductOption = {
  id: string;
  name: string;
  path: string[];
  label: string;
};

export type SaleCommissionRecipientType =
  | "COMPANY"
  | "UNIT"
  | "SELLER"
  | "PARTNER"
  | "SUPERVISOR"
  | "OTHER";

export type SaleCommissionDirection = "INCOME" | "OUTCOME";
export type SaleCommissionSourceType = "PULLED" | "MANUAL";
export type SaleCommissionInstallmentStatus = "PENDING" | "PAID" | "CANCELED";

export type SaleCommissionInstallmentInput = {
  installmentNumber: number;
  percentage: number;
};

export type SaleCommissionInput = {
  sourceType: SaleCommissionSourceType;
  recipientType: SaleCommissionRecipientType;
  direction?: SaleCommissionDirection;
  beneficiaryId?: string;
  beneficiaryLabel?: string;
  startDate: string;
  totalPercentage: number;
  installments: SaleCommissionInstallmentInput[];
};
