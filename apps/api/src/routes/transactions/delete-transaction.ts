import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import { BadRequestError } from "../_errors/bad-request-error";
import { db } from "@/lib/db";

export async function deleteTransaction(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .delete("/organizations/:slug/transactions/:transactionId", {
      schema: {
        tags: ["transactions"],
        summary: "Delete transaction",
        security: [{ bearerAuth: [] }],
        params: z.object({
          slug: z.string(),
          transactionId: z.uuid(),
        }),
        response: {
          204: z.null()
        }
      }
    },
      async (request, reply) => {
        const { slug, transactionId } = request.params

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

        const transaction = await prisma.transaction.findFirst({
          where: {
            id: transactionId,
            organizationId: organization.id
          }
        })

        if (!transaction) {
          throw new BadRequestError("Transaction not found")
        }

        await db(() => prisma.transaction.delete({
          where: {
            id: transactionId
          }
        })
        )

        return reply.status(204).send()
      }
    )
}