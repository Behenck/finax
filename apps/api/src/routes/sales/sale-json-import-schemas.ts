import z from "zod";
import {
  SaleCommissionRecipientTypeSchema,
  SaleDateInputSchema,
  SaleResponsibleTypeSchema,
} from "./sale-schemas";

export const MAX_SALE_JSON_IMPORT_ROWS = 5_000;
export const SALE_JSON_IMPORT_BODY_LIMIT_BYTES = 25 * 1024 * 1024;

export const SaleJsonImportCotaSchema = z
  .object({
    contrato: z.unknown().optional(),
    cota: z.unknown().optional(),
    data_adesao: z.unknown().optional(),
    data_pagamento: z.unknown().optional(),
    cliente: z
      .object({
        nome: z.unknown().optional(),
        email: z.unknown().optional(),
        telefone: z.unknown().optional(),
        cpf_cnpj: z.unknown().optional(),
      })
      .passthrough()
      .optional(),
    vendedor: z
      .object({
        nome: z.unknown().optional(),
        email: z.unknown().optional(),
      })
      .passthrough()
      .optional(),
    unidade: z.unknown().optional(),
    situacao: z.unknown().optional(),
    status: z.unknown().optional(),
    administradora: z.unknown().optional(),
    servico: z.unknown().optional(),
    grupo: z.unknown().optional(),
    credito: z.unknown().optional(),
    porcentagem_amortizacao: z.unknown().optional(),
    porcentagem_taxa_administracao: z.unknown().optional(),
    tipo_parcela_antes_contemplacao: z.unknown().optional(),
    prazo: z.unknown().optional(),
    comissoes: z
      .object({
        unidade: z.array(z.unknown()).optional().default([]),
        vendedor: z.array(z.unknown()).optional().default([]),
        terceiros: z.array(z.unknown()).optional().default([]),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export const SaleJsonImportPayloadSchema = z
  .object({
    cotas: z
      .array(SaleJsonImportCotaSchema)
      .min(1)
      .max(MAX_SALE_JSON_IMPORT_ROWS),
  })
  .strict();

export const SaleJsonDynamicFieldMappingSchema = z
  .object({
    fieldId: z.uuid(),
    jsonKey: z.string().trim().min(1).max(120),
  })
  .strict();

export const SaleJsonImportPreviewBodySchema =
  SaleJsonImportPayloadSchema.extend({
    parentProductId: z.uuid(),
    dynamicFieldMappings: z
      .array(SaleJsonDynamicFieldMappingSchema)
      .default([]),
  });

export const SaleJsonImportUnitResolutionSchema = z
  .object({
    key: z.string().min(1),
    companyId: z.uuid(),
    unitId: z.uuid().optional(),
  })
  .strict();

export const SaleJsonImportResponsibleResolutionSchema = z
  .object({
    key: z.string().min(1),
    type: SaleResponsibleTypeSchema.optional(),
    id: z.uuid().optional(),
    label: z.string().trim().min(1).max(255).optional(),
    sellerId: z.uuid().optional(),
  })
  .strict()
  .superRefine((resolution, ctx) => {
    if (resolution.sellerId) {
      return;
    }

    if (resolution.type === "OTHER") {
      if (!resolution.label) {
        ctx.addIssue({
          code: "custom",
          message: "Responsible label is required for OTHER",
          path: ["label"],
        });
      }
      return;
    }

    if (!resolution.type) {
      ctx.addIssue({
        code: "custom",
        message: "Responsible type is required",
        path: ["type"],
      });
    }

    if (!resolution.id) {
      ctx.addIssue({
        code: "custom",
        message: "Responsible id is required",
        path: ["id"],
      });
    }
  });

export const SaleJsonImportCommissionBeneficiaryResolutionSchema = z
  .object({
    key: z.string().min(1),
    recipientType: SaleCommissionRecipientTypeSchema,
    beneficiaryId: z.uuid().optional(),
    beneficiaryLabel: z.string().trim().min(1).max(255).optional(),
  })
  .strict()
  .superRefine((resolution, ctx) => {
    if (resolution.recipientType === "OTHER") {
      if (!resolution.beneficiaryLabel) {
        ctx.addIssue({
          code: "custom",
          message: "Beneficiary label is required for OTHER recipient",
          path: ["beneficiaryLabel"],
        });
      }
      return;
    }

    if (!resolution.beneficiaryId) {
      ctx.addIssue({
        code: "custom",
        message: "Beneficiary id is required for this recipient type",
        path: ["beneficiaryId"],
      });
    }
  });

export const SaleJsonImportApplyBodySchema =
  SaleJsonImportPreviewBodySchema.extend({
    unitResolutions: z.array(SaleJsonImportUnitResolutionSchema).default([]),
    responsibleResolutions: z
      .array(SaleJsonImportResponsibleResolutionSchema)
      .default([]),
    commissionBeneficiaryResolutions: z
      .array(SaleJsonImportCommissionBeneficiaryResolutionSchema)
      .default([]),
  });

const SuggestedEntitySchema = z
  .object({
    type: z.string(),
    id: z.uuid(),
    label: z.string(),
    email: z.string().nullable().optional(),
  })
  .strict();

const SaleJsonImportGroupSuggestionSchema = z
  .object({
    companyId: z.uuid().optional(),
    companyName: z.string().optional(),
    unitId: z.uuid().optional(),
    unitName: z.string().optional(),
    sellerId: z.uuid().optional(),
    sellerName: z.string().optional(),
    sellerEmail: z.string().optional(),
  })
  .strict();

export const SaleJsonImportPreviewResponseSchema = z
  .object({
    totalRows: z.number().int().min(0),
    validRows: z.number().int().min(0),
    invalidRows: z.number().int().min(0),
    hasCommissions: z.boolean(),
    unitGroups: z.array(
      z
        .object({
          key: z.string(),
          name: z.string(),
          suggestions: z.array(SaleJsonImportGroupSuggestionSchema),
        })
        .strict(),
    ),
    responsibleGroups: z.array(
      z
        .object({
          key: z.string(),
          name: z.string().nullable(),
          email: z.string().nullable(),
          unitName: z.string().nullable(),
          suggestions: z.array(SaleJsonImportGroupSuggestionSchema),
        })
        .strict(),
    ),
    commissionBeneficiaryGroups: z.array(
      z
        .object({
          key: z.string(),
          section: z.enum(["unidade", "vendedor", "terceiros"]),
          externalType: z.string().nullable(),
          externalId: z.string().nullable(),
          name: z.string().nullable(),
          email: z.string().nullable(),
          suggestions: z.array(SuggestedEntitySchema),
        })
        .strict(),
    ),
    rows: z.array(
      z
        .object({
          rowNumber: z.number().int().min(1),
          isValid: z.boolean(),
          errors: z.array(z.string()),
          saleDate: SaleDateInputSchema.nullable(),
          status: z.string().nullable(),
          totalAmount: z.number().int().nullable(),
          customerDocument: z.string().nullable(),
          productId: z.uuid().nullable(),
          unitGroupKey: z.string().nullable(),
          responsibleGroupKey: z.string().nullable(),
          commissionBeneficiaryKeys: z.array(z.string()),
        })
        .strict(),
    ),
  })
  .strict();

export const SaleJsonImportFailureSchema = z
  .object({
    rowNumber: z.number().int().min(1),
    code: z.string().min(1),
    message: z.string().min(1),
  })
  .strict();

export const SaleJsonImportApplyResponseSchema = z
  .object({
    totalRows: z.number().int().min(0),
    importedRows: z.number().int().min(0),
    failedRows: z.number().int().min(0),
    createdSaleIds: z.array(z.uuid()),
    failures: z.array(SaleJsonImportFailureSchema),
  })
  .strict();

export type SaleJsonImportPreviewBody = z.infer<
  typeof SaleJsonImportPreviewBodySchema
>;
export type SaleJsonImportApplyBody = z.infer<
  typeof SaleJsonImportApplyBodySchema
>;
export type SaleJsonImportCota = z.infer<typeof SaleJsonImportCotaSchema>;
