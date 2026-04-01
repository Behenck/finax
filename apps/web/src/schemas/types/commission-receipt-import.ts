import type { ImportFileType } from "./sale-import";

export interface CommissionReceiptImportTemplateFields {
	saleDateColumn: string;
	groupColumn: string;
	quotaColumn: string;
	installmentColumn: string;
	receivedAmountColumn: string;
}

export interface CommissionReceiptImportTemplateMapping {
	fields: CommissionReceiptImportTemplateFields;
}

export interface CommissionReceiptImportTemplate {
	id: string;
	name: string;
	headerSignature: string;
	mapping: CommissionReceiptImportTemplateMapping;
	createdBy: {
		id: string;
		name: string | null;
	};
	createdAt: string;
	updatedAt: string;
	isSuggested: boolean;
}

export interface CommissionReceiptImportTemplatesResponse {
	templates: CommissionReceiptImportTemplate[];
}

export interface CreateCommissionReceiptImportTemplateBody {
	name: string;
	headerSignature: string;
	mapping: CommissionReceiptImportTemplateMapping;
}

export type UpdateCommissionReceiptImportTemplateBody =
	CreateCommissionReceiptImportTemplateBody;

export type CommissionReceiptImportRowStatus =
	| "READY"
	| "NO_ACTION"
	| "ATTENTION"
	| "ERROR";

export type CommissionReceiptImportRowAction =
	| "MARK_AS_PAID"
	| "UPDATE_AMOUNT_AND_MARK_AS_PAID"
	| "NONE";

export interface CommissionReceiptImportPreviewRow {
	rowNumber: number;
	status: CommissionReceiptImportRowStatus;
	action: CommissionReceiptImportRowAction;
	reason: string;
	saleDate: string | null;
	groupValue: string | null;
	quotaValue: string | null;
	installmentText: string | null;
	receivedAmount: number | null;
	saleId: string | null;
	saleStatus: string | null;
	installmentId: string | null;
	installmentNumber: number | null;
	installmentStatus: "PENDING" | "PAID" | "CANCELED" | null;
	installmentAmount: number | null;
}

export interface CommissionReceiptImportPreviewResult {
	summary: {
		totalRows: number;
		readyRows: number;
		noActionRows: number;
		attentionRows: number;
		errorRows: number;
	};
	rows: CommissionReceiptImportPreviewRow[];
}

export interface ExecuteCommissionReceiptImportPreviewBody {
	fileType: ImportFileType;
	headerSignature: string;
	templateId?: string;
	importDate: string;
	rows: Array<Record<string, unknown>>;
	mapping: CommissionReceiptImportTemplateMapping;
}

export interface ExecuteCommissionReceiptImportApplyBody
	extends ExecuteCommissionReceiptImportPreviewBody {
	selectedRowNumbers: number[];
}

export interface CommissionReceiptImportApplyResult {
	requested: number;
	applied: number;
	skipped: number;
	results: Array<{
		rowNumber: number;
		result: "APPLIED" | "SKIPPED";
		reason: string;
		installmentId: string | null;
		saleId: string | null;
	}>;
}
