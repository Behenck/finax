import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { Prisma } from "generated/prisma/client";
import {
  CustomerDocumentType,
  CustomerPersonType,
  CustomerStatus,
  MemberDataScope,
  SaleStatus,
} from "generated/prisma/enums";
import z from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import {
  buildCustomersVisibilityWhere,
  buildSalesVisibilityWhere,
  loadMemberDataVisibilityContext,
} from "@/permissions/data-visibility";
import { BadRequestError } from "../_errors/bad-request-error";
import {
  customerResponsibleTypeValues,
  loadCustomerResponsible,
} from "./customer-responsible";
import {
  loadOpenSaleDelinquenciesBySaleIds,
  loadSaleDelinquencySummaryBySaleIds,
} from "../sales/sale-delinquencies";
import { loadSalesResponsible } from "../sales/sale-responsible";
import { SaleResponsiblePayloadSchema } from "../sales/sale-schemas";

export async function getCustomer(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .get(
      "/organizations/:slug/customers/:customerId",
      {
        schema: {
          tags: ["customers"],
          summary: "Get customer",
          security: [{ bearerAuth: [] }],
          params: z.object({
            slug: z.string(),
            customerId: z.uuid(),
          }),
          response: {
            200: z.object({
              customer: z.object({
                id: z.uuid(),
                name: z.string(),
                personType: z.enum(CustomerPersonType),
                phone: z.string().nullable(),
                email: z.string().nullable(),
                documentType: z.enum(CustomerDocumentType),
                documentNumber: z.string(),
                status: z.enum(CustomerStatus),
                responsible: z
                  .object({
                    type: z.enum(customerResponsibleTypeValues),
                    id: z.uuid(),
                    name: z.string(),
                  })
                  .nullable(),
                pf: z
                  .object({
                    birthDate: z.date().nullable(),
                    monthlyIncome: z.number().nullable(),
                    profession: z.string().nullable(),
                    placeOfBirth: z.string().nullable(),
                    fatherName: z.string().nullable(),
                    motherName: z.string().nullable(),
                    naturality: z.string().nullable(),
                  })
                  .nullable(),
                pj: z
                  .object({
                    businessActivity: z.string().nullable(),
                    municipalRegistration: z.string().nullable(),
                    stateRegistration: z.string().nullable(),
                    legalName: z.string().nullable(),
                    tradeName: z.string().nullable(),
                    foundationDate: z.date().nullable(),
                  })
                  .nullable(),
                sales: z.array(
                  z.object({
                    id: z.uuid(),
                    saleDate: z.date(),
                    totalAmount: z.number().int(),
                    status: z.enum(SaleStatus),
                    createdAt: z.date(),
                    updatedAt: z.date(),
                    product: z.object({
                      id: z.uuid(),
                      name: z.string(),
                    }),
                    company: z.object({
                      id: z.uuid(),
                      name: z.string(),
                    }),
                    unit: z
                      .object({
                        id: z.uuid(),
                        name: z.string(),
                      })
                      .nullable(),
                    responsible: SaleResponsiblePayloadSchema.nullable(),
                    delinquencySummary: z.object({
                      hasOpen: z.boolean(),
                      openCount: z.number().int().nonnegative(),
                      oldestDueDate: z.date().nullable(),
                      latestDueDate: z.date().nullable(),
                    }),
                    openDelinquencies: z.array(
                      z.object({
                        id: z.uuid(),
                        dueDate: z.date(),
                        resolvedAt: z.date().nullable(),
                        createdAt: z.date(),
                        updatedAt: z.date(),
                        createdBy: z.object({
                          id: z.uuid(),
                          name: z.string().nullable(),
                          avatarUrl: z.string().nullable(),
                        }),
                        resolvedBy: z
                          .object({
                            id: z.uuid(),
                            name: z.string().nullable(),
                            avatarUrl: z.string().nullable(),
                          })
                          .nullable(),
                      }),
                    ),
                  }),
                ),
              }),
            }),
          },
        },
      },
      async (request) => {
        const { slug, customerId } = request.params;

        const { organization, membership } =
          await request.getUserMembership(slug);
        const canViewAllCustomers = await request.hasPermission(
          slug,
          "registers.customers.view.all",
        );
        const canViewSales = await request.hasPermission(slug, "sales.view");
        const canViewAllSales = canViewSales
          ? await request.hasPermission(slug, "sales.view.all")
          : false;
        const visibilityContext = await loadMemberDataVisibilityContext({
          organizationId: organization.id,
          memberId: membership.id,
          userId: membership.userId,
          role: membership.role,
          customersScope: canViewAllCustomers
            ? MemberDataScope.ORGANIZATION_ALL
            : MemberDataScope.LINKED_ONLY,
          salesScope: canViewAllSales
            ? MemberDataScope.ORGANIZATION_ALL
            : membership.salesScope,
          commissionsScope: membership.commissionsScope,
        });
        const customersVisibilityWhere = buildCustomersVisibilityWhere({
          organizationId: organization.id,
          context: visibilityContext,
        });
        const customerWhere: Prisma.CustomerWhereInput =
          customersVisibilityWhere
            ? {
                AND: [
                  {
                    id: customerId,
                    organizationId: organization.id,
                  },
                  customersVisibilityWhere,
                ],
              }
            : {
                id: customerId,
                organizationId: organization.id,
              };

        const customer = await prisma.customer.findFirst({
          where: customerWhere,
          select: {
            id: true,
            name: true,
            personType: true,
            email: true,
            phone: true,
            documentType: true,
            documentNumber: true,
            status: true,
            responsibleType: true,
            responsibleId: true,
            customerPF: {
              select: {
                birthDate: true,
                monthlyIncome: true,
                profession: true,
                placeOfBirth: true,
                fatherName: true,
                motherName: true,
                naturality: true,
              },
            },
            customerPJ: {
              select: {
                businessActivity: true,
                municipalRegistration: true,
                stateRegistration: true,
                legalName: true,
                tradeName: true,
                foundationDate: true,
              },
            },
          },
        });

        if (!customer) {
          throw new BadRequestError("Customer not found");
        }

        const isPF = customer.personType === CustomerPersonType.PF;
        const isPJ = customer.personType === CustomerPersonType.PJ;
        const responsible = await loadCustomerResponsible(
          organization.id,
          customer,
        );
        const salesVisibilityWhere = canViewSales
          ? buildSalesVisibilityWhere(visibilityContext)
          : undefined;
        const customerSales = canViewSales
          ? await prisma.sale.findMany({
              where: salesVisibilityWhere
                ? {
                    AND: [
                      {
                        organizationId: organization.id,
                        customerId: customer.id,
                      },
                      salesVisibilityWhere,
                    ],
                  }
                : {
                    organizationId: organization.id,
                    customerId: customer.id,
                  },
              orderBy: [{ saleDate: "desc" }, { createdAt: "desc" }],
              select: {
                id: true,
                saleDate: true,
                totalAmount: true,
                status: true,
                createdAt: true,
                updatedAt: true,
                responsibleType: true,
                responsibleId: true,
                responsibleLabel: true,
                product: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
                company: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
                unit: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            })
          : [];
        const customerSaleIds = customerSales.map((sale) => sale.id);
        const [
          responsibleBySaleId,
          delinquencySummaryBySaleId,
          openDelinquenciesBySaleId,
        ] = await Promise.all([
          loadSalesResponsible(organization.id, customerSales),
          loadSaleDelinquencySummaryBySaleIds(
            prisma,
            organization.id,
            customerSaleIds,
          ),
          loadOpenSaleDelinquenciesBySaleIds(
            prisma,
            organization.id,
            customerSaleIds,
          ),
        ]);

        const result = {
          id: customer.id,
          name: customer.name,
          personType: customer.personType,
          email: customer.email,
          phone: customer.phone,
          documentType: customer.documentType,
          documentNumber: customer.documentNumber,
          status: customer.status,
          responsible,

          pf: isPF
            ? customer.customerPF && {
                birthDate: customer.customerPF.birthDate,
                monthlyIncome: customer.customerPF.monthlyIncome,
                profession: customer.customerPF.profession,
                placeOfBirth: customer.customerPF.placeOfBirth,
                fatherName: customer.customerPF.fatherName,
                motherName: customer.customerPF.motherName,
                naturality: customer.customerPF.naturality,
              }
            : null,

          pj: isPJ
            ? customer.customerPJ && {
                businessActivity: customer.customerPJ.businessActivity,
                municipalRegistration:
                  customer.customerPJ.municipalRegistration,
                stateRegistration: customer.customerPJ.stateRegistration,
                legalName: customer.customerPJ.legalName,
                tradeName: customer.customerPJ.tradeName,
                foundationDate: customer.customerPJ.foundationDate,
              }
            : null,
          sales: customerSales.map((sale) => ({
            id: sale.id,
            saleDate: sale.saleDate,
            totalAmount: sale.totalAmount,
            status: sale.status,
            createdAt: sale.createdAt,
            updatedAt: sale.updatedAt,
            product: sale.product,
            company: sale.company,
            unit: sale.unit,
            responsible: responsibleBySaleId.get(sale.id) ?? null,
            delinquencySummary: delinquencySummaryBySaleId.get(sale.id) ?? {
              hasOpen: false,
              openCount: 0,
              oldestDueDate: null,
              latestDueDate: null,
            },
            openDelinquencies: openDelinquenciesBySaleId.get(sale.id) ?? [],
          })),
        };

        return { customer: result };
      },
    );
}
