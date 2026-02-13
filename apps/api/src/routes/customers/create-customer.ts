import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import { BadRequestError } from "../_errors/bad-request-error";
import { db } from "@/lib/db";
import { CustomerDocumentType, CustomerPersonType } from "generated/prisma/enums";
import { hasAnyValue } from "@/utils/has-any-value";

export async function createCustomer(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .post("/organizations/:slug/customers", {
      schema: {
        tags: ["customers"],
        summary: "Create a new customer",
        security: [{ bearerAuth: [] }],
        params: z.object({
          slug: z.string(),
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
            monthlyIncome: z.number().int().nonnegative().default(0),
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
          201: z.object({
            customerId: z.uuid()
          })
        }
      }
    },
      async (request, reply) => {
        const { slug } = request.params
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

        const existCustomer = await prisma.customer.findUnique({
          where: {
            organizationId_documentType_documentNumber: {
              organizationId: organization.id,
              documentType: data.documentType,
              documentNumber: data.documentNumber,
            }
          }
        })

        if (!!existCustomer) {
          throw new BadRequestError("Customer already exists")
        }

        const shouldCreatePF =
          data.personType === CustomerPersonType.PF && hasAnyValue(data.pf)

        const shouldCreatePJ =
          data.personType === CustomerPersonType.PJ && hasAnyValue(data.pj)

        const customer = await db(() =>
          prisma.customer.create({
            data: {
              name: data.name,
              personType: data.personType,
              phone: data.phone,
              email: data.email,
              documentType: data.documentType,
              documentNumber: data.documentNumber,
              organizationId: organization.id,

              ...(shouldCreatePF
                ? {
                  customerPF: {
                    create: {
                      organizationId: organization.id,
                      birthDate: data.pf?.birthDate,
                      monthlyIncome: data.pf?.monthlyIncome,
                      profession: data.pf?.profession,
                      placeOfBirth: data.pf?.placeOfBirth,
                      fatherName: data.pf?.fatherName,
                      motherName: data.pf?.motherName,
                    }
                  },
                } : {}),
              ...(shouldCreatePJ
                ? {
                  customerPJ: {
                    create: {
                      organizationId: organization.id,
                      businessActivity: data.pj?.businessActivity,
                      municipalRegistration: data.pj?.municipalRegistration,
                      stateRegistration: data.pj?.stateRegistration,
                      legalName: data.pj?.legalName,
                      tradeName: data.pj?.tradeName,
                      foundationDate: data.pj?.foundationDate,
                    }
                  }
                } : {}),
            },
            include: {
              customerPF: true,
              customerPJ: true,
            },
          })
        )

        return reply.status(201).send({
          customerId: customer.id,
        })
      }
    )
}