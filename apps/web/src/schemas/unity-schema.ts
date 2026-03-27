import z from "zod";

export const unitSchema = z.object({
	name: z.string({ error: "Defina o nome da Unidade" }),
	cnpj: z.string().optional(),
	country: z.string().optional(),
	state: z.string().optional(),
	city: z.string().optional(),
	street: z.string().optional(),
	zipCode: z.string().optional(),
	neighborhood: z.string().optional(),
	number: z.string().optional(),
	complement: z.string().optional(),
});

export type UnitFormData = z.infer<typeof unitSchema>;
