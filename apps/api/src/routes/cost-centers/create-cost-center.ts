import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import { BadRequestError } from "../_errors/bad-request-error";
import { db } from "@/lib/db";

export async function createCostCenter(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .post("/organizations/:slug/costCenters", {
      schema: {
        tags: ["costCenters"],
        summary: "Create a new cost center",
        security: [{ bearerAuth: [] }],
        params: z.object({
          slug: z.string()
        }),
        body: z.object({
          name: z.string(),
        }),
        response: {
          201: z.object({
            costCenterId: z.uuid()
          })
        }
      }
    },
      async (request, reply) => {
        const { slug } = request.params
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

        const costCenter = await db(() =>
          prisma.costCenter.create({
            data: {
              name,
              organizationId: organization.id,
            },
          })
        )

        return reply.status(201).send({
          costCenterId: costCenter.id,
        })
      }
    )
}