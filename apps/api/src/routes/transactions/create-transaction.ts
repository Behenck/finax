import { prisma } from "@/lib/prisma"
import { auth } from "@/middleware/auth"
import type { FastifyInstance } from "fastify"
import type { ZodTypeProvider } from "fastify-type-provider-zod"
import z from "zod"
import { BadRequestError } from "../_errors/bad-request-error"
import { db } from "@/lib/db"
import {
  TransactionNature,
  TransactionStatus,
  TransactionType,
} from "generated/prisma/enums"
import { generateHexCode } from "@/utils/generate-hex-code"
import { resolveTransactionRecurrenceStrategy } from "./utils/recurrence-config"

export async function createTransaction(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .post(
      "/organizations/:slug/transactions",
      {
        schema: {
          tags: ["transactions"],
          summary: "Create a new transaction",
          security: [{ bearerAuth: [] }],
          params: z.object({
            slug: z.string(),
          }),
          body: z.object({
            description: z.string(),
            totalAmount: z.number(),
            type: z.enum(TransactionType),
            status: z.enum(TransactionStatus).optional(),
            nature: z.enum(TransactionNature),
            dueDate: z.coerce.date(),
            expectedPaymentDate: z.coerce.date().optional(),
            paymentDate: z.string().optional(),
            costCenterId: z.uuid(),
            companyId: z.uuid(),
            unitId: z.uuid().optional(),
            categoryId: z.uuid(),
            subCategoryId: z.uuid().optional(),
            installmentRecurrenceType: z.enum([
              "SINGLE",
              "MONTH",
              "YEAR",
              "INSTALLMENTS",
            ]),
            installmentRecurrenceQuantity: z.number().optional(),
            employeeIdRefunded: z.uuid().optional(),
            items: z
              .array(
                z.object({
                  description: z.string(),
                  amount: z.number(),
                  categoryId: z.uuid(),
                  subCategoryId: z.uuid().optional(),
                })
              )
              .optional(),
          }),
          response: {
            201: z.null(),
          },
        },
      },
      async (request, reply) => {
        const { slug } = request.params
        const data = request.body
        const userId = await request.getCurrentUserId()

        const organization = await prisma.organization.findUnique({
          where: { slug },
          select: { id: true },
        })

        if (!organization) {
          throw new BadRequestError("Organization not found")
        }

        const transactionStatus = data.status ?? "PENDING"
        const transactionExpectedPaymentDate =
          data.expectedPaymentDate ?? data.dueDate
        const categoryId = data.subCategoryId ?? data.categoryId

        /* ✅ ALTERAÇÃO: uso da função */
        const recurrence = resolveTransactionRecurrenceStrategy(
          data.installmentRecurrenceType,
          data.installmentRecurrenceQuantity
        )

        let parentTransactionId: string | null = null

        for (let i = 0; i < recurrence.totalOccurrences; i++) {
          const dueDate = recurrence.calculateNextDate(data.dueDate, i)
          const expectedPaymentDate = recurrence.calculateNextDate(
            transactionExpectedPaymentDate,
            i
          )

          const description =
            recurrence.totalOccurrences === 1
              ? data.description
              : `${data.description} ${i + 1}/${recurrence.totalOccurrences}`

          const totalAmount = recurrence.shouldSplitAmount
            ? data.totalAmount / recurrence.totalOccurrences
            : data.totalAmount

          const totalAmountInCents = Math.round(totalAmount * 100)

          const transaction = await db(() =>
            prisma.transaction.create({
              data: {
                code: generateHexCode(),
                description,
                totalAmount: totalAmountInCents,
                type: data.type,
                status: transactionStatus,
                nature: data.nature,
                dueDate,
                expectedPaymentDate,
                paymentDate: data.paymentDate,
                costCenterId: data.costCenterId,
                companyId: data.companyId,
                unitId: data.unitId,
                categoryId,
                organizationId: organization.id,
                createdById: userId,
                refundedByEmployeeId: data.employeeIdRefunded,

                // 👉 primeira não tem parentId, próximas recebem o ID da primeira
                parentId: parentTransactionId,

                transactionItens: data.items?.length
                  ? {
                    create: data.items.map((item) => {
                      const itemCategoryId =
                        item.subCategoryId ?? item.categoryId

                      const itemAmount = recurrence.shouldSplitAmount
                        ? item.amount / recurrence.totalOccurrences
                        : item.amount

                      return {
                        description: item.description,
                        amount: Math.round(itemAmount * 100),
                        categoryId: itemCategoryId,
                      }
                    }),
                  }
                  : undefined,
              },
            })
          )

          // ✅ Se ainda não existe pai, define o primeiro como pai
          if (!parentTransactionId) {
            parentTransactionId = transaction.id
          }
        }
        return reply.status(201).send()
      }
    )
}
