import z from "zod";

export const unitSchema = z
  .object({
    name: z.string({ error: "Defina o nome da Unidade" }),
  });

export type UnitFormData = z.infer<typeof unitSchema>