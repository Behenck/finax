import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import { BadRequestError } from "../_errors/bad-request-error";
import { db } from "@/lib/db";

export async function createEmployee(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .post("/organizations/:slug/companies/:companyId/employees", {
      schema: {
        tags: ["employees"],
        summary: "Create a new employee",
        security: [{ bearerAuth: [] }],
        params: z.object({
          slug: z.string(),
          companyId: z.uuid(),
        }),
        body: z.object({
          name: z.string(),
          department: z.string(),
        }),
        response: {
          201: z.object({
            employeeId: z.uuid()
          })
        }
      }
    },
      async (request, reply) => {
        const { slug, companyId } = request.params
        const { name, department } = request.body
        const userId = await request.getCurrentUserId()

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

        const company = await prisma.company.findFirst({
          where: {
            id: companyId,
            organizationId: organization.id
          },
          select: {
            id: true
          }
        })

        if (!company) {
          throw new BadRequestError("Company not found")
        }

        const employee = await db(() =>
          prisma.employee.create({
            data: {
              name,
              department,
              userId,
              companyId: company.id,
              organizationId: organization.id
            },
          })
        )

        return reply.status(201).send({
          employeeId: employee.id,
        })
      }
    )
}