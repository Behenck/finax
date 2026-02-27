import z from "zod";

export const productSchema = z.object({
	name: z
		.string({ error: "Defina o nome do Produto" })
		.min(1, "Defina o nome do Produto"),
	description: z.string().optional(),
});

export type ProductFormData = z.infer<typeof productSchema>;
