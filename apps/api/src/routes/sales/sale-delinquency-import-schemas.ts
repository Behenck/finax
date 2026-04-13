import { format } from "date-fns";
import { SaleStatus } from "generated/prisma/enums";
import z from "zod";
import {
	ImportFileTypeSchema,
	MAX_IMPORT_HEADER_SIGNATURE_LENGTH,
	MAX_IMPORT_ROWS,
	MAX_IMPORT_TEMPLATE_NAME_LENGTH,
} from "./sale-import-schemas";
import { SaleDateInputSchema } from "./sale-schemas";

const ColumnKeySchema = z.string().trim().min(1).max(120);
const CustomFieldLabelSchema = z.string().trim().min(1).max(120);

function normalizeComparableText(value: string) {
	return value
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.toLowerCase()
		.trim()
		.replace(/\s+/g, " ");
}

export const SaleDelinquencyImportCustomFieldMappingSchema = z
	.object({
		customFieldLabel: CustomFieldLabelSchema,
		columnKey: ColumnKeySchema,
	})
	.strict();

export const SaleDelinquencyImportTemplateFieldsSchema = z
	.object({
		saleDateColumn: ColumnKeySchema,
		customFieldMappings: z
			.array(SaleDelinquencyImportCustomFieldMappingSchema)
			.min(1)
			.max(50),
	})
	.strict()
	.superRefine((value, ctx) => {
		const seenColumnKeys = new Set<string>();
		const seenFieldLabels = new Set<string>();

		for (const [index, mapping] of value.customFieldMappings.entries()) {
			const normalizedFieldLabel = normalizeComparableText(
				mapping.customFieldLabel,
			);

			if (seenColumnKeys.has(mapping.columnKey)) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["customFieldMappings", index, "columnKey"],
					message: "Each custom field must use a different spreadsheet column",
				});
			}
			seenColumnKeys.add(mapping.columnKey);

			if (seenFieldLabels.has(normalizedFieldLabel)) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["customFieldMappings", index, "customFieldLabel"],
					message: "Custom field labels must be unique",
				});
			}
			seenFieldLabels.add(normalizedFieldLabel);
		}
	});

export const SaleDelinquencyImportTemplateMappingSchema = z
	.object({
		fields: SaleDelinquencyImportTemplateFieldsSchema,
	})
	.strict();

export const SaleDelinquencyImportTemplateSchema = z
	.object({
		id: z.uuid(),
		name: z.string(),
		headerSignature: z.string(),
		mapping: SaleDelinquencyImportTemplateMappingSchema,
		createdBy: z.object({
			id: z.uuid(),
			name: z.string().nullable(),
		}),
		createdAt: z.date(),
		updatedAt: z.date(),
		isSuggested: z.boolean().default(false),
	})
	.strict();

export const SaleDelinquencyImportTemplatesResponseSchema = z
	.object({
		templates: z.array(SaleDelinquencyImportTemplateSchema),
	})
	.strict();

export const GetSaleDelinquencyImportTemplatesQuerySchema = z
	.object({
		headerSignature: z
			.string()
			.trim()
			.min(1)
			.max(MAX_IMPORT_HEADER_SIGNATURE_LENGTH)
			.optional(),
	})
	.strict();

export const CreateSaleDelinquencyImportTemplateBodySchema = z
	.object({
		name: z.string().trim().min(1).max(MAX_IMPORT_TEMPLATE_NAME_LENGTH),
		headerSignature: z
			.string()
			.trim()
			.min(8)
			.max(MAX_IMPORT_HEADER_SIGNATURE_LENGTH),
		mapping: SaleDelinquencyImportTemplateMappingSchema,
	})
	.strict();

export const UpdateSaleDelinquencyImportTemplateBodySchema =
	CreateSaleDelinquencyImportTemplateBodySchema;

export const CreateSaleDelinquencyImportTemplateResponseSchema = z
	.object({
		templateId: z.uuid(),
	})
	.strict();

const SaleDelinquencyImportRowSchema = z.record(z.string(), z.unknown());

export const SaleDelinquencyImportPreviewRowStatusSchema = z.enum([
	"READY",
	"NO_ACTION",
	"ATTENTION",
	"ERROR",
]);

export const SaleDelinquencyImportPreviewRowActionSchema = z.enum([
	"CREATE_DELINQUENCY",
	"NONE",
]);

const SaleDelinquencyImportDateSchema = SaleDateInputSchema.refine(
	(value) => value <= format(new Date(), "yyyy-MM-dd"),
	{
		message: "Import date cannot be in the future",
	},
);

export const PostSaleDelinquencyImportPreviewBodySchema = z
	.object({
		fileType: ImportFileTypeSchema,
		headerSignature: z
			.string()
			.trim()
			.min(8)
			.max(MAX_IMPORT_HEADER_SIGNATURE_LENGTH),
		templateId: z.uuid().optional(),
		importDate: SaleDelinquencyImportDateSchema,
		rows: z.array(SaleDelinquencyImportRowSchema).min(1).max(MAX_IMPORT_ROWS),
		mapping: SaleDelinquencyImportTemplateMappingSchema,
	})
	.strict();

export const SaleDelinquencyImportPreviewCustomFieldValueSchema = z
	.object({
		customFieldLabel: z.string(),
		value: z.string().nullable(),
	})
	.strict();

export const SaleDelinquencyImportPreviewRowSchema = z
	.object({
		rowNumber: z.number().int().min(1),
		status: SaleDelinquencyImportPreviewRowStatusSchema,
		action: SaleDelinquencyImportPreviewRowActionSchema,
		reason: z.string(),
		saleDate: SaleDateInputSchema.nullable(),
		dueDate: SaleDateInputSchema.nullable(),
		saleId: z.uuid().nullable(),
		saleStatus: z.enum(SaleStatus).nullable(),
		customFieldValues: z.array(SaleDelinquencyImportPreviewCustomFieldValueSchema),
		matchCount: z.number().int().min(0),
		matchedSaleIds: z.array(z.uuid()),
	})
	.strict();

export const PostSaleDelinquencyImportPreviewResponseSchema = z
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
		rows: z.array(SaleDelinquencyImportPreviewRowSchema),
	})
	.strict();

export const PostSaleDelinquencyImportApplyBodySchema =
	PostSaleDelinquencyImportPreviewBodySchema.extend({
		selectedRowNumbers: z
			.array(z.number().int().min(1))
			.min(1)
			.max(MAX_IMPORT_ROWS),
	}).strict();

export const SaleDelinquencyImportApplyResultRowSchema = z
	.object({
		rowNumber: z.number().int().min(1),
		result: z.enum(["APPLIED", "SKIPPED"]),
		reason: z.string(),
		saleId: z.uuid().nullable(),
		delinquencyId: z.uuid().nullable(),
	})
	.strict();

export const PostSaleDelinquencyImportApplyResponseSchema = z
	.object({
		requested: z.number().int().min(0),
		applied: z.number().int().min(0),
		skipped: z.number().int().min(0),
		results: z.array(SaleDelinquencyImportApplyResultRowSchema),
	})
	.strict();

export const SaleDelinquencyImportSearchFieldsResponseSchema = z
	.object({
		fields: z.array(
			z
				.object({
					label: z.string(),
				})
				.strict(),
		),
	})
	.strict();

export const GetSaleDelinquencyImportSearchFieldsQuerySchema = z
	.object({
		productId: z.uuid().optional(),
	})
	.strict();

export type SaleDelinquencyImportTemplateMapping = z.infer<
	typeof SaleDelinquencyImportTemplateMappingSchema
>;

export type PostSaleDelinquencyImportPreviewBody = z.infer<
	typeof PostSaleDelinquencyImportPreviewBodySchema
>;

export type PostSaleDelinquencyImportApplyBody = z.infer<
	typeof PostSaleDelinquencyImportApplyBodySchema
>;

export type SaleDelinquencyImportPreviewRow = z.infer<
	typeof SaleDelinquencyImportPreviewRowSchema
>;
