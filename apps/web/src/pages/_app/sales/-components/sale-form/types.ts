import type {
	GetOrganizationsSlugCustomersQueryResponse,
	GetOrganizationsSlugSalesSaleid200,
} from "@/http/generated";
import type { SaleCommissionFormData } from "@/schemas/sale-schema";

export type SaleDetail = GetOrganizationsSlugSalesSaleid200["sale"];

export interface SaleFormProps {
	mode?: "CREATE" | "UPDATE";
	initialSale?: SaleDetail;
	prefilledCustomerId?: string;
}

export type SaleCustomerOption =
	GetOrganizationsSlugCustomersQueryResponse["customers"][number];

export type SaleCommissionDetailLike = {
	sourceType: "PULLED" | "MANUAL";
	recipientType: SaleCommissionFormData["recipientType"];
	direction?: SaleCommissionFormData["direction"];
	beneficiaryId?: string | null;
	beneficiaryLabel?: string | null;
	startDate?: string | null;
	totalPercentage: number;
	installments: Array<{
		installmentNumber: number;
		percentage: number;
	}>;
};
