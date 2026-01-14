import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import { BadRequestError } from "../_errors/bad-request-error";

export async function getCompanies(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .get("/organizations/:slug/companies", {
      schema: {
        tags: ["companies"],
        summary: "Get companies",
        security: [{ bearerAuth: [] }],
        params: z.object({
          slug: z.string(),
        }),
        response: {
          200: z.object({
            companies: z.array(
              z.object({
                id: z.uuid(),
                name: z.string(),
                units: z.array(
                  z.object({
                    id: z.uuid(),
                    name: z.string(),
                  })
                ),
                employees: z.array(
                  z.object({
                    id: z.uuid(),
                    name: z.string(),
                    department: z.string(),
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

        const companies = await prisma.company.findMany({
          where: {
            organizationId: organization.id
          },
          select: {
            id: true,
            name: true,
            units: {
              select: {
                id: true,
                name: true,
              },
            },
            employees: {
              select: {
                id: true,
                name: true,
                department: true
              }
            }
          }
        })

        return { companies }
      }
    )
}