import z from "zod";
import { SaleResponsibleTypeSchema } from "./sale-schemas";

export const IMPORT_FILE_TYPE_VALUES = ["XLSX", "XLS", "CSV"] as const;

export const ImportFileTypeSchema = z.enum(IMPORT_FILE_TYPE_VALUES);

export const MAX_IMPORT_ROWS = 5_000;
export const MAX_IMPORT_COLUMNS = 200;
export const MAX_IMPORT_CELL_TEXT_LENGTH = 5_000;
export const MAX_IMPORT_HEADER_SIGNATURE_LENGTH = 200;
export const MAX_IMPORT_TEMPLATE_NAME_LENGTH = 120;

const ColumnKeySchema = z.string().trim().min(1).max(120);
const OptionalColumnKeySchema = z.string().trim().max(120).optional();

export const SaleImportFieldMappingSchema = z
	.object({
		saleDateColumn: ColumnKeySchema,
		totalAmountColumn: ColumnKeySchema,
		productColumn: OptionalColumnKeySchema,
		customerNameColumn: ColumnKeySchema,
		customerDocumentColumn: ColumnKeySchema,
		notesColumn: OptionalColumnKeySchema,
		customerEmailColumn: OptionalColumnKeySchema,
		customerPhoneColumn: OptionalColumnKeySchema,
	})
	.strict();

export const SaleImportDynamicFieldMappingSchema = z
	.object({
		fieldId: z.uuid(),
		columnKey: ColumnKeySchema,
	})
	.strict();

export const SaleImportDynamicProductMappingSchema = z
	.object({
		productId: z.uuid(),
		fields: z
			.array(SaleImportDynamicFieldMappingSchema)
			.max(MAX_IMPORT_COLUMNS),
	})
	.strict();

export const SaleImportFixedValuesSchema = z
	.object({
		companyId: z.uuid(),
		unitId: z.uuid().optional(),
		parentProductId: z.uuid(),
		responsible: z
			.object({
				type: SaleResponsibleTypeSchema,
				id: z.uuid(),
			})
			.strict()
			.optional(),
	})
	.strict();

export const SaleImportMappingSchema = z
	.object({
		fields: SaleImportFieldMappingSchema,
		fixedValues: SaleImportFixedValuesSchema,
		dynamicByProduct: z
			.array(SaleImportDynamicProductMappingSchema)
			.max(1)
			.default([]),
	})
	.strict();

export const SaleImportTemplateMappingSchema = z
	.object({
		fields: SaleImportFieldMappingSchema,
		dynamicByProduct: z
			.array(SaleImportDynamicProductMappingSchema)
			.max(1)
			.default([]),
	})
	.strict();

export const SaleImportTemplateSchema = z
	.object({
		id: z.uuid(),
		name: z.string(),
		headerSignature: z.string(),
		mapping: SaleImportTemplateMappingSchema,
		fixedValues: SaleImportFixedValuesSchema,
		createdBy: z.object({
			id: z.uuid(),
			name: z.string().nullable(),
		}),
		createdAt: z.date(),
		updatedAt: z.date(),
		isSuggested: z.boolean().default(false),
	})
	.strict();

export const SaleImportTemplatesResponseSchema = z
	.object({
		templates: z.array(SaleImportTemplateSchema),
	})
	.strict();

export const GetSaleImportTemplatesQuerySchema = z
	.object({
		headerSignature: z
			.string()
			.trim()
			.min(1)
			.max(MAX_IMPORT_HEADER_SIGNATURE_LENGTH)
			.optional(),
	})
	.strict();

export const CreateSaleImportTemplateBodySchema = z
	.object({
		name: z.string().trim().min(1).max(MAX_IMPORT_TEMPLATE_NAME_LENGTH),
		headerSignature: z
			.string()
			.trim()
			.min(8)
			.max(MAX_IMPORT_HEADER_SIGNATURE_LENGTH),
		mapping: SaleImportTemplateMappingSchema,
		fixedValues: SaleImportFixedValuesSchema,
	})
	.strict();

export const CreateSaleImportTemplateResponseSchema = z
	.object({
		templateId: z.uuid(),
	})
	.strict();

export const UpdateSaleImportTemplateBodySchema =
	CreateSaleImportTemplateBodySchema;

export const SaleImportRowSchema = z.record(z.string(), z.unknown());

export const PostSaleImportBodySchema = z
	.object({
		fileType: ImportFileTypeSchema,
		headerSignature: z
			.string()
			.trim()
			.min(8)
			.max(MAX_IMPORT_HEADER_SIGNATURE_LENGTH),
		templateId: z.uuid().optional(),
		rows: z.array(SaleImportRowSchema).min(1).max(MAX_IMPORT_ROWS),
		mapping: SaleImportMappingSchema,
	})
	.strict();

export const SaleImportFailureSchema = z
	.object({
		rowNumber: z.number().int().min(1),
		code: z.string().min(1),
		message: z.string().min(1),
		field: z.string().nullable(),
	})
	.strict();

export const PostSaleImportResponseSchema = z
	.object({
		totalRows: z.number().int().min(0),
		importedRows: z.number().int().min(0),
		failedRows: z.number().int().min(0),
		createdSaleIds: z.array(z.uuid()),
		failures: z.array(SaleImportFailureSchema),
	})
	.strict();

export type SaleImportTemplateMapping = z.infer<
	typeof SaleImportTemplateMappingSchema
>;

export type SaleImportFixedValues = z.infer<typeof SaleImportFixedValuesSchema>;
export type SaleImportMapping = z.infer<typeof SaleImportMappingSchema>;
export type PostSaleImportBody = z.infer<typeof PostSaleImportBodySchema>;
export type SaleImportFailure = z.infer<typeof SaleImportFailureSchema>;
export type SaleImportDynamicProductMapping = z.infer<
	typeof SaleImportDynamicProductMappingSchema
>;
