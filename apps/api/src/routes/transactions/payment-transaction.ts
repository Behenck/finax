import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import { BadRequestError } from "../_errors/bad-request-error";
import { db } from "@/lib/db";

export async function paymentTransaction(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .patch("/organizations/:slug/transactions/:transactionId", {
      schema: {
        tags: ["transactions"],
        summary: "Payment transaction",
        security: [{ bearerAuth: [] }],
        params: z.object({
          slug: z.string(),
          transactionId: z.uuid(),
        }),
        body: z.object({
          paymentDate: z.date().optional(),
        }),
        response: {
          204: z.null()
        }
      }
    },
      async (request, reply) => {
        const { slug, transactionId } = request.params
        const { paymentDate } = request.body

        const parsedPaymentDate = paymentDate
          ? new Date(paymentDate)
          : new Date()

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
            organizationId: organization.id,
          },
          select: { id: true, status: true },
        })

        if (!transaction) {
          throw new BadRequestError("Transaction not found")
        }

        if (transaction.status === "PAID") {
          throw new BadRequestError("Transaction already paid")
        }

        await db(() => prisma.transaction.update({
          where: {
            id: transactionId
          },
          data: {
            paymentDate: parsedPaymentDate,
            status: "PAID"
          }
        })
        )

        return reply.status(204).send()
      }
    )
}