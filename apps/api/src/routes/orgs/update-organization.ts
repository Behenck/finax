import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import { BadRequestError } from "../_errors/bad-request-error";
import { UnauthorizedError } from "../_errors/unauthorized-error";

export async function updateOrganization(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .put("/organization/:slug", {
      schema: {
        tags: ["organizations"],
        summary: "Update an organization",
        security: [{ bearerAuth: [] }],
        params: z.object({
          slug: z.string(),
        }),
        body: z.object({
          name: z.string(),
          domain: z.string().nullish(),
          shouldAttachUserByDomain: z.boolean().optional(),
        }),
        response: {
          204: z.null()
        }
      }
    },
      async (request, reply) => {
        const userId = await request.getCurrentUserId()
        const { slug } = request.params
        const { membership, organization } = await request.getUserMembership(slug)
        const { name, domain, shouldAttachUserByDomain } = request.body

        if (domain) {
          const organizationByDomain = await prisma.organization.findFirst({
            where: {
              domain,
              id: {
                not: organization.id
              }
            }
          })

          if (organizationByDomain) {
            throw new BadRequestError("Another organization with some domain already exists.")
          }
        }

        await prisma.organization.update({
          where: {
            id: organization.id
          },
          data: {
            name,
            domain,
            shouldAttachUserByDomain
          }
        })

        return reply.status(204).send()
      }
    )
}