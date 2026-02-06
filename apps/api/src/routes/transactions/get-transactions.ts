import { prisma } from "@/lib/prisma"
import { auth } from "@/middleware/auth"
import type { FastifyInstance } from "fastify"
import type { ZodTypeProvider } from "fastify-type-provider-zod"
import z from "zod"
import { BadRequestError } from "../_errors/bad-request-error"
import {
  TransactionNature,
  TransactionStatus,
  TransactionType,
} from "generated/prisma/enums"
import { normalizeCategory } from "./utils/normalize-category"

/**
 * ============================
 * Schemas
 * ============================
 */

type RawCategory = {
  id: string
  name: string
  icon: string
  color: string
  parent?: {
    id: string
    name: string
    icon: string
    color: string
  } | null
}

const ChildCategorySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  icon: z.string(),
  color: z.string(),
})

const CategorySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  icon: z.string(),
  color: z.string(),
  children: ChildCategorySchema.nullable(),
})

const TransactionItemSchema = z.object({
  id: z.uuid(),
  description: z.string(),
  amount: z.number(),
  category: CategorySchema,
})

const TransactionSchema = z.object({
  id: z.uuid(),
  code: z.string(),
  description: z.string(),
  totalAmount: z.number(),
  type: z.enum(TransactionType),
  status: z.enum(TransactionStatus),
  nature: z.enum(TransactionNature),
  dueDate: z.date(),
  expectedPaymentDate: z.date(),
  paymentDate: z.date().nullable(),
  createdBy: z.object({
    id: z.uuid(),
    name: z.string().nullable(),
    avatarUrl: z.url().nullable(),
  }),
  refundedByEmployee: z.object({
    id: z.uuid(),
    name: z.string().nullable()
  }).nullable(),
  costCenter: z.object({
    id: z.uuid(),
    name: z.string(),
  }),
  company: z.object({
    id: z.uuid(),
    name: z.string(),
  }),

  unit: z
    .object({
      id: z.uuid(),
      name: z.string(),
    })
    .nullable(),

  category: CategorySchema,

  transactionItens: z.array(TransactionItemSchema),
})

/**
 * ============================
 * Route
 * ============================
 */

export async function getTransactions(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .get(
      "/organizations/:slug/transactions",
      {
        schema: {
          tags: ["transactions"],
          summary: "Get transactions",
          security: [{ bearerAuth: [] }],

          params: z.object({
            slug: z.string(),
          }),

          response: {
            200: z.object({
              transactions: z.array(TransactionSchema),
            }),
          },
        },
      },
      async (request) => {
        const { slug } = request.params

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

        const transactions = await prisma.transaction.findMany({
          where: {
            organizationId: organization.id,
          },
          select: {
            id: true,
            code: true,
            description: true,
            totalAmount: true,
            type: true,
            status: true,
            nature: true,
            dueDate: true,
            expectedPaymentDate: true,
            paymentDate: true,
            costCenter: {
              select: {
                id: true,
                name: true,
              },
            },
            company: {
              select: {
                id: true,
                name: true,
              },
            },
            unit: {
              select: {
                id: true,
                name: true,
              },
            },
            createdBy: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
              },
            },
            refundedByEmployee: {
              select: {
                id: true,
                name: true
              },
            },
            category: {
              select: {
                id: true,
                name: true,
                icon: true,
                color: true,
                parent: {
                  select: {
                    id: true,
                    name: true,
                    icon: true,
                    color: true,
                  },
                },
              },
            },
            transactionItens: {
              select: {
                id: true,
                description: true,
                amount: true,
                category: {
                  select: {
                    id: true,
                    name: true,
                    icon: true,
                    color: true,
                  },
                },
              },
            },
          },
        })

        const normalizedTransactions = transactions.map((transaction) => ({
          ...transaction,

          category: normalizeCategory(transaction.category),

          transactionItens: transaction.transactionItens.map((item) => ({
            ...item,
            category: normalizeCategory(item.category),
          })),
        }))

        return {
          transactions: normalizedTransactions,
        }
      },
    )
}
