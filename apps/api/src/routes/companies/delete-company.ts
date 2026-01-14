import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import { BadRequestError } from "../_errors/bad-request-error";
import { db } from "@/lib/db";

export async function deleteCompany(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .delete("/organizations/:slug/companies/:companyId", {
      schema: {
        tags: ["companies"],
        summary: "Delete company",
        security: [{ bearerAuth: [] }],
        params: z.object({
          slug: z.string(),
          companyId: z.uuid(),
        }),
        response: {
          204: z.null()
        }
      }
    },
      async (request, reply) => {
        const { slug, companyId } = request.params

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
          }
        })

        if (!company) {
          throw new BadRequestError("Company not found")
        }

        await db(() => prisma.company.delete({
          where: {
            id: companyId
          }
        })
        )

        return reply.status(204).send()
      }
    )
}