import { SaleStatus } from "generated/prisma/enums";
import z from "zod";

export const saleResponsibleTypeValues = ["SELLER", "PARTNER"] as const;
export const SaleResponsibleTypeSchema = z.enum(saleResponsibleTypeValues);

const saleDateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const SaleDateInputSchema = z.string().regex(saleDateRegex).refine(
	(value) => {
		const parsed = new Date(`${value}T00:00:00.000Z`);
		return (
			!Number.isNaN(parsed.getTime()) &&
			parsed.toISOString().slice(0, 10) === value
		);
	},
	{
		message: "Invalid date format. Expected YYYY-MM-DD",
	},
);

export const SaleResponsibleSchema = z
	.object({
		type: SaleResponsibleTypeSchema,
		id: z.uuid(),
	})
	.strict();

export const CreateSaleBodySchema = z
	.object({
		saleDate: SaleDateInputSchema,
		customerId: z.uuid(),
		productId: z.uuid(),
		totalAmount: z.number().int().positive(),
		responsible: SaleResponsibleSchema,
		companyId: z.uuid(),
		unitId: z.uuid().optional(),
		notes: z.string().optional(),
	})
	.strict();

export const UpdateSaleBodySchema = CreateSaleBodySchema;

export const PatchSaleStatusBodySchema = z
	.object({
		status: z.enum(SaleStatus),
	})
	.strict();

const NamedEntitySchema = z.object({
	id: z.uuid(),
	name: z.string(),
});

export const SaleResponsiblePayloadSchema = z.object({
	type: SaleResponsibleTypeSchema,
	id: z.uuid(),
	name: z.string(),
});

const SaleBaseResponseSchema = z.object({
	id: z.uuid(),
	saleDate: z.date(),
	totalAmount: z.number().int(),
	status: z.enum(SaleStatus),
	notes: z.string().nullable(),
	createdAt: z.date(),
	updatedAt: z.date(),
	customer: NamedEntitySchema,
	product: NamedEntitySchema,
	company: NamedEntitySchema,
	unit: NamedEntitySchema.nullable(),
	createdBy: z.object({
		id: z.uuid(),
		name: z.string().nullable(),
		avatarUrl: z.string().nullable(),
	}),
	responsible: SaleResponsiblePayloadSchema.nullable(),
});

export const SaleSummarySchema = SaleBaseResponseSchema;

export const SaleDetailSchema = SaleBaseResponseSchema.extend({
	organizationId: z.uuid(),
	companyId: z.uuid(),
	unitId: z.uuid().nullable(),
	customerId: z.uuid(),
	productId: z.uuid(),
	responsibleType: SaleResponsibleTypeSchema,
	responsibleId: z.uuid(),
	createdById: z.uuid(),
});

export type SaleResponsibleInput = z.infer<typeof SaleResponsibleSchema>;
export type CreateSaleBody = z.infer<typeof CreateSaleBodySchema>;
export type UpdateSaleBody = z.infer<typeof UpdateSaleBodySchema>;
export type PatchSaleStatusBody = z.infer<typeof PatchSaleStatusBodySchema>;

export function parseSaleDateInput(value: string) {
	return new Date(`${value}T00:00:00.000Z`);
}

