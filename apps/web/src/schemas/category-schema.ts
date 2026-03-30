import z from "zod";
import { TransactionTypeSchema } from "./types/transactions";

export const categorySchema = z.object({
	name: z
		.string({ error: "Defina o nome da Categoria" })
		.trim()
		.min(1, "Defina o nome da Categoria"),
	code: z.string().optional(),
	icon: z.string(),
	color: z.string(),
	type: TransactionTypeSchema,
	parentId: z.uuid().optional(),
});

export type CategoryFormData = z.infer<typeof categorySchema>;
