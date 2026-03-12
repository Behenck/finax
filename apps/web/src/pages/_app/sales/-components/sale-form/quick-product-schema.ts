import z from "zod";

export const quickProductSchema = z.object({
	name: z.string().trim().min(1, "Nome obrigatório"),
});

export type QuickProductInput = z.input<typeof quickProductSchema>;
export type QuickProductData = z.infer<typeof quickProductSchema>;
