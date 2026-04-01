import z from "zod";
import {
	ImportFileTypeSchema,
	MAX_IMPORT_HEADER_SIGNATURE_LENGTH,
	MAX_IMPORT_ROWS,
	MAX_IMPORT_TEMPLATE_NAME_LENGTH,
} from "./sale-import-schemas";
import {
	SaleCommissionInstallmentStatusSchema,
	SaleDateInputSchema,
} from "./sale-schemas";

const ColumnKeySchema = z.string().trim().min(1).max(120);

export const CommissionReceiptImportTemplateFieldsSchema = z
	.object({
		saleDateColumn: ColumnKeySchema,
		groupColumn: ColumnKeySchema,
		quotaColumn: ColumnKeySchema,
		installmentColumn: ColumnKeySchema,
		receivedAmountColumn: ColumnKeySchema,
	})
	.strict();

export const CommissionReceiptImportTemplateMappingSchema = z
	.object({
		fields: CommissionReceiptImportTemplateFieldsSchema,
	})
	.strict();

export const CommissionReceiptImportTemplateSchema = z
	.object({
		id: z.uuid(),
		name: z.string(),
		headerSignature: z.string(),
		mapping: CommissionReceiptImportTemplateMappingSchema,
		createdBy: z.object({
			id: z.uuid(),
			name: z.string().nullable(),
		}),
		createdAt: z.date(),
		updatedAt: z.date(),
		isSuggested: z.boolean().default(false),
	})
	.strict();

export const CommissionReceiptImportTemplatesResponseSchema = z
	.object({
		templates: z.array(CommissionReceiptImportTemplateSchema),
	})
	.strict();

export const GetCommissionReceiptImportTemplatesQuerySchema = z
	.object({
		headerSignature: z
			.string()
			.trim()
			.min(1)
			.max(MAX_IMPORT_HEADER_SIGNATURE_LENGTH)
			.optional(),
	})
	.strict();

export const CreateCommissionReceiptImportTemplateBodySchema = z
	.object({
		name: z.string().trim().min(1).max(MAX_IMPORT_TEMPLATE_NAME_LENGTH),
		headerSignature: z
			.string()
			.trim()
			.min(8)
			.max(MAX_IMPORT_HEADER_SIGNATURE_LENGTH),
		mapping: CommissionReceiptImportTemplateMappingSchema,
	})
	.strict();

export const UpdateCommissionReceiptImportTemplateBodySchema =
	CreateCommissionReceiptImportTemplateBodySchema;

export const CreateCommissionReceiptImportTemplateResponseSchema = z
	.object({
		templateId: z.uuid(),
	})
	.strict();

const CommissionReceiptImportRowSchema = z.record(z.string(), z.unknown());

export const CommissionReceiptImportRowStatusSchema = z.enum([
	"READY",
	"NO_ACTION",
	"ATTENTION",
	"ERROR",
]);

export const CommissionReceiptImportRowActionSchema = z.enum([
	"MARK_AS_PAID",
	"UPDATE_AMOUNT_AND_MARK_AS_PAID",
	"NONE",
]);

export const PostCommissionReceiptImportPreviewBodySchema = z
	.object({
		fileType: ImportFileTypeSchema,
		headerSignature: z
			.string()
			.trim()
			.min(8)
			.max(MAX_IMPORT_HEADER_SIGNATURE_LENGTH),
		templateId: z.uuid().optional(),
		importDate: SaleDateInputSchema,
		rows: z.array(CommissionReceiptImportRowSchema).min(1).max(MAX_IMPORT_ROWS),
		mapping: CommissionReceiptImportTemplateMappingSchema,
	})
	.strict();

export const CommissionReceiptImportPreviewRowSchema = z
	.object({
		rowNumber: z.number().int().min(1),
		status: CommissionReceiptImportRowStatusSchema,
		action: CommissionReceiptImportRowActionSchema,
		reason: z.string(),
		saleDate: SaleDateInputSchema.nullable(),
		groupValue: z.string().nullable(),
		quotaValue: z.string().nullable(),
		installmentText: z.string().nullable(),
		receivedAmount: z.number().int().nullable(),
		saleId: z.uuid().nullable(),
		saleStatus: z.string().nullable(),
		installmentId: z.uuid().nullable(),
		installmentNumber: z.number().int().min(1).nullable(),
		installmentStatus: SaleCommissionInstallmentStatusSchema.nullable(),
		installmentAmount: z.number().int().nullable(),
	})
	.strict();

export const PostCommissionReceiptImportPreviewResponseSchema = z
	.object({
		summary: z
			.object({
				totalRows: z.number().int().min(0),
				readyRows: z.number().int().min(0),
				noActionRows: z.number().int().min(0),
				attentionRows: z.number().int().min(0),
				errorRows: z.number().int().min(0),
			})
			.strict(),
		rows: z.array(CommissionReceiptImportPreviewRowSchema),
	})
	.strict();

export const PostCommissionReceiptImportApplyBodySchema =
	PostCommissionReceiptImportPreviewBodySchema.extend({
		selectedRowNumbers: z
			.array(z.number().int().min(1))
			.min(1)
			.max(MAX_IMPORT_ROWS),
	}).strict();

export const CommissionReceiptImportApplyResultRowSchema = z
	.object({
		rowNumber: z.number().int().min(1),
		result: z.enum(["APPLIED", "SKIPPED"]),
		reason: z.string(),
		installmentId: z.uuid().nullable(),
		saleId: z.uuid().nullable(),
	})
	.strict();

export const PostCommissionReceiptImportApplyResponseSchema = z
	.object({
		requested: z.number().int().min(0),
		applied: z.number().int().min(0),
		skipped: z.number().int().min(0),
		results: z.array(CommissionReceiptImportApplyResultRowSchema),
	})
	.strict();

export type CommissionReceiptImportTemplateMapping = z.infer<
	typeof CommissionReceiptImportTemplateMappingSchema
>;
export type PostCommissionReceiptImportPreviewBody = z.infer<
	typeof PostCommissionReceiptImportPreviewBodySchema
>;
export type PostCommissionReceiptImportApplyBody = z.infer<
	typeof PostCommissionReceiptImportApplyBodySchema
>;
export type CommissionReceiptImportPreviewRow = z.infer<
	typeof CommissionReceiptImportPreviewRowSchema
>;
