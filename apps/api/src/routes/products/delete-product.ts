import { db } from "@/lib/db";
import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import { BadRequestError } from "../_errors/bad-request-error";

export async function deleteProduct(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .delete("/organizations/:slug/products/:id", {
      schema: {
        tags: ["products"],
        summary: "Delete product",
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

        const product = await prisma.product.findFirst({
          where: {
            id,
            organizationId: organization.id,
          },
          select: {
            id: true,
            _count: {
              select: {
                children: true,
                commissionScenarios: true,
              },
            },
          },
        })

        if (!product) {
          throw new BadRequestError("Product not found")
        }

        if (product._count.children > 0) {
          throw new BadRequestError("Product has children and cannot be deleted")
        }

        if (product._count.commissionScenarios > 0) {
          throw new BadRequestError(
            "Product has commission scenarios and cannot be deleted"
          )
        }

        await db(() =>
          prisma.product.delete({
            where: {
              id,
            },
          })
        )

        return reply.status(204).send()
      }
    )
}

