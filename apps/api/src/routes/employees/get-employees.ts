import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import { BadRequestError } from "../_errors/bad-request-error";

export async function getEmployees(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .get("/organizations/:slug/employees", {
      schema: {
        tags: ["employees"],
        summary: "Get employees",
        security: [{ bearerAuth: [] }],
        params: z.object({
          slug: z.string(),
        }),
        response: {
          200: z.object({
            employees: z.array(
              z.object({
                id: z.uuid(),
                name: z.string(),
                role: z.string().nullable(),
                email: z.string(),
                department: z.string().nullable(),
                userId: z.uuid().nullable(),
                company: z.object({
                  id: z.uuid(),
                  name: z.string(),
                })
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

        const employees = await prisma.employee.findMany({
          where: {
            organizationId: organization.id
          },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            department: true,
            userId: true,
            company: {
              select: {
                id: true,
                name: true,
              }
            }
          }
        })

        return { employees }
      }
    )
}