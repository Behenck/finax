import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import { BadRequestError } from "../_errors/bad-request-error";
import { SellerDocumentType, SellerStatus } from "generated/prisma/enums";

export async function getSellers(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .get("/organizations/:slug/sellers", {
      schema: {
        tags: ["sellers"],
        summary: "Get sellers",
        security: [{ bearerAuth: [] }],
        params: z.object({
          slug: z.string(),
        }),
        response: {
          200: z.object({
            sellers: z.array(
              z.object({
                id: z.uuid(),
                name: z.string(),
                email: z.string().nullable(),
                phone: z.string(),
                companyName: z.string(),
                documentType: z.enum(SellerDocumentType).nullable(),
                document: z.string().nullable(),
                country: z.string(),
                state: z.string(),
                city: z.string().nullable(),
                street: z.string().nullable(),
                zipCode: z.string().nullable(),
                neighborhood: z.string().nullable(),
                number: z.string().nullable(),
                complement: z.string().nullable(),
                organization: z.object({
                  slug: z.string()
                }),
                status: z.enum(SellerStatus),
                user: z.object({
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

        const sellers = await prisma.seller.findMany({
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
            organization: {
              select: {
                slug: true,
              }
            },
            status: true,
            user: {
              select: {
                id: true,
                name: true,
              }
            },
          }
        })

        return { sellers }
      }
    )
}
