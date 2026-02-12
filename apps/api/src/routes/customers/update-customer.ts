import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import { BadRequestError } from "../_errors/bad-request-error";
import { db } from "@/lib/db";
import { CustomerDocumentType, CustomerPersonType } from "generated/prisma/enums";
import { hasAnyValue } from "@/utils/has-any-value";

export async function updateCustomer(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .put("/organizations/:slug/customers/:customerId", {
      schema: {
        tags: ["customers"],
        summary: "Update customer",
        security: [{ bearerAuth: [] }],
        params: z.object({
          slug: z.string(),
          customerId: z.string(),
        }),
        body: z.object({
          name: z.string(),
          personType: z.enum(CustomerPersonType),
          phone: z.string().optional(),
          email: z.string().optional(),
          documentType: z.enum(CustomerDocumentType),
          documentNumber: z.string(),
          pf: z.object({
            birthDate: z.date().optional(),
            monthlyIncome: z.number().optional(),
            profession: z.string().optional(),
            placeOfBirth: z.string().optional(),
            fatherName: z.string().optional(),
            motherName: z.string().optional(),
          }).optional(),
          pj: z.object({
            businessActivity: z.string().optional(),
            municipalRegistration: z.string().optional(),
            stateRegistration: z.string().optional(),
            legalName: z.string().optional(),
            tradeName: z.string().optional(),
            foundationDate: z.date().optional(),
          }).optional()
        }),
        response: {
          204: z.null()
        }
      }
    },
      async (request, reply) => {
        const { slug, customerId } = request.params
        const data = request.body

        const organization = await prisma.organization.findUnique({
          where: {
            slug,
          },
          select: {
            id: true,
          },
        })

        if (!organization) {
          throw new BadRequestError("Organization not found")
        }

        const existCustomer = await prisma.customer.findFirst({
          where: {
            NOT: { id: customerId },
            organizationId: organization.id,
            documentType: data.documentType,
            documentNumber: data.documentNumber,
          },
          select: { id: true },
        })

        if (!!existCustomer) {
          throw new BadRequestError("Customer already exists")
        }

        const currentCustomer = await prisma.customer.findFirst({
          where: { id: customerId, organizationId: organization.id },
          include: { customerPF: true, customerPJ: true },
        })

        if (!currentCustomer) throw new BadRequestError("Customer not found")

        const shouldUpsertPF =
          data.personType === CustomerPersonType.PF && hasAnyValue(data.pf)

        const shouldUpsertPJ =
          data.personType === CustomerPersonType.PJ && hasAnyValue(data.pj)

        await db(() =>
          prisma.$transaction(async (tx) => {
            await tx.customer.update({
              where: { id: customerId },
              data: {
                name: data.name,
                personType: data.personType,
                phone: data.phone ?? null,
                email: data.email ?? null,
                documentType: data.documentType,
                documentNumber: data.documentNumber,
              },
            })

            if (data.personType === CustomerPersonType.PF) {
              if (currentCustomer.customerPJ) {
                await tx.customerPJ.delete({ where: { customerId } })
              }

              if (shouldUpsertPF) {
                await tx.customerPF.upsert({
                  where: { customerId },
                  create: {
                    customerId,
                    organizationId: organization.id,
                    birthDate: data.pf?.birthDate ?? null,
                    monthlyIncome: data.pf?.monthlyIncome ?? null,
                    profession: data.pf?.profession ?? null,
                    placeOfBirth: data.pf?.placeOfBirth ?? null,
                    fatherName: data.pf?.fatherName ?? null,
                    motherName: data.pf?.motherName ?? null,
                  },
                  update: {
                    birthDate: data.pf?.birthDate ?? null,
                    monthlyIncome: data.pf?.monthlyIncome ?? null,
                    profession: data.pf?.profession ?? null,
                    placeOfBirth: data.pf?.placeOfBirth ?? null,
                    fatherName: data.pf?.fatherName ?? null,
                    motherName: data.pf?.motherName ?? null,
                  },
                })
              }
            }

            if (data.personType === CustomerPersonType.PJ) {
              if (currentCustomer.customerPF) {
                await tx.customerPF.delete({ where: { customerId } })
              }

              if (shouldUpsertPJ) {
                await tx.customerPJ.upsert({
                  where: { customerId },
                  create: {
                    customerId,
                    organizationId: organization.id,
                    businessActivity: data.pj?.businessActivity ?? null,
                    municipalRegistration: data.pj?.municipalRegistration ?? null,
                    stateRegistration: data.pj?.stateRegistration ?? null,
                    legalName: data.pj?.legalName ?? null,
                    tradeName: data.pj?.tradeName ?? null,
                    foundationDate: data.pj?.foundationDate ?? null,
                  },
                  update: {
                    businessActivity: data.pj?.businessActivity ?? null,
                    municipalRegistration: data.pj?.municipalRegistration ?? null,
                    stateRegistration: data.pj?.stateRegistration ?? null,
                    legalName: data.pj?.legalName ?? null,
                    tradeName: data.pj?.tradeName ?? null,
                    foundationDate: data.pj?.foundationDate ?? null,
                  },
                })
              }
            }
          }),
        )

        return reply.status(204).send()
      }
    )
}