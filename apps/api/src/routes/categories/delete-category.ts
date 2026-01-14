import { db } from "@/lib/db"
import { BadRequestError } from "../_errors/bad-request-error"
import { prisma } from "@/lib/prisma"
import z from "zod"
import type { ZodTypeProvider } from "fastify-type-provider-zod"
import type { FastifyInstance } from "fastify"
import { auth } from "@/middleware/auth"

export async function deleteCategory(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .delete(
      "/organizations/:slug/categories/:id",
      {
        schema: {
          tags: ["categories"],
          summary: "Delete category",
          security: [{ bearerAuth: [] }],
          params: z.object({
            slug: z.string(),
            id: z.uuid(),
          }),
          response: {
            204: z.null(),
          },
        },
      },
      async (request, reply) => {
        const { slug, id } = request.params

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
          prisma.category.deleteMany({
            where: {
              organizationId: organization.id,
              OR: [
                { id },
                { parentId: id },
              ],
            },
          })
        )

        return reply.status(204).send()
      }
    )
}
