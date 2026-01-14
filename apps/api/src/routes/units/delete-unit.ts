import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import { BadRequestError } from "../_errors/bad-request-error";
import { db } from "@/lib/db";

export async function deleteUnit(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .delete("/organizations/:slug/companies/:companyId/units/:unitId", {
      schema: {
        tags: ["companies"],
        summary: "Delete unit",
        security: [{ bearerAuth: [] }],
        params: z.object({
          slug: z.string(),
          companyId: z.uuid(),
          unitId: z.uuid(),
        }),
        response: {
          204: z.null()
        }
      }
    },
      async (request, reply) => {
        const { slug, companyId, unitId } = request.params

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

        const company = await prisma.company.findFirst({
          where: {
            id: companyId,
            organizationId: organization.id
          },
          select: {
            id: true
          }
        })

        if (!company) {
          throw new BadRequestError("Company not found")
        }

        const unit = await prisma.unit.findFirst({
          where: {
            id: unitId,
            companyId,
          },
        })

        if (!unit) {
          throw new BadRequestError("Unit not found")
        }

        await db(() => prisma.unit.delete({
          where: {
            id: unitId,
          }
        })
        )

        return reply.status(204).send()
      }
    )
}