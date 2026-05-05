import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { Prisma } from "generated/prisma/client";
import {
  CustomerDocumentType,
  CustomerPersonType,
  CustomerStatus,
} from "generated/prisma/enums";
import z from "zod";
import { db } from "@/lib/db";
import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import { BadRequestError } from "../_errors/bad-request-error";
import {
  loadProductSaleFieldSchema,
  normalizeSaleDynamicFieldValues,
} from "./sale-dynamic-fields";
import {
  createSaleCreatedHistoryEvent,
  loadSaleHistorySnapshot,
} from "./sale-history";
import { assertRateLimit, saleImportRateLimit } from "./sale-import-rate-limit";
import {
  type PostSaleImportBody,
  PostSaleImportBodySchema,
  PostSaleImportResponseSchema,
  type SaleImportFailure,
} from "./sale-import-schemas";
import {
  assertImportFixedValuesBelongToOrganization,
  assertTemplateMappingBelongsToOrganization,
} from "./sale-import-template-utils";
import {
  assertImportRowsSecurity,
  buildProductResolver,
  isValidCnpj,
  isValidCpf,
  mapDynamicColumnsByFieldId,
  mapDynamicImportRawValue,
  normalizeDocumentDigits,
  normalizeEmail,
  normalizePhoneDigits,
  parseImportAmountToCents,
  parseImportSaleDate,
  sanitizeTextValue,
} from "./sale-import-utils";
import { resolveSaleResponsibleData } from "./sale-responsible";
import { parseSaleDateInput } from "./sale-schemas";

type ParsedCustomerDocument = {
  personType: CustomerPersonType;
  documentType: CustomerDocumentType;
  documentNumber: string;
};

type SaleImportFailureCode =
  | "SALE_DATE_INVALID"
  | "TOTAL_AMOUNT_INVALID"
  | "PRODUCT_REQUIRED"
  | "PRODUCT_NOT_FOUND"
  | "PRODUCT_NOT_FOUND_OR_INACTIVE"
  | "PRODUCT_PATH_NOT_FOUND"
  | "PRODUCT_AMBIGUOUS"
  | "CUSTOMER_NAME_REQUIRED"
  | "CUSTOMER_DOCUMENT_REQUIRED"
  | "CUSTOMER_DOCUMENT_INVALID"
  | "CUSTOMER_DOCUMENT_INACTIVE"
  | "DATABASE_SCHEMA_OUTDATED"
  | "VALIDATION_ERROR"
  | "UNEXPECTED_ERROR";

class SaleImportRowError extends Error {
  code: SaleImportFailureCode;
  field: string | null;

  constructor(params: {
    code: SaleImportFailureCode;
    field: string | null;
    message: string;
  }) {
    super(params.message);
    this.name = "SaleImportRowError";
    this.code = params.code;
    this.field = params.field;
  }
}

function parseCustomerDocument(rawValue: unknown): ParsedCustomerDocument {
  const digits = normalizeDocumentDigits(rawValue);
  if (!digits) {
    throw new BadRequestError("Customer document is required");
  }

  if (digits.length === 11) {
    if (!isValidCpf(digits)) {
      throw new BadRequestError("Invalid CPF for customer auto-create");
    }

    return {
      personType: CustomerPersonType.PF,
      documentType: CustomerDocumentType.CPF,
      documentNumber: digits,
    };
  }

  if (digits.length === 14) {
    if (!isValidCnpj(digits)) {
      throw new BadRequestError("Invalid CNPJ for customer auto-create");
    }

    return {
      personType: CustomerPersonType.PJ,
      documentType: CustomerDocumentType.CNPJ,
      documentNumber: digits,
    };
  }

  throw new BadRequestError(
    "Customer document must be a valid CPF (11 digits) or CNPJ (14 digits)",
  );
}

function parseCustomerDocumentForImport(
  rawValue: unknown,
  columnKey: string,
): ParsedCustomerDocument {
  try {
    return parseCustomerDocument(rawValue);
  } catch (error) {
    if (!(error instanceof BadRequestError)) {
      throw error;
    }

    if (error.message === "Customer document is required") {
      throw new SaleImportRowError({
        code: "CUSTOMER_DOCUMENT_REQUIRED",
        field: columnKey,
        message: error.message,
      });
    }

    if (
      error.message === "Invalid CPF for customer auto-create" ||
      error.message === "Invalid CNPJ for customer auto-create" ||
      error.message ===
        "Customer document must be a valid CPF (11 digits) or CNPJ (14 digits)"
    ) {
      throw new SaleImportRowError({
        code: "CUSTOMER_DOCUMENT_INVALID",
        field: columnKey,
        message: error.message,
      });
    }

    throw error;
  }
}

function buildFailure(rowNumber: number, error: unknown): SaleImportFailure {
  if (error instanceof SaleImportRowError) {
    return {
      rowNumber,
      code: error.code,
      message: error.message || "Invalid row payload",
      field: error.field,
    };
  }

  if (error instanceof BadRequestError) {
    return {
      rowNumber,
      code: "VALIDATION_ERROR",
      message: error.message || "Invalid row payload",
      field: null,
    };
  }

  if (error instanceof Error) {
    return {
      rowNumber,
      code: "UNEXPECTED_ERROR",
      message: error.message || "Unexpected import error",
      field: null,
    };
  }

  return {
    rowNumber,
    code: "UNEXPECTED_ERROR",
    message: "Unexpected import error",
    field: null,
  };
}

function normalizeImportPersistenceError(params: {
  error: unknown;
  hasFixedResponsible: boolean;
}): unknown {
  const { error, hasFixedResponsible } = params;

  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return error;
  }

  if (error.code === "P2011") {
    const message = hasFixedResponsible
      ? "Database structure is outdated (null constraint). Run pending migrations and try again."
      : "Database structure is outdated for import without responsible. Run pending migrations and try again.";

    return new SaleImportRowError({
      code: "DATABASE_SCHEMA_OUTDATED",
      field: null,
      message,
    });
  }

  if (error.code === "P2021" || error.code === "P2022") {
    const target =
      typeof error.meta?.table === "string"
        ? error.meta.table
        : typeof error.meta?.column === "string"
          ? error.meta.column
          : "required database structure";

    return new SaleImportRowError({
      code: "DATABASE_SCHEMA_OUTDATED",
      field: null,
      message: `Database structure is outdated (${target}). Run pending migrations and try again.`,
    });
  }

  return error;
}

async function resolveImportResponsibleData(params: {
  organizationId: string;
  responsible: PostSaleImportBody["mapping"]["fixedValues"]["responsible"];
}) {
  if (!params.responsible) {
    return {
      responsibleType: null,
      responsibleId: null,
      responsibleLabel: null,
    };
  }

  return resolveSaleResponsibleData(params.organizationId, params.responsible);
}

async function resolveCustomerIdForImport(
  tx: Prisma.TransactionClient,
  params: {
    organizationId: string;
    customerName: string;
    customerDocument: ParsedCustomerDocument;
    customerEmail: string | null;
    customerPhone: string | null;
  },
) {
  const existingCustomer = await tx.customer.findFirst({
    where: {
      organizationId: params.organizationId,
      documentType: params.customerDocument.documentType,
      documentNumber: params.customerDocument.documentNumber,
    },
    select: {
      id: true,
      status: true,
    },
  });

  if (existingCustomer) {
    if (existingCustomer.status !== CustomerStatus.ACTIVE) {
      throw new BadRequestError(
        "Customer found by document is inactive and cannot be used",
      );
    }

    return existingCustomer.id;
  }

  const createdCustomer = await tx.customer.create({
    data: {
      organizationId: params.organizationId,
      name: params.customerName,
      personType: params.customerDocument.personType,
      documentType: params.customerDocument.documentType,
      documentNumber: params.customerDocument.documentNumber,
      email: params.customerEmail,
      phone: params.customerPhone,
      status: CustomerStatus.ACTIVE,
    },
    select: {
      id: true,
    },
  });

  return createdCustomer.id;
}

export async function postSalesImport(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .post(
      "/organizations/:slug/sales/imports",
      {
        schema: {
          tags: ["sales"],
          summary: "Import sales from normalized spreadsheet payload",
          security: [{ bearerAuth: [] }],
          params: z.object({
            slug: z.string(),
          }),
          body: PostSaleImportBodySchema,
          response: {
            200: PostSaleImportResponseSchema,
          },
        },
      },
      async (request) => {
        const { slug } = request.params;
        const data = request.body as PostSaleImportBody;
        const actorId = await request.getCurrentUserId();
        const { organization } = await request.getUserMembership(slug);

        assertRateLimit(
          `${organization.id}:${actorId}:sale-imports:execute`,
          saleImportRateLimit.imports,
        );

        assertImportRowsSecurity(data.rows);

        if (data.templateId) {
          const template = await prisma.saleImportTemplate.findFirst({
            where: {
              id: data.templateId,
              organizationId: organization.id,
            },
            select: {
              id: true,
            },
          });

          if (!template) {
            throw new BadRequestError("Sale import template not found");
          }
        }

        await assertImportFixedValuesBelongToOrganization(
          organization.id,
          data.mapping.fixedValues,
        );
        await assertTemplateMappingBelongsToOrganization(organization.id, {
          mapping: {
            fields: data.mapping.fields,
            dynamicByProduct: data.mapping.dynamicByProduct,
          },
          selectedProductId: data.mapping.fixedValues.parentProductId,
          allowUnavailableDynamicFields: true,
        });

        const responsibleData = await resolveImportResponsibleData({
          organizationId: organization.id,
          responsible: data.mapping.fixedValues.responsible,
        });

        const activeProducts = await prisma.product.findMany({
          where: {
            organizationId: organization.id,
            isActive: true,
          },
          select: {
            id: true,
            name: true,
            parentId: true,
            isActive: true,
          },
        });

        const selectedImportProductId =
          data.mapping.fixedValues.parentProductId;
        const productResolver = buildProductResolver(activeProducts, {
          parentProductId: selectedImportProductId,
        });
        const dynamicColumnsByProduct = mapDynamicColumnsByFieldId(
          data.mapping.dynamicByProduct,
        );
        const dynamicSchemaCache = new Map<
          string,
          Awaited<ReturnType<typeof loadProductSaleFieldSchema>>
        >();
        const customerIdByDocument = new Map<string, string>();

        const createdSaleIds: string[] = [];
        const failures: SaleImportFailure[] = [];

        for (const [rowIndex, row] of data.rows.entries()) {
          const rowNumber = rowIndex + 1;

          try {
            const saleDateInput = parseImportSaleDate(
              row[data.mapping.fields.saleDateColumn],
            );
            if (!saleDateInput) {
              throw new SaleImportRowError({
                code: "SALE_DATE_INVALID",
                field: data.mapping.fields.saleDateColumn,
                message: "Sale date is invalid",
              });
            }

            const totalAmount = parseImportAmountToCents(
              row[data.mapping.fields.totalAmountColumn],
            );
            if (!totalAmount || totalAmount <= 0) {
              throw new SaleImportRowError({
                code: "TOTAL_AMOUNT_INVALID",
                field: data.mapping.fields.totalAmountColumn,
                message: "Total amount must be a positive value",
              });
            }

            const productRawValue = data.mapping.fields.productColumn
              ? row[data.mapping.fields.productColumn]
              : undefined;
            const productResolution = productResolver.resolve(productRawValue);
            if (!productResolution.ok) {
              throw new SaleImportRowError({
                code: productResolution.code,
                field: data.mapping.fields.productColumn ?? null,
                message: productResolution.message,
              });
            }

            const customerName = sanitizeTextValue(
              row[data.mapping.fields.customerNameColumn],
              {
                maxLength: 255,
              },
            );
            if (!customerName) {
              throw new SaleImportRowError({
                code: "CUSTOMER_NAME_REQUIRED",
                field: data.mapping.fields.customerNameColumn,
                message: "Customer name is required",
              });
            }

            const customerDocument = parseCustomerDocumentForImport(
              row[data.mapping.fields.customerDocumentColumn],
              data.mapping.fields.customerDocumentColumn,
            );
            const customerCacheKey = `${customerDocument.documentType}:${customerDocument.documentNumber}`;
            const customerEmail = data.mapping.fields.customerEmailColumn
              ? normalizeEmail(row[data.mapping.fields.customerEmailColumn])
              : null;
            const customerPhone = data.mapping.fields.customerPhoneColumn
              ? normalizePhoneDigits(
                  row[data.mapping.fields.customerPhoneColumn],
                )
              : null;

            let dynamicSchema = dynamicSchemaCache.get(
              productResolution.productId,
            );
            if (!dynamicSchema) {
              dynamicSchema = await loadProductSaleFieldSchema(
                prisma,
                productResolution.productId,
              );
              dynamicSchemaCache.set(
                productResolution.productId,
                dynamicSchema,
              );
            }

            const dynamicColumnsByFieldId =
              dynamicColumnsByProduct.get(productResolution.productId) ??
              dynamicColumnsByProduct.get(selectedImportProductId) ??
              new Map();
            const dynamicInput: Record<string, unknown> = {};

            for (const field of dynamicSchema) {
              const mappedColumn = dynamicColumnsByFieldId.get(field.fieldId);
              if (!mappedColumn) {
                continue;
              }

              const rawValue = row[mappedColumn];
              dynamicInput[field.fieldId] = mapDynamicImportRawValue(
                field,
                rawValue,
              );
            }

            const normalizedDynamicValues = normalizeSaleDynamicFieldValues({
              schema: dynamicSchema,
              input: dynamicInput,
            });

            const notes = data.mapping.fields.notesColumn
              ? sanitizeTextValue(row[data.mapping.fields.notesColumn], {
                  maxLength: 500,
                })
              : null;

            const sale = await db(() =>
              prisma.$transaction(async (tx) => {
                let customerId = customerIdByDocument.get(customerCacheKey);

                if (!customerId) {
                  try {
                    customerId = await resolveCustomerIdForImport(tx, {
                      organizationId: organization.id,
                      customerName,
                      customerDocument,
                      customerEmail,
                      customerPhone,
                    });
                  } catch (error) {
                    if (
                      error instanceof BadRequestError &&
                      error.message.includes(
                        "Customer found by document is inactive",
                      )
                    ) {
                      throw new SaleImportRowError({
                        code: "CUSTOMER_DOCUMENT_INACTIVE",
                        field: data.mapping.fields.customerDocumentColumn,
                        message: error.message,
                      });
                    }

                    throw error;
                  }
                  customerIdByDocument.set(customerCacheKey, customerId);
                }

                const createdSale = await tx.sale.create({
                  data: {
                    organizationId: organization.id,
                    companyId: data.mapping.fixedValues.companyId,
                    unitId: data.mapping.fixedValues.unitId,
                    customerId,
                    productId: productResolution.productId,
                    saleDate: parseSaleDateInput(saleDateInput),
                    totalAmount,
                    notes,
                    dynamicFieldSchema:
                      dynamicSchema as unknown as Prisma.InputJsonValue,
                    dynamicFieldValues:
                      normalizedDynamicValues as unknown as Prisma.InputJsonValue,
                    createdById: actorId,
                    ...responsibleData,
                  },
                });

                const snapshot = await loadSaleHistorySnapshot(
                  tx,
                  createdSale.id,
                  organization.id,
                );

                if (!snapshot) {
                  throw new BadRequestError("Sale not found");
                }

                await createSaleCreatedHistoryEvent(tx, {
                  saleId: createdSale.id,
                  organizationId: organization.id,
                  actorId,
                  snapshot,
                });

                return createdSale;
              }),
            );

            createdSaleIds.push(sale.id);
          } catch (error) {
            const normalizedError = normalizeImportPersistenceError({
              error,
              hasFixedResponsible: Boolean(
                data.mapping.fixedValues.responsible,
              ),
            });
            failures.push(buildFailure(rowNumber, normalizedError));
          }
        }

        const importedRows = createdSaleIds.length;
        const failedRows = failures.length;
        const totalRows = data.rows.length;

        await db(() =>
          prisma.saleImportAudit.create({
            data: {
              organizationId: organization.id,
              actorId,
              templateId: data.templateId,
              fileType: data.fileType,
              headerSignature: data.headerSignature,
              totalRows,
              importedRows,
              failedRows,
            },
          }),
        );

        return {
          totalRows,
          importedRows,
          failedRows,
          createdSaleIds,
          failures,
        };
      },
    );
}
