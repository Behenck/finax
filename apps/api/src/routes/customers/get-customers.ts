import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import { BadRequestError } from "../_errors/bad-request-error";
import { CustomerDocumentType, CustomerPersonType, CustomerStatus } from "generated/prisma/enums";

export async function getCustomers(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .get("/organizations/:slug/customers", {
      schema: {
        tags: ["customers"],
        summary: "Get customers",
        security: [{ bearerAuth: [] }],
        params: z.object({
          slug: z.string(),
        }),
        response: {
          200: z.object({
            customers: z.array(
              z.object({
                id: z.uuid(),
                name: z.string(),
                personType: z.enum(CustomerPersonType),
                phone: z.string().nullable(),
                email: z.string().nullable(),
                documentType: z.enum(CustomerDocumentType),
                documentNumber: z.string(),
                status: z.enum(CustomerStatus),
                pf: z.object({
                  birthDate: z.date().nullable(),
                  monthlyIncome: z.number().nullable(),
                  profession: z.string().nullable(),
                  placeOfBirth: z.string().nullable(),
                  fatherName: z.string().nullable(),
                  motherName: z.string().nullable(),
                  naturality: z.string().nullable(),
                }).nullable(),
                pj: z.object({
                  businessActivity: z.string().nullable(),
                  municipalRegistration: z.string().nullable(),
                  stateRegistration: z.string().nullable(),
                  legalName: z.string().nullable(),
                  tradeName: z.string().nullable(),
                  foundationDate: z.date().nullable(),
                }).nullable()
              }),
            )
          })
        }
      }
    },
      async (request) => {
        const { slug } = request.params

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

        const customers = await prisma.customer.findMany({
          where: {
            organizationId: organization.id
          },
          select: {
            id: true,
            name: true,
            personType: true,
            email: true,
            phone: true,
            documentType: true,
            documentNumber: true,
            status: true,
            customerPF: {
              select: {
                birthDate: true,
                monthlyIncome: true,
                profession: true,
                placeOfBirth: true,
                fatherName: true,
                motherName: true,
                naturality: true,
              }
            },
            customerPJ: {
              select: {
                businessActivity: true,
                municipalRegistration: true,
                stateRegistration: true,
                legalName: true,
                tradeName: true,
                foundationDate: true,
              }
            }
          }
        })

        const result = customers.map((customer) => {
          const isPF = customer.personType === CustomerPersonType.PF
          const isPJ = customer.personType === CustomerPersonType.PJ

          return {
            id: customer.id,
            name: customer.name,
            personType: customer.personType,
            email: customer.email,
            phone: customer.phone,
            documentType: customer.documentType,
            documentNumber: customer.documentNumber,
            status: customer.status,

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
                municipalRegistration: customer.customerPJ.municipalRegistration,
                stateRegistration: customer.customerPJ.stateRegistration,
                legalName: customer.customerPJ.legalName,
                tradeName: customer.customerPJ.tradeName,
                foundationDate: customer.customerPJ.foundationDate,
              }
              : null,
          }
        })

        return { customers: result }
      }
    )
}