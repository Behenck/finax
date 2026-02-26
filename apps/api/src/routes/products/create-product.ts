import { db } from "@/lib/db";
import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import { BadRequestError } from "../_errors/bad-request-error";

export async function createProduct(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .post("/organizations/:slug/products", {
      schema: {
        tags: ["products"],
        summary: "Create a new product",
        security: [{ bearerAuth: [] }],
        params: z.object({
          slug: z.string(),
        }),
        body: z.object({
          name: z.string().min(1),
          description: z.string().nullable().optional(),
          parentId: z.uuid().nullable().optional(),
          isActive: z.boolean().optional(),
          sortOrder: z.number().int().min(0).optional(),
        }),
        response: {
          201: z.object({
            productId: z.uuid(),
          }),
        },
      },
    },
      async (request, reply) => {
        const { slug } = request.params
        const data = request.body

        const organization = await prisma.organization.findUnique({
          where: { slug },
          select: { id: true },
        })

        if (!organization) {
          throw new BadRequestError("Organization not found")
        }

        if (data.parentId) {
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
        }

        const product = await db(() =>
          prisma.product.create({
            data: {
              organizationId: organization.id,
              name: data.name,
              description: data.description ?? null,
              parentId: data.parentId ?? null,
              isActive: data.isActive ?? true,
              sortOrder: data.sortOrder ?? 0,
            },
          })
        )

        return reply.status(201).send({
          productId: product.id,
        })
      }
    )
}

