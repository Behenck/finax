import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import { BadRequestError } from "../_errors/bad-request-error";
import { SellerDocumentType, SellerStatus } from "generated/prisma/enums";

export async function getSeller(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .get("/organizations/:slug/sellers/:sellerId", {
      schema: {
        tags: ["sellers"],
        summary: "Get seller",
        security: [{ bearerAuth: [] }],
        params: z.object({
          slug: z.string(),
          sellerId: z.uuid(),
        }),
        response: {
          200: z.object({
            seller: z.object({
              id: z.uuid(),
              name: z.string(),
              email: z.string().nullable(),
              phone: z.string().nullable(),
              companyName: z.string().nullable(),
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
          })
        }
      }
    },
      async (request) => {
        const { slug, sellerId } = request.params

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

        const seller = await prisma.seller.findFirst({
          where: {
            id: sellerId,
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
            organization: {
              select: {
                slug: true
              }
            },
            user: {
              select: {
                id: true,
                name: true,
              }
            },
          }
        })

        if (!seller) {
          throw new BadRequestError("Seller not found")
        }

        return { seller }
      }
    )
}
