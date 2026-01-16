import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import { BadRequestError } from "../_errors/bad-request-error";
import { db } from "@/lib/db";

export async function updateCostCenter(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .put(
      "/organizations/:slug/costCenters/:costCenterId",
      {
        schema: {
          tags: ["costCenters"],
          summary: "Update cost center",
          security: [{ bearerAuth: [] }],
          params: z.object({
            slug: z.string(),
            costCenterId: z.uuid(),
          }),
          body: z.object({
            name: z.string(),
          }),
          response: {
            204: z.null(),
          },
        },
      },
      async (request, reply) => {
        const { slug, costCenterId } = request.params
        const { name } = request.body

        const organization = await prisma.organization.findUnique({
          where: { slug },
          select: { id: true },
        })

        if (!organization) {
          throw new BadRequestError("Organization not found")
        }

        const costCenter = await prisma.costCenter.findFirst({
          where: {
            id: costCenterId,
            organizationId: organization.id,
          },
          select: { id: true },
        })

        if (!costCenter) {
          throw new BadRequestError("Cost center not found")
        }

        await db(() =>
          prisma.costCenter.update({
            where: { id: costCenterId },
            data: { name },
          })
        )

        return reply.status(204).send()
      }
    )
}
