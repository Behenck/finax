import { z } from "zod";

const optionalEmailSchema = z
  .string()
  .trim()
  .optional()
  .refine((value) => !value || z.email().safeParse(value).success, {
    message: "E-mail inválido",
  });

const optionalUuidSchema = z
  .string()
  .trim()
  .optional()
  .refine((value) => !value || z.uuid().safeParse(value).success, {
    message: "Selecione um item válido",
  });

const baseCustomerSchema = z.object({
  name: z.string().trim().min(1, "Nome obrigatório"),
  email: optionalEmailSchema,
  phone: z.string().trim().optional(),
  responsibleType: z.enum(["SELLER", "PARTNER"]).optional(),
  responsibleId: optionalUuidSchema,
});

const customerPfSchema = baseCustomerSchema.extend({
  personType: z.literal("PF"),
  documentType: z.enum(["CPF", "RG", "PASSPORT", "OTHER"]),
  documentNumber: z.string().trim().min(3, "Documento obrigatório"),
  birthDate: z.string().trim().optional(),
  monthlyIncome: z.string().trim().optional(),
  profession: z.string().trim().optional(),
  naturality: z.string().trim().optional(),
  fatherName: z.string().trim().optional(),
  motherName: z.string().trim().optional(),
});

const customerPjSchema = baseCustomerSchema.extend({
  personType: z.literal("PJ"),
  documentType: z.enum(["CNPJ", "IE", "OTHER"]),
  documentNumber: z.string().trim().min(3, "Documento obrigatório"),
  tradeName: z.string().trim().optional(),
  legalName: z.string().trim().optional(),
  stateRegistration: z.string().trim().optional(),
  municipalRegistration: z.string().trim().optional(),
  foundationDate: z.string().trim().optional(),
  businessActivity: z.string().trim().optional(),
});

export const customerFormSchema = z
  .discriminatedUnion("personType", [customerPfSchema, customerPjSchema])
  .superRefine((value, ctx) => {
    const hasResponsibleType = Boolean(value.responsibleType);
    const hasResponsibleId = Boolean(value.responsibleId);

    if (hasResponsibleType !== hasResponsibleId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["responsibleId"],
        message: "Selecione o responsável",
      });
    }
  });

export type CustomerFormValues = z.input<typeof customerFormSchema>;

const addressSchema = {
  country: z.string().trim().min(2, "País obrigatório"),
  state: z.string().trim().min(2, "Estado obrigatório"),
  city: z.string().trim().optional(),
  street: z.string().trim().optional(),
  zipCode: z.string().trim().optional(),
  neighborhood: z.string().trim().optional(),
  number: z.string().trim().optional(),
  complement: z.string().trim().optional(),
};

export const sellerFormSchema = z.object({
  name: z.string().trim().min(1, "Nome obrigatório"),
  email: z.email("E-mail inválido"),
  phone: z.string().trim().min(8, "Telefone inválido"),
  companyName: z.string().trim().min(1, "Empresa obrigatória"),
  documentType: z.enum(["CPF", "CNPJ"]),
  document: z.string().trim().min(3, "Documento obrigatório"),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
  ...addressSchema,
});

export type SellerFormValues = z.input<typeof sellerFormSchema>;

export const partnerFormSchema = z.object({
  name: z.string().trim().min(1, "Nome obrigatório"),
  email: z.email("E-mail inválido"),
  phone: z.string().trim().min(8, "Telefone inválido"),
  companyName: z.string().trim().min(1, "Empresa obrigatória"),
  documentType: z.enum(["CPF", "CNPJ"]),
  document: z.string().trim().min(3, "Documento obrigatório"),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
  supervisorId: optionalUuidSchema,
  ...addressSchema,
});

export type PartnerFormValues = z.input<typeof partnerFormSchema>;

export const productFormSchema = z.object({
  name: z.string().trim().min(1, "Nome obrigatório"),
  description: z.string().trim().optional(),
  parentId: optionalUuidSchema,
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0, "Ordem inválida").default(0),
});

export type ProductFormValues = z.input<typeof productFormSchema>;

export const employeeFormSchema = z.object({
  name: z.string().trim().min(1, "Nome obrigatório"),
  role: z.string().trim().optional(),
  email: z.email("E-mail inválido"),
  phone: z.string().trim().optional(),
  department: z.string().trim().optional(),
  cpf: z.string().trim().optional(),
  pixKeyType: z.enum(["CPF", "CNPJ", "EMAIL", "PHONE", "RANDOM"]).optional(),
  pixKey: z.string().trim().optional(),
  paymentNotes: z.string().trim().optional(),
  country: z.string().trim().optional(),
  state: z.string().trim().optional(),
  city: z.string().trim().optional(),
  street: z.string().trim().optional(),
  zipCode: z.string().trim().optional(),
  neighborhood: z.string().trim().optional(),
  number: z.string().trim().optional(),
  complement: z.string().trim().optional(),
  companyId: z.uuid("Selecione uma empresa"),
  unitId: optionalUuidSchema,
});

export type EmployeeFormValues = z.input<typeof employeeFormSchema>;

export const simpleNameSchema = z.object({
  name: z.string().trim().min(1, "Nome obrigatório"),
});

export type SimpleNameValues = z.input<typeof simpleNameSchema>;

export const unitFormSchema = z.object({
  name: z.string().trim().min(1, "Nome obrigatório"),
  country: z.string().trim().optional(),
  state: z.string().trim().optional(),
  city: z.string().trim().optional(),
  street: z.string().trim().optional(),
  zipCode: z.string().trim().optional(),
  neighborhood: z.string().trim().optional(),
  number: z.string().trim().optional(),
  complement: z.string().trim().optional(),
});

export type UnitFormValues = z.input<typeof unitFormSchema>;

export const categoryFormSchema = z.object({
  name: z.string().trim().min(1, "Nome obrigatório"),
  code: z.string().trim().optional(),
  type: z.enum(["INCOME", "OUTCOME"]),
  color: z.string().trim().min(1, "Cor obrigatória"),
  icon: z.string().trim().min(1, "Ícone obrigatório"),
  parentId: optionalUuidSchema,
});

export type CategoryFormValues = z.input<typeof categoryFormSchema>;
