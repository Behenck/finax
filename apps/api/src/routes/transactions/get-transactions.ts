import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import { BadRequestError } from "../_errors/bad-request-error";
import { TransactionNature, TransactionStatus, TransactionType } from "generated/prisma/enums";

type CategoryTree = {
  id: string
  name: string
  icon: string
  color: string
  children: CategoryTree[]
}

const CategorySchema: z.ZodType<CategoryTree> = z.lazy(() =>
  z.object({
    id: z.uuid(),
    name: z.string(),
    icon: z.string(),
    color: z.string(),
    children: z.array(CategorySchema),
  })
)

export async function getTransactions(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .get("/organizations/:slug/transactions", {
      schema: {
        tags: ["transactions"],
        summary: "Get transactions",
        security: [{ bearerAuth: [] }],
        params: z.object({
          slug: z.string(),
        }),
        response: {
          200: z.object({
            transactions: z.array(
              z.object({
                id: z.uuid(),
                code: z.string(),
                title: z.string(),
                description: z.string().nullable(),
                totalAmount: z.number(),
                type: z.enum(TransactionType),
                status: z.enum(TransactionStatus),
                nature: z.enum(TransactionNature),
                dueDate: z.date(),
                expectedPaymentDate: z.date().nullable(),
                paymentDate: z.date().nullable(),
                costCenter: z.object({
                  id: z.uuid(),
                  name: z.string(),
                }),
                company: z.object({
                  id: z.uuid(),
                  name: z.string(),
                }),
                unit: z.object({
                  id: z.uuid(),
                  name: z.string()
                }).nullable(),
                user: z.object({
                  id: z.uuid(),
                  name: z.string().nullable(),
                  avatarUrl: z.url().nullable(),
                }),
                category: CategorySchema,
                transactionItens: z.array(
                  z.object({
                    id: z.uuid(),
                    description: z.string(),
                    amount: z.number(),
                    category: CategorySchema
                  })
                )
              }),
            )
          })
        }
      }
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
            organizationId: organization.id
          },
          select: {
            id: true,
            code: true,
            title: true,
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
            user: {
              select: {
                id: true,
                name: true,
                avatarUrl: true
              }
            },
            category: {
              select: {
                id: true,
                name: true,
                icon: true,
                color: true,
              }
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
                  }
                },
              }
            }
          }
        })

        return { transactions }
      }
    )
}