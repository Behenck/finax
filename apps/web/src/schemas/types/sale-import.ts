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

export interface SaleJsonDynamicFieldMapping {
  fieldId: string;
  jsonKey: string;
}

export interface SaleJsonImportPayload {
  parentProductId: string;
  dynamicFieldMappings?: SaleJsonDynamicFieldMapping[];
  cotas: Array<Record<string, unknown>>;
}

export interface SaleJsonImportGroupSuggestion {
  companyId?: string;
  companyName?: string;
  unitId?: string;
  unitName?: string;
  sellerId?: string;
  sellerName?: string;
  sellerEmail?: string;
}

export interface SaleJsonImportSuggestedEntity {
  type: "COMPANY" | "UNIT" | "SELLER" | "PARTNER" | "SUPERVISOR" | string;
  id: string;
  label: string;
  email?: string | null;
}

export interface SaleJsonImportPreview {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  hasCommissions: boolean;
  unitGroups: Array<{
    key: string;
    name: string;
    suggestions: SaleJsonImportGroupSuggestion[];
  }>;
  responsibleGroups: Array<{
    key: string;
    name: string | null;
    email: string | null;
    unitName: string | null;
    suggestions: SaleJsonImportGroupSuggestion[];
  }>;
  commissionBeneficiaryGroups: Array<{
    key: string;
    section: "unidade" | "vendedor" | "terceiros";
    externalType: string | null;
    externalId: string | null;
    name: string | null;
    email: string | null;
    suggestions: SaleJsonImportSuggestedEntity[];
  }>;
  rows: Array<{
    rowNumber: number;
    isValid: boolean;
    errors: string[];
    saleDate: string | null;
    status: string | null;
    totalAmount: number | null;
    customerDocument: string | null;
    productId: string | null;
    unitGroupKey: string | null;
    responsibleGroupKey: string | null;
    commissionBeneficiaryKeys: string[];
  }>;
}

export interface SaleJsonImportApplyBody extends SaleJsonImportPayload {
  unitResolutions: Array<{
    key: string;
    companyId: string;
    unitId?: string;
  }>;
  responsibleResolutions: Array<{
    key: string;
    type?: "COMPANY" | "UNIT" | "SELLER" | "PARTNER" | "SUPERVISOR" | "OTHER";
    id?: string;
    label?: string;
    sellerId?: string;
  }>;
  commissionBeneficiaryResolutions: Array<{
    key: string;
    recipientType:
      | "COMPANY"
      | "UNIT"
      | "SELLER"
      | "PARTNER"
      | "SUPERVISOR"
      | "OTHER";
    beneficiaryId?: string;
    beneficiaryLabel?: string;
  }>;
}

export interface SaleJsonImportResult {
  totalRows: number;
  importedRows: number;
  failedRows: number;
  createdSaleIds: string[];
  failures: Array<{
    rowNumber: number;
    code: string;
    message: string;
  }>;
}
