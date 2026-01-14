import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { TransactionType } from "generated/prisma/enums";
import z from "zod";
import { BadRequestError } from "../_errors/bad-request-error";

import { db } from "@/lib/db";

export async function updateCategory(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .put(
      "/organizations/:slug/categories/:id",
      {
        schema: {
          tags: ["categories"],
          summary: "Update category",
          security: [{ bearerAuth: [] }],
          params: z.object({
            slug: z.string(),
            id: z.uuid(),
          }),
          body: z.object({
            name: z.string(),
            type: z.enum(TransactionType),
            icon: z.string(),
            color: z.string(),
          }),
          response: {
            204: z.null(),
          },
        },
      },
      async (request, reply) => {
        const { slug, id } = request.params
        const data = request.body

        const organization = await prisma.organization.findUnique({
          where: { slug },
          select: { id: true },
        })

        if (!organization) {
          throw new BadRequestError("Organization not found")
        }

        const category = await prisma.category.findFirst({
          where: {
            id,
            organizationId: organization.id,
          },
          select: { id: true },
        })

        if (!category) {
          throw new BadRequestError("Category not found")
        }

        await db(() =>
          prisma.category.update({
            where: { id },
            data: {
              name: data.name,
              type: data.type,
              color: data.color,
              icon: data.icon,
            },
          })
        )

        return reply.status(204).send()
      }
    )
}
