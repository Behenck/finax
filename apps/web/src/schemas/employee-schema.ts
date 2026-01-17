import z from "zod";

export const employeeSchema = z
  .object({
    name: z.string({ error: "Defina o nome do funcionário" }),
    role: z.string().optional(),
    email: z.email({ error: "Defina o email do funcionário" }),
    department: z.string().optional(),
    userId: z.uuid().optional(),
    companyId: z.uuid({ error: "Selecione uma empresa" })
  });

export type EmployeeFormData = z.infer<typeof employeeSchema>