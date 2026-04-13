import type { ImportFileType } from "./sale-import";

export interface SaleDelinquencyImportCustomFieldMapping {
	customFieldLabel: string;
	columnKey: string;
}

export interface SaleDelinquencyImportTemplateFields {
	saleDateColumn: string;
	customFieldMappings: SaleDelinquencyImportCustomFieldMapping[];
}

export interface SaleDelinquencyImportTemplateMapping {
	fields: SaleDelinquencyImportTemplateFields;
}

export interface SaleDelinquencyImportTemplate {
	id: string;
	name: string;
	headerSignature: string;
	mapping: SaleDelinquencyImportTemplateMapping;
	createdBy: {
		id: string;
		name: string | null;
	};
	createdAt: string;
	updatedAt: string;
	isSuggested: boolean;
}

export interface SaleDelinquencyImportTemplatesResponse {
	templates: SaleDelinquencyImportTemplate[];
}

export interface CreateSaleDelinquencyImportTemplateBody {
	name: string;
	headerSignature: string;
	mapping: SaleDelinquencyImportTemplateMapping;
}

export type UpdateSaleDelinquencyImportTemplateBody =
	CreateSaleDelinquencyImportTemplateBody;

export type SaleDelinquencyImportPreviewRowStatus =
	| "READY"
	| "NO_ACTION"
	| "ATTENTION"
	| "ERROR";

export type SaleDelinquencyImportPreviewRowAction =
	| "CREATE_DELINQUENCY"
	| "NONE";

export interface SaleDelinquencyImportPreviewCustomFieldValue {
	customFieldLabel: string;
	value: string | null;
}

export interface SaleDelinquencyImportPreviewRow {
	rowNumber: number;
	status: SaleDelinquencyImportPreviewRowStatus;
	action: SaleDelinquencyImportPreviewRowAction;
	reason: string;
	saleDate: string | null;
	dueDate: string | null;
	saleId: string | null;
	saleStatus: string | null;
	customFieldValues: SaleDelinquencyImportPreviewCustomFieldValue[];
	matchCount: number;
	matchedSaleIds: string[];
}

export interface SaleDelinquencyImportPreviewResult {
	summary: {
		totalRows: number;
		readyRows: number;
		noActionRows: number;
		attentionRows: number;
		errorRows: number;
	};
	rows: SaleDelinquencyImportPreviewRow[];
}

export interface ExecuteSaleDelinquencyImportPreviewBody {
	fileType: ImportFileType;
	headerSignature: string;
	templateId?: string;
	importDate: string;
	rows: Array<Record<string, unknown>>;
	mapping: SaleDelinquencyImportTemplateMapping;
}

export interface ExecuteSaleDelinquencyImportApplyBody
	extends ExecuteSaleDelinquencyImportPreviewBody {
	selectedRowNumbers: number[];
}

export interface SaleDelinquencyImportApplyResult {
	requested: number;
	applied: number;
	skipped: number;
	results: Array<{
		rowNumber: number;
		result: "APPLIED" | "SKIPPED";
		reason: string;
		saleId: string | null;
		delinquencyId: string | null;
	}>;
}

export interface SaleDelinquencyImportSearchFieldsResponse {
	fields: Array<{
		label: string;
	}>;
}
