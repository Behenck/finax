import { z } from "zod"

export const sellerSchema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  email: z.email("Email inválido"),
  phone: z.string({ error: "Telefone inválido" }),
  companyName: z.string({ error: "Nome da empresa inválida" }),
  documentType: z.enum(["CPF", "CNPJ"]),
  document: z.string({ error: "Documento inválido" }),
  country: z.string(),
  state: z.string(),
  city: z.string().optional(),
  street: z.string().optional(),
  zipCode: z.string().optional(),
  neighborhood: z.string().optional(),
  number: z.string().optional(),
  complement: z.string().optional(),
})

export type SellerForm = z.input<typeof sellerSchema>
