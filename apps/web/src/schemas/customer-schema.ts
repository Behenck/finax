import { z } from "zod"

const baseCustomerSchema = z.object({
  email: z
    .email("Email inválido")
    .optional()
    .or(z.literal("")),
  phone: z.string({ error: "Telefone inválido" }).optional(),
})

const customerPFSchema = baseCustomerSchema.extend({
  personType: z.literal("PF"),
  name: z.string().min(1, "Nome obrigatório"),
  documentType: z.enum(["CPF", "RG", "PASSPORT", "OTHER"]),
  documentNumber: z.string().min(5, "Documento obrigatório"),
  birthDate: z.date().optional(),
  naturality: z.string().optional(),
  motherName: z.string().optional(),
  fatherName: z.string().optional(),
  profession: z.string().optional(),
  monthlyIncome: z.preprocess(v => (Number.isFinite(Number(v)) ? Number(v) : 0), z.number().int().nonnegative()),
})


const customerPJSchema = baseCustomerSchema.extend({
  personType: z.literal("PJ"),
  corporateName: z.string().min(1, "Nome da empresa obrigatório"),
  documentType: z.enum(["CNPJ", "IE", "OTHER"]),
  documentNumber: z.string().min(5, "Documento obrigatório"),
  fantasyName: z.string().optional(),
  corporateReason: z.string().optional(),
  stateRegistration: z.string().optional(),
  municipalRegistration: z.string().optional(),
  foundationDate: z.date().optional(),
  businessActivity: z.string().optional(),
})

export const customerSchema = z.discriminatedUnion("personType", [
  customerPFSchema,
  customerPJSchema,
])

export type CustomerFormData = z.infer<typeof customerSchema>
export type CustomerFormInput = z.input<typeof customerSchema>

