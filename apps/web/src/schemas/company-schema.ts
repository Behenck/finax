import z from "zod";

export const companySchema = z.object({
	name: z.string({ error: "Defina o nome da Empresa" }),
	cnpj: z.string().optional(),
});

export type CompanyFormData = z.infer<typeof companySchema>;
