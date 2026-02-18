import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import { BadRequestError } from "../_errors/bad-request-error";
import { CustomerDocumentType, CustomerPersonType } from "generated/prisma/enums";

export async function getCustomer(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .get("/organizations/:slug/customers/customerId", {
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
              pf: z.object({
                birthDate: z.date().nullable(),
                monthlyIncome: z.number().nullable(),
                profession: z.string().nullable(),
                placeOfBirth: z.string().nullable(),
                fatherName: z.string().nullable(),
                motherName: z.string().nullable(),
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
          })
        }
      }
    },
      async (request) => {
        const { slug, customerId } = request.params

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

        const customer = await prisma.customer.findUnique({
          where: {
            id: customerId,
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
            customerPF: {
              select: {
                birthDate: true,
                monthlyIncome: true,
                profession: true,
                placeOfBirth: true,
                fatherName: true,
                motherName: true,
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

        if (!customer) {
          throw new BadRequestError("Customer not found")
        }

        const isPF = customer.personType === CustomerPersonType.PF
        const isPJ = customer.personType === CustomerPersonType.PJ

        const result = {
          id: customer.id,
          name: customer.name,
          personType: customer.personType,
          email: customer.email,
          phone: customer.phone,
          documentType: customer.documentType,
          documentNumber: customer.documentNumber,

          pf: isPF
            ? customer.customerPF && {
              birthDate: customer.customerPF.birthDate,
              monthlyIncome: customer.customerPF.monthlyIncome,
              profession: customer.customerPF.profession,
              placeOfBirth: customer.customerPF.placeOfBirth,
              fatherName: customer.customerPF.fatherName,
              motherName: customer.customerPF.motherName,
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

        return { customer: result }
      }
    )
}