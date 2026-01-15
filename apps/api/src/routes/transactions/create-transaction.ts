import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import { BadRequestError } from "../_errors/bad-request-error";
import { db } from "@/lib/db";
import { TransactionNature, TransactionStatus, TransactionType } from "generated/prisma/enums";
import { generateHexCode } from "@/utils/generate-hex-code";

export async function createTransaction(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .post("/organizations/:slug/transactions", {
      schema: {
        tags: ["transactions"],
        summary: "Create a new transaction",
        security: [{ bearerAuth: [] }],
        params: z.object({
          slug: z.string()
        }),
        body: z.object({
          title: z.string(),
          description: z.string().optional(),
          totalAmount: z.number(),
          type: z.enum(TransactionType),
          status: z.enum(TransactionStatus),
          nature: z.enum(TransactionNature),
          dueDate: z.date(),
          expectedPaymentDate: z.date().optional(),
          paymentDate: z.string().optional(),
          costCenterId: z.uuid(),
          companyId: z.uuid(),
          unitId: z.uuid().optional(),
          categoryId: z.uuid(),
        }),
        response: {
          201: z.object({
            transactionId: z.uuid()
          })
        }
      }
    },
      async (request, reply) => {
        const { slug } = request.params
        const data = request.body
        const userId = await request.getCurrentUserId()

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

        const transaction = await db(() =>
          prisma.transaction.create({
            data: {
              code: generateHexCode(),
              title: data.title,
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
              organizationId: organization.id,
              userId,
            },
          })
        )

        return reply.status(201).send({
          transactionId: transaction.id,
        })
      }
    )
}