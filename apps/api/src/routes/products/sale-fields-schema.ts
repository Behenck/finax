import { SaleDynamicFieldType } from "generated/prisma/enums";
import z from "zod";

const SELECTABLE_FIELD_TYPES = new Set<SaleDynamicFieldType>([
	SaleDynamicFieldType.SELECT,
	SaleDynamicFieldType.MULTI_SELECT,
]);

export const SaleDynamicFieldTypeSchema = z.enum(SaleDynamicFieldType);

export function normalizeCaseInsensitiveLabel(value: string) {
	return value
		.trim()
		.replace(/\s+/g, " ")
		.normalize("NFKC")
		.toLowerCase();
}

export const ProductSaleFieldOptionInputSchema = z
	.object({
		label: z.string().trim().min(1),
	})
	.strict();

export const ProductSaleFieldInputSchema = z
	.object({
		label: z.string().trim().min(1),
		type: SaleDynamicFieldTypeSchema,
		required: z.boolean().default(false),
		options: z.array(ProductSaleFieldOptionInputSchema).default([]),
	})
	.strict()
	.superRefine((field, ctx) => {
		const isSelectableType = SELECTABLE_FIELD_TYPES.has(field.type);

		if (isSelectableType && field.options.length === 0) {
			ctx.addIssue({
				code: "custom",
				message: "Selection fields must have at least one option",
				path: ["options"],
			});
		}

		if (!isSelectableType && field.options.length > 0) {
			ctx.addIssue({
				code: "custom",
				message: "Only selection fields can have options",
				path: ["options"],
			});
		}

		const normalizedOptionLabels = new Set<string>();
		for (const [optionIndex, option] of field.options.entries()) {
			const normalizedLabel = normalizeCaseInsensitiveLabel(option.label);
			if (normalizedOptionLabels.has(normalizedLabel)) {
				ctx.addIssue({
					code: "custom",
					message: "Option labels must be unique for this field",
					path: ["options", optionIndex, "label"],
				});
			}
			normalizedOptionLabels.add(normalizedLabel);
		}
	});

export const ReplaceProductSaleFieldsBodySchema = z
	.object({
		fields: z.array(ProductSaleFieldInputSchema),
	})
	.strict()
	.superRefine((value, ctx) => {
		const normalizedFieldLabels = new Set<string>();

		for (const [fieldIndex, field] of value.fields.entries()) {
			const normalizedLabel = normalizeCaseInsensitiveLabel(field.label);
			if (normalizedFieldLabels.has(normalizedLabel)) {
				ctx.addIssue({
					code: "custom",
					message: "Field labels must be unique within the product",
					path: ["fields", fieldIndex, "label"],
				});
			}
			normalizedFieldLabels.add(normalizedLabel);
		}
	});

export const ProductSaleFieldOptionSchema = z.object({
	id: z.uuid(),
	label: z.string(),
});

export const ProductSaleFieldSchema = z.object({
	id: z.uuid(),
	label: z.string(),
	type: SaleDynamicFieldTypeSchema,
	required: z.boolean(),
	options: z.array(ProductSaleFieldOptionSchema),
});

export const GetProductSaleFieldsResponseSchema = z.object({
	fields: z.array(ProductSaleFieldSchema),
});

export type ReplaceProductSaleFieldsBody = z.infer<
	typeof ReplaceProductSaleFieldsBodySchema
>;
