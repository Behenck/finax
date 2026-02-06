import { prisma } from "@/lib/prisma"
import { auth } from "@/middleware/auth"
import type { FastifyInstance } from "fastify"
import type { ZodTypeProvider } from "fastify-type-provider-zod"
import z from "zod"
import { BadRequestError } from "../_errors/bad-request-error"
import {
  RecurrenceAdjustment,
  RecurrenceDayType,
  RecurrenceStatus,
  TransactionType,
} from "generated/prisma/enums"
import { normalizeCategory } from '../transactions/utils/normalize-category';

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

export async function getRecurrences(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .get(
      "/organizations/:slug/recurrences",
      {
        schema: {
          tags: ["recurrences"],
          summary: "Get recurrences",
          security: [{ bearerAuth: [] }],
          params: z.object({
            slug: z.string(),
          }),
          response: {
            200: z.object({
              recurrences: z.array(
                z.object({
                  description: z.string(),
                  type: z.enum(TransactionType),
                  totalAmount: z.number(),
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
                  interval: z.number().int().min(1),
                  status: z.enum(RecurrenceStatus),
                  startDate: z.date(),
                  endDate: z.date().nullable(),
                  executionDay: z.number().int().min(1).max(31),
                  executionDayType: z.enum(RecurrenceDayType),
                  adjustmentRule: z.enum(RecurrenceAdjustment),
                  lastRunAt: z.date().nullable(),
                  createdBy: z.object({
                    id: z.uuid(),
                    name: z.string().nullable(),
                    avatarUrl: z.url().nullable(),
                  }),
                  createdAt: z.date(),
                }),
              )
            }),
          },
        },
      },
      async (request, reply) => {
        const { slug } = request.params

        const organization = await prisma.organization.findUnique({
          where: { slug },
          select: { id: true },
        })

        if (!organization) {
          throw new BadRequestError("Organization not found")
        }

        const recurrences = await prisma.recurrence.findMany({
          where: {
            organizationId: organization.id
          },
          select: {
            description: true,
            type: true,
            totalAmount: true,
            status: true,
            lastRunAt: true,
            createdAt: true,
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
            costCenter: {
              select: {
                id: true,
                name: true,
              },
            },
            interval: true,
            startDate: true,
            endDate: true,
            executionDay: true,
            executionDayType: true,
            adjustmentRule: true,
            createdBy: {
              select: {
                id: true,
                name: true,
                avatarUrl: true
              }
            }
          }
        })

        const normalizedRecurrences = recurrences.map((recurrence) => ({
          ...recurrence,
          category: normalizeCategory(recurrence.category),
        }))

        return {
          recurrences: normalizedRecurrences,
        }
      }
    )
}
