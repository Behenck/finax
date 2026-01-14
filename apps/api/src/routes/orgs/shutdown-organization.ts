import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import { UnauthorizedError } from "../_errors/unauthorized-error";

export async function shutdownOrganization(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .delete("/organization/:slug", {
      schema: {
        tags: ["organizations"],
        summary: "Shutdown Organization",
        security: [{ bearerAuth: [] }],
        params: z.object({
          slug: z.string()
        }),
        response: {
          204: z.null()
        }
      }
    },
      async (request, reply) => {
        const userId = await request.getCurrentUserId()
        const { slug } = request.params

        const { membership, organization } =
          await request.getUserMembership(slug)

        await prisma.organization.delete({
          where: {
            id: organization.id
          }
        })

        return reply.status(204).send()
      }
    )
}