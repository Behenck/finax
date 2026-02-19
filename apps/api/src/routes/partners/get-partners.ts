import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import { BadRequestError } from "../_errors/bad-request-error";
import { PartnerDocumentType, PartnerStatus } from "generated/prisma/enums";

export async function getPartners(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .get("/organizations/:slug/partners", {
      schema: {
        tags: ["partners"],
        summary: "Get partners",
        security: [{ bearerAuth: [] }],
        params: z.object({
          slug: z.string(),
        }),
        response: {
          200: z.object({
            partners: z.array(
              z.object({
                id: z.uuid(),
                name: z.string(),
                email: z.string(),
                phone: z.string(),
                companyName: z.string(),
                documentType: z.enum(PartnerDocumentType),
                document: z.string(),
                country: z.string(),
                state: z.string(),
                city: z.string().nullable(),
                street: z.string().nullable(),
                zipCode: z.string().nullable(),
                neighborhood: z.string().nullable(),
                number: z.string().nullable(),
                complement: z.string().nullable(),
                status: z.enum(PartnerStatus),
                user: z.object({
                  id: z.uuid(),
                  name: z.string().nullable(),
                }).nullable(),
                supervisor: z.object({
                  id: z.uuid(),
                  name: z.string().nullable(),
                }).nullable(),
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

        const partners = await prisma.partner.findMany({
          where: {
            organizationId: organization.id
          },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            companyName: true,
            documentType: true,
            document: true,
            country: true,
            state: true,
            city: true,
            street: true,
            zipCode: true,
            neighborhood: true,
            number: true,
            complement: true,
            status: true,
            user: {
              select: {
                id: true,
                name: true,
              }
            },
            supervisor: {
              select: {
                id: true,
                name: true,
              }
            }
          }
        })

        return { partners }
      }
    )
}