import type { GetOrganizationsSlugCommissionsInstallments200 } from "@/http/generated";
import type { SaleCommissionInstallmentStatus } from "@/schemas/types/sales";

export type CommissionInstallmentRow =
	GetOrganizationsSlugCommissionsInstallments200["items"][number];

export type ProductTreeNode = {
	id: string;
	name: string;
	children?: ProductTreeNode[];
};

export type InstallmentPayAction = {
	installment: CommissionInstallmentRow;
	paymentDate: string;
	amount: string;
};

export type InstallmentEditState = {
	installment: CommissionInstallmentRow;
	percentage: string;
	amount: string;
	status: SaleCommissionInstallmentStatus;
	expectedPaymentDate: string;
	paymentDate: string;
};

export type InstallmentSummaryBucket = {
	count: number;
	amount: number;
};

export type InstallmentDirectionSummary = {
	total: InstallmentSummaryBucket;
	pending: InstallmentSummaryBucket;
	paid: InstallmentSummaryBucket;
	canceled: InstallmentSummaryBucket;
};

export type SelectedInstallment = {
	id: string;
	saleId: string;
	amount: number;
};

export type ProductOption = {
	id: string;
	label: string;
};
