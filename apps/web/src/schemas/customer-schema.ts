import { z } from "zod"

const baseCustomerSchema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  email: z
    .email("Email inválido")
    .optional()
    .or(z.literal("")),
  phone: z.string({ error: "Telefone inválido" }).optional(),
  responsibleType: z.enum(["SELLER", "PARTNER"]).optional(),
  responsibleId: z.uuid().optional(),
})

const customerPFSchema = baseCustomerSchema.extend({
  personType: z.literal("PF"),
  documentType: z.enum(["CPF", "RG", "PASSPORT", "OTHER"]),
  documentNumber: z.string().min(5, "Documento obrigatório"),
  birthDate: z.date().optional(),
  naturality: z.string().optional(),
  motherName: z.string().optional(),
  fatherName: z.string().optional(),
  profession: z.string().optional(),
  // monthlyIncome: z.preprocess(v => (Number.isFinite(Number(v)) ? Number(v) : 0), z.number().int().nonnegative()),
  monthlyIncome: z
    .preprocess(
      (value) => {
        if (value === "" || value === null || value === undefined) {
          return undefined
        }

        const numberValue = Number(value)
        return Number.isNaN(numberValue) ? undefined : numberValue
      },
      z.number().optional()
    ),
})


const customerPJSchema = baseCustomerSchema.extend({
  personType: z.literal("PJ"),
  documentType: z.enum(["CNPJ", "IE", "OTHER"]),
  documentNumber: z.string().min(5, "Documento obrigatório"),
  tradeName: z.string().optional(),
  legalName: z.string().optional(),
  stateRegistration: z.string().optional(),
  municipalRegistration: z.string().optional(),
  foundationDate: z.date().optional(),
  businessActivity: z.string().optional(),
})

export const customerSchema = z
  .discriminatedUnion("personType", [customerPFSchema, customerPJSchema])
  .superRefine((data, ctx) => {
    const hasResponsibleType = !!data.responsibleType
    const hasResponsibleId = !!data.responsibleId

    if (hasResponsibleType === hasResponsibleId) {
      return
    }

    ctx.addIssue({
      code: "custom",
      path: ["responsibleId"],
      message: "Selecione o responsável",
    })
  })

export type CustomerFormInput = z.input<typeof customerSchema>
export type CustomerFormOutput = z.infer<typeof customerSchema>
export type CustomerFormData = CustomerFormOutput
