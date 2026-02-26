import { auth } from "@/middleware/auth";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { Role } from "generated/prisma/enums";
import z from "zod";

export async function getMembership(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .get("/organizations/:slug/membership", {
      schema: {
        tags: ["organizations"],
        summary: "Get Organization Membership",
        security: [{ bearerAuth: [] }],
        params: z.object({
          slug: z.string()
        }),
        response: {
          200: z.object({
            membership: z.object({
              id: z.uuid(),
              role: z.enum(Role),
              userId: z.uuid(),
              organizationId: z.uuid()
            })
          })
        }
      }
    },
      async (request, reply) => {
        const { slug } = request.params

        const { membership } = await request.getUserMembership(slug)

        return {
          membership: {
            id: membership.id,
            role: membership.role,
            userId: membership.userId,
            organizationId: membership.organizationId
          }
        }
      }
    )
}
