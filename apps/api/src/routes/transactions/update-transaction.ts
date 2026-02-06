import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import { BadRequestError } from "../_errors/bad-request-error";
import { db } from "@/lib/db";
import { TransactionNature, TransactionStatus, TransactionType } from "generated/prisma/enums";

export async function updateTransaction(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .put("/organizations/:slug/transactions/:transactionId", {
      schema: {
        tags: ["transactions"],
        summary: "Update transaction",
        security: [{ bearerAuth: [] }],
        params: z.object({
          slug: z.string(),
          transactionId: z.uuid(),
        }),
        body: z.object({
          description: z.string(),
          totalAmount: z.number(),
          type: z.enum(TransactionType),
          status: z.enum(TransactionStatus),
          nature: z.enum(TransactionNature),
          dueDate: z.date(),
          expectedPaymentDate: z.date().optional(),
          paymentDate: z.date().optional(),
          costCenterId: z.uuid(),
          companyId: z.uuid(),
          unitId: z.uuid().optional(),
          categoryId: z.uuid(),
          employeeIdRefunded: z.uuid().optional(),
        }),
        response: {
          204: z.null()
        }
      }
    },
      async (request, reply) => {
        const { slug, transactionId } = request.params
        const data = request.body

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
          select: { id: true },
        })

        if (!transaction) {
          throw new BadRequestError("Transaction not found")
        }

        await db(() => prisma.transaction.update({
          where: {
            id: transactionId
          },
          data: {
            description: data.description,
            totalAmount: data.totalAmount,
            type: data.type,
            status: data.status,
            nature: data.nature,
            dueDate: data.dueDate,
            expectedPaymentDate: data.expectedPaymentDate,
            paymentDate: data.paymentDate,
            costCenterId: data.costCenterId,
            companyId: data.companyId,
            unitId: data.unitId,
            categoryId: data.categoryId,
            refundedByEmployeeId: data.employeeIdRefunded
          }
        })
        )

        return reply.status(204).send()
      }
    )
}