import { db } from "@/lib/db";
import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import { BadRequestError } from "../_errors/bad-request-error";

export async function updateProduct(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .put("/organizations/:slug/products/:id", {
      schema: {
        tags: ["products"],
        summary: "Update product",
        security: [{ bearerAuth: [] }],
        params: z.object({
          slug: z.string(),
          id: z.uuid(),
        }),
        body: z.object({
          name: z.string().min(1),
          description: z.string().nullable(),
          parentId: z.uuid().nullable(),
          isActive: z.boolean(),
          sortOrder: z.number().int().min(0),
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

        const product = await prisma.product.findFirst({
          where: {
            id,
            organizationId: organization.id,
          },
          select: {
            id: true,
            parentId: true,
            _count: {
              select: {
                children: true,
              },
            },
          },
        })

        if (!product) {
          throw new BadRequestError("Product not found")
        }

        if (data.parentId === id) {
          throw new BadRequestError("Product cannot be its own parent")
        }

        if (data.parentId !== null) {
          const parent = await prisma.product.findFirst({
            where: {
              id: data.parentId,
              organizationId: organization.id,
            },
            select: {
              id: true,
              parentId: true,
            },
          })

          if (!parent) {
            throw new BadRequestError("Parent product not found")
          }

          if (parent.parentId !== null) {
            throw new BadRequestError("Parent product must be a root product")
          }

          if (product._count.children > 0) {
            throw new BadRequestError(
              "Cannot move a product with children under another parent"
            )
          }
        }

        await db(() =>
          prisma.product.update({
            where: {
              id,
            },
            data: {
              name: data.name,
              description: data.description,
              parentId: data.parentId,
              isActive: data.isActive,
              sortOrder: data.sortOrder,
            },
          })
        )

        return reply.status(204).send()
      }
    )
}

