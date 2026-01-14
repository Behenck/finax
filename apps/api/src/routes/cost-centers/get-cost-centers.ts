import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import { BadRequestError } from "../_errors/bad-request-error";

export async function getCostCenters(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .get("/organizations/:slug/costCenters", {
      schema: {
        tags: ["costCenters"],
        summary: "Get Cost Centers",
        security: [{ bearerAuth: [] }],
        params: z.object({
          slug: z.string(),
        }),
        response: {
          200: z.object({
            costCenters: z.array(
              z.object({
                id: z.uuid(),
                name: z.string(),
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

        const costCenters = await prisma.costCenter.findMany({
          where: {
            organizationId: organization.id
          },
          select: {
            id: true,
            name: true,
          }
        })

        return { costCenters }
      }
    )
}