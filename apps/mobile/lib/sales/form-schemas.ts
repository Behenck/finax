import { z } from "zod";
import { parseCurrencyToCents } from "@/lib/sales/utils";

const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;

const saleCommissionInstallmentSchema = z.object({
  installmentNumber: z.number().int().min(1, "Número de parcela inválido"),
  percentage: z
    .number()
    .min(0, "Percentual inválido")
    .max(100, "Percentual inválido"),
});

const saleCommissionSchema = z
  .object({
    sourceType: z.enum(["PULLED", "MANUAL"]),
    recipientType: z.enum([
      "COMPANY",
      "UNIT",
      "SELLER",
      "PARTNER",
      "SUPERVISOR",
      "OTHER",
    ]),
    direction: z.enum(["INCOME", "OUTCOME"]),
    beneficiaryId: z.string().optional(),
    beneficiaryLabel: z.string().optional(),
    startDate: z.string().regex(isoDateRegex, "Data inicial inválida"),
    totalPercentage: z
      .number()
      .min(0.0001, "Percentual total deve ser maior que zero")
      .max(100, "Percentual total inválido"),
    installments: z
      .array(saleCommissionInstallmentSchema)
      .min(1, "Adicione ao menos uma parcela"),
  })
  .superRefine((value, ctx) => {
    if (value.recipientType === "OTHER") {
      if (!value.beneficiaryLabel?.trim()) {
        ctx.addIssue({
          code: "custom",
          path: ["beneficiaryLabel"],
          message: "Informe o beneficiário.",
        });
      }
      return;
    }

    if (!value.beneficiaryId?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["beneficiaryId"],
        message: "Selecione o beneficiário.",
      });
    }

    const totalInstallments = value.installments.reduce(
      (sum, installment) => sum + installment.percentage,
      0,
    );

    if (Math.abs(totalInstallments - value.totalPercentage) > 0.01) {
      ctx.addIssue({
        code: "custom",
        path: ["installments"],
        message: "A soma das parcelas deve ser igual ao percentual total.",
      });
    }
  });

export const saleFormSchema = z.object({
  saleDate: z.string().regex(isoDateRegex, "Data da venda inválida"),
  customerId: z.string().min(1, "Selecione o cliente"),
  productId: z.string().min(1, "Selecione o produto"),
  companyId: z.string().min(1, "Selecione a empresa"),
  unitId: z.string().optional(),
  responsibleType: z.enum(["SELLER", "PARTNER"]),
  responsibleId: z.string().min(1, "Selecione o responsável"),
  totalAmount: z
    .string()
    .min(1, "Informe o valor da venda")
    .refine((value) => parseCurrencyToCents(value) > 0, {
      message: "Informe um valor válido",
    }),
  notes: z
    .string()
    .max(500, "A observação deve ter no máximo 500 caracteres")
    .optional(),
  dynamicFields: z.record(z.string(), z.unknown()),
  commissions: z.array(saleCommissionSchema),
});

export type SaleFormValues = z.infer<typeof saleFormSchema>;
export type SaleCommissionValues = z.infer<typeof saleCommissionSchema>;
