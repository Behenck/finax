import { prisma } from "@/lib/prisma"
import { auth } from "@/middleware/auth"
import type { FastifyInstance } from "fastify"
import type { ZodTypeProvider } from "fastify-type-provider-zod"
import z from "zod"
import { BadRequestError } from "../_errors/bad-request-error"
import { db } from "@/lib/db"
import {
  RecurrenceAdjustment,
  RecurrenceDayType,
  RecurrenceStatus,
  TransactionType,
} from "generated/prisma/enums"

export async function updateRecurrence(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .put(
      "/organizations/:slug/recurrences/:recurrenceId",
      {
        schema: {
          tags: ["recurrences"],
          summary: "Update recurrence",
          security: [{ bearerAuth: [] }],
          params: z.object({
            slug: z.string(),
            recurrenceId: z.uuid(),
          }),
          body: z.object({
            description: z.string(),
            type: z.enum(TransactionType),
            totalAmount: z.number(),
            costCenterId: z.uuid(),
            companyId: z.uuid(),
            unitId: z.uuid().optional(),
            categoryId: z.uuid(),
            subCategoryId: z.uuid().optional(),
            interval: z.number().int().min(1),
            status: z.enum(RecurrenceStatus).optional(),
            startDate: z.date(),
            endDate: z.date().optional(),
            executionDay: z.number().int().min(1).max(31),
            executionDayType: z.enum(RecurrenceDayType).optional(),
            adjustmentRule: z.enum(RecurrenceAdjustment).optional(),
          }),
          response: {
            201: z.null(),
          },
        },
      },
      async (request, reply) => {
        const { slug, recurrenceId } = request.params
        const data = request.body

        const organization = await prisma.organization.findUnique({
          where: { slug },
          select: { id: true },
        })

        if (!organization) {
          throw new BadRequestError("Organization not found")
        }

        if (data.unitId) {
          const unit = await prisma.unit.findFirst({
            where: {
              id: data.unitId,
              companyId: data.companyId,
            },
          })

          if (!unit) {
            throw new BadRequestError("Unit does not belong to this company")
          }
        }

        const category = await prisma.category.findFirst({
          where: {
            id: data.categoryId,
            organizationId: organization.id,
          },
        })

        if (!category) {
          throw new BadRequestError("Category not found in this organization")
        }

        const categoryId = data.subCategoryId ?? data.categoryId

        await db(() =>
          prisma.recurrence.update({
            where: {
              id: recurrenceId
            },
            data: {
              description: data.description,
              type: data.type,
              totalAmount: data.totalAmount,
              companyId: data.companyId,
              unitId: data.unitId,
              categoryId,
              costCenterId: data.costCenterId,
              interval: data.interval,
              startDate: data.startDate,
              endDate: data.endDate,
              executionDay: data.executionDay,
              executionDayType: data.executionDayType,
              adjustmentRule: data.adjustmentRule,
            }
          })
        )

        return reply.status(201).send()
      }
    )
}
