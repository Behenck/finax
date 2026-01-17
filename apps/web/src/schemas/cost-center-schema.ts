import z from "zod";

export const costCenterSchema = z.object({
	name: z.string({ error: "Defina o nome do Centro de Custo" }),
});

export type CostCenterFormData = z.infer<typeof costCenterSchema>;
