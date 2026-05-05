import { z } from "zod";

export const partnerSchema = z.object({
	name: z.string(),
	email: z
		.string()
		.refine(
			(value) =>
				value.trim().length === 0 || z.email().safeParse(value).success,
			"Email inválido",
		),
	phone: z.string(),
	companyName: z.string().trim().min(1, "Empresa obrigatória"),
	documentType: z.enum(["CPF", "CNPJ"]),
	document: z.string(),
	country: z.string(),
	state: z.string(),
	city: z.string().optional(),
	street: z.string().optional(),
	zipCode: z.string().optional(),
	neighborhood: z.string().optional(),
	number: z.string().optional(),
	complement: z.string().optional(),
});

export type PartnerForm = z.input<typeof partnerSchema>;
