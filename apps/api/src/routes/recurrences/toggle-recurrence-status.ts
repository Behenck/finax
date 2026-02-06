import { prisma } from "@/lib/prisma"
import { auth } from "@/middleware/auth"
import type { FastifyInstance } from "fastify"
import type { ZodTypeProvider } from "fastify-type-provider-zod"
import z from "zod"
import { BadRequestError } from "../_errors/bad-request-error"
import { db } from "@/lib/db"
import { RecurrenceStatus } from "generated/prisma/enums"

export async function toggleRecurrenceStatus(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .patch(
      "/organizations/:slug/recurrences/:recurrenceId",
      {
        schema: {
          tags: ["recurrences"],
          summary: "Toggle recurrence status (pause/resume)",
          security: [{ bearerAuth: [] }],
          params: z.object({
            slug: z.string(),
            recurrenceId: z.uuid(),
          }),
          response: {
            204: z.null(),
          },
        },
      },
      async (request, reply) => {
        const { slug, recurrenceId } = request.params

        const organization = await prisma.organization.findUnique({
          where: { slug },
          select: { id: true },
        })

        if (!organization) {
          throw new BadRequestError("Organization not found")
        }

        const recurrence = await prisma.recurrence.findFirst({
          where: {
            id: recurrenceId,
            organizationId: organization.id,
          },
        })

        if (!recurrence) {
          throw new BadRequestError("Recurrence not found")
        }

        const status =
          recurrence.status === RecurrenceStatus.ACTIVE
            ? RecurrenceStatus.PAUSED
            : RecurrenceStatus.ACTIVE


        await db(() =>
          prisma.recurrence.update({
            where: {
              id: recurrenceId
            },
            data: {
              status
            }
          })
        )

        return reply.status(204).send()
      }
    )
}
