import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import { BadRequestError } from "../_errors/bad-request-error";
import { db } from "@/lib/db";

export async function createUnit(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .post("/organizations/:slug/companies/:companyId/units", {
      schema: {
        tags: ["units"],
        summary: "Create a new Unit",
        security: [{ bearerAuth: [] }],
        params: z.object({
          slug: z.string(),
          companyId: z.uuid(),
        }),
        body: z.object({
          name: z.string(),
        }),
        response: {
          201: z.object({
            unitId: z.uuid()
          })
        }
      }
    },
      async (request, reply) => {
        const { slug, companyId } = request.params
        const { name } = request.body

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

        const unit = await db(() =>
          prisma.unit.create({
            data: {
              name,
              companyId: company.id,
            },
          })
        )

        return reply.status(201).send({
          unitId: unit.id,
        })
      }
    )
}