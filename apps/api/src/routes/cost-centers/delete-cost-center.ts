import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import { BadRequestError } from "../_errors/bad-request-error";
import { db } from "@/lib/db";

export async function deleteCostCenter(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .delete("/organizations/:slug/costCenters/:costCenterId", {
      schema: {
        tags: ["costCenters"],
        summary: "Delete cost center",
        security: [{ bearerAuth: [] }],
        params: z.object({
          slug: z.string(),
          costCenterId: z.uuid(),
        }),
        response: {
          204: z.null()
        }
      }
    },
      async (request, reply) => {
        const { slug, costCenterId } = request.params

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

        const costCenter = await prisma.costCenter.findFirst({
          where: {
            id: costCenterId,
            organizationId: organization.id
          }
        })

        if (!costCenter) {
          throw new BadRequestError("Cost Center not found")
        }

        await db(() => prisma.costCenter.delete({
          where: {
            id: costCenterId
          }
        })
        )

        return reply.status(204).send()
      }
    )
}