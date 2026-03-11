import z from "zod";

export const quickCustomerSchema = z.object({
	name: z.string().trim().min(1, "Nome obrigatório"),
	documentNumber: z
		.string()
		.trim()
		.min(1, "CPF obrigatório")
		.refine((value) => value.replace(/\D/g, "").length === 11, "CPF inválido"),
	phone: z
		.string()
		.optional()
		.or(z.literal(""))
		.refine(
			(value) =>
				!value ||
				value.replace(/\D/g, "").length === 10 ||
				value.replace(/\D/g, "").length === 11,
			"Celular inválido",
		),
});

export type QuickCustomerInput = z.input<typeof quickCustomerSchema>;
export type QuickCustomerData = z.infer<typeof quickCustomerSchema>;
