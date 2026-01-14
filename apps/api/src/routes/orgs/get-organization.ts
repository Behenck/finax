import { auth } from "@/middleware/auth";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";

export async function getOrganization(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .get("/organization/:slug", {
      schema: {
        tags: ["organizations"],
        summary: "Get Organization",
        security: [{ bearerAuth: [] }],
        params: z.object({
          slug: z.string()
        }),
        response: {
          200: z.object({
            organization: z.object({
              id: z.uuid(),
              name: z.string(),
              slug: z.string(),
              domain: z.string().nullable(),
              shouldAttachUserByDomain: z.boolean(),
              avatarUrl: z.url().nullable(),
              ownerId: z.uuid(),
              createdAt: z.date(),
              updatedAt: z.date(),
            })
          })
        }
      }
    },
      async (request, reply) => {
        const { slug } = request.params

        const { organization } = await request.getUserMembership(slug)

        return {
          organization
        }
      }
    )
}