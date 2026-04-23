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
	expectedPaymentDate: string | null;
	paymentDate: string;
	reversalDate: string;
};

export type InstallmentReversalAction = {
	installment: CommissionInstallmentRow;
	reversalDate: string;
	cancelPendingInstallments: boolean;
	pendingFutureInstallmentsCount: number;
	mode: "AUTO" | "MANUAL";
	calculationStatus: "LOADING" | "READY" | "ERROR";
	calculationError: string | null;
	hasManualOverride: boolean;
	manualAmount: string;
	rulePercentage: number | null;
	totalPaidAmount: number | null;
	calculatedAmount: number | null;
};

export type InstallmentReversalUndoAction = {
	installment: CommissionInstallmentRow;
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
	reversed: InstallmentSummaryBucket;
};

export type SelectedInstallment = {
	id: string;
	saleId: string;
	amount: number;
	status: SaleCommissionInstallmentStatus;
};

export type ProductOption = {
	id: string;
	label: string;
};

export type BulkInstallmentStatus = "PENDING" | "PAID" | "CANCELED";
