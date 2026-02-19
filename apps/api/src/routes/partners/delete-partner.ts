import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import { BadRequestError } from "../_errors/bad-request-error";
import { db } from "@/lib/db";

export async function deletePartner(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .delete("/organizations/:slug/partners/:partnerId", {
      schema: {
        tags: ["partners"],
        summary: "Delete partner",
        security: [{ bearerAuth: [] }],
        params: z.object({
          slug: z.string(),
          partnerId: z.uuid(),
        }),
        response: {
          204: z.null()
        }
      }
    },
      async (request, reply) => {
        const { slug, partnerId } = request.params

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

        const partner = await prisma.partner.findFirst({
          where: {
            id: partnerId,
            organizationId: organization.id
          },
        })

        if (!partner) {
          throw new BadRequestError("Partner not found")
        }

        await db(() => prisma.partner.delete({
          where: {
            id: partnerId,
          }
        })
        )

        return reply.status(204).send()
      }
    )
}