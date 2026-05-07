import { z } from "zod";

const optionalEmailSchema = z
	.string()
	.trim()
	.refine(
		(value) => value.length === 0 || z.email().safeParse(value).success,
		"Email inválido",
	);

export const sellerSchema = z
	.object({
		name: z.string().min(1, "Nome obrigatório"),
		email: optionalEmailSchema,
		phone: z.string().optional(),
		companyName: z.string().optional(),
		documentType: z.enum(["CPF", "CNPJ"]).optional(),
		document: z.string().optional(),
		country: z.string(),
		state: z.string(),
		city: z.string().optional(),
		street: z.string().optional(),
		zipCode: z.string().optional(),
		neighborhood: z.string().optional(),
		number: z.string().optional(),
		complement: z.string().optional(),
	})
	.superRefine((data, ctx) => {
		const hasDocument = Boolean(data.document?.trim());

		if (hasDocument && !data.documentType) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["documentType"],
				message: "Selecione o tipo do documento",
			});
		}
	});

export type SellerForm = z.input<typeof sellerSchema>;
