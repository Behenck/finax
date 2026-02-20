import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import { BadRequestError } from "../_errors/bad-request-error";
import { db } from "@/lib/db";

export async function assignSupervisorPartner(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .patch("/organizations/:slug/partners/:partnerId/assign-supervisor", {
      schema: {
        tags: ["partners"],
        summary: "Update employee",
        operationId: "assignPartnerSupervisor",
        security: [{ bearerAuth: [] }],
        params: z.object({
          slug: z.string(),
          partnerId: z.uuid(),
        }),
        body: z.object({
          supervisorId: z.uuid().nullable(),
        }),
        response: {
          204: z.null()
        }
      }
    },
      async (request, reply) => {
        const { slug, partnerId } = request.params
        const { supervisorId } = request.body

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

        const partner = await prisma.partner.findFirst({
          where: {
            id: partnerId,
            organizationId: organization.id
          },
          select: { id: true },
        })

        if (!partner) {
          throw new BadRequestError("Partner not found")
        }

        // if (supervisorId) {
        //   const supervisor = await prisma.user.findFirst({
        //     where: {
        //       id: supervisorId,
        //       organizationId: organization.id,
        //     },
        //     select: { id: true },
        //   })

        //   if (!supervisor) {
        //     throw new BadRequestError("Supervisor not found")
        //   }
        // }

        await db(() => prisma.partner.update({
          where: {
            id: partnerId,
            organizationId: organization.id
          },
          data: {
            supervisorId,
          }
        })
        )

        return reply.status(204).send()
      }
    )
}