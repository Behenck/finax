import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import { BadRequestError } from "../_errors/bad-request-error";
import { db } from "@/lib/db";

export async function deleteSeller(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .delete("/organizations/:slug/sellers/:sellerId", {
      schema: {
        tags: ["sellers"],
        summary: "Delete seller",
        security: [{ bearerAuth: [] }],
        params: z.object({
          slug: z.string(),
          sellerId: z.uuid(),
        }),
        response: {
          204: z.null()
        }
      }
    },
      async (request, reply) => {
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
        })

        if (!seller) {
          throw new BadRequestError("Seller not found")
        }

        await db(() => prisma.seller.delete({
          where: {
            id: sellerId,
          }
        })
        )

        return reply.status(204).send()
      }
    )
}