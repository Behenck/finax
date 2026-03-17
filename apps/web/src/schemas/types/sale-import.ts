export const IMPORT_FILE_TYPE_VALUES = ["XLSX", "XLS", "CSV"] as const;

export type ImportFileType = (typeof IMPORT_FILE_TYPE_VALUES)[number];

export interface SaleImportFieldMapping {
	saleDateColumn: string;
	totalAmountColumn: string;
	productColumn?: string;
	customerNameColumn: string;
	customerDocumentColumn: string;
	notesColumn?: string;
	customerEmailColumn?: string;
	customerPhoneColumn?: string;
}

export interface SaleImportDynamicFieldMapping {
	fieldId: string;
	columnKey: string;
}

export interface SaleImportDynamicProductMapping {
	productId: string;
	fields: SaleImportDynamicFieldMapping[];
}

export interface SaleImportFixedValues {
	companyId: string;
	unitId?: string;
	parentProductId: string;
	responsible?: {
		type: "SELLER" | "PARTNER";
		id: string;
	};
}

export interface SaleImportMapping {
	fields: SaleImportFieldMapping;
	fixedValues: SaleImportFixedValues;
	dynamicByProduct: SaleImportDynamicProductMapping[];
}

export interface SaleImportTemplateMapping {
	fields: SaleImportFieldMapping;
	dynamicByProduct: SaleImportDynamicProductMapping[];
}

export interface SaleImportTemplate {
	id: string;
	name: string;
	headerSignature: string;
	mapping: SaleImportTemplateMapping;
	fixedValues: SaleImportFixedValues;
	createdBy: {
		id: string;
		name: string | null;
	};
	createdAt: string;
	updatedAt: string;
	isSuggested: boolean;
}

export interface SaleImportFailure {
	rowNumber: number;
	code: string;
	message: string;
	field: string | null;
}

export interface SaleImportResult {
	totalRows: number;
	importedRows: number;
	failedRows: number;
	createdSaleIds: string[];
	failures: SaleImportFailure[];
}

export interface SaleImportTemplatesResponse {
	templates: SaleImportTemplate[];
}

export interface CreateSaleImportTemplateBody {
	name: string;
	headerSignature: string;
	mapping: SaleImportTemplateMapping;
	fixedValues: SaleImportFixedValues;
}

export type UpdateSaleImportTemplateBody = CreateSaleImportTemplateBody;

export interface ExecuteSaleImportBody {
	fileType: ImportFileType;
	headerSignature: string;
	templateId?: string;
	rows: Array<Record<string, unknown>>;
	mapping: SaleImportMapping;
}
