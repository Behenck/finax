import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import { BadRequestError } from "../_errors/bad-request-error";
import { db } from "@/lib/db";

export async function deleteCustomer(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .delete("/organizations/:slug/customers/:customerId", {
      schema: {
        tags: ["customers"],
        summary: "Delete customer",
        security: [{ bearerAuth: [] }],
        params: z.object({
          slug: z.string(),
          customerId: z.uuid(),
        }),
        response: {
          204: z.null()
        }
      }
    },
      async (request, reply) => {
        const { slug, customerId } = request.params

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

        const customer = await prisma.customer.findFirst({
          where: {
            id: customerId,
            organizationId: organization.id
          },
        })

        if (!customer) {
          throw new BadRequestError("Customer not found")
        }

        await db(() => prisma.customer.delete({
          where: {
            id: customerId,
          }
        })
        )

        return reply.status(204).send()
      }
    )
}