import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import { BadRequestError } from "../_errors/bad-request-error";
import { db } from "@/lib/db";

export async function updateEmployee(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .patch("/organizations/:slug/companies/:companyId/employees/:employeeId", {
      schema: {
        tags: ["employees"],
        summary: "Update employee",
        security: [{ bearerAuth: [] }],
        params: z.object({
          slug: z.string(),
          companyId: z.uuid(),
          employeeId: z.uuid(),
        }),
        body: z.object({
          name: z.string(),
          department: z.string(),
        }),
        response: {
          204: z.null()
        }
      }
    },
      async (request, reply) => {
        const { slug, companyId, employeeId } = request.params
        const { name, department } = request.body

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

        const employee = await prisma.employee.findFirst({
          where: {
            id: employeeId,
            companyId,
            organizationId: organization.id
          },
          select: { id: true },
        })

        if (!employee) {
          throw new BadRequestError("Employee not found")
        }

        await db(() => prisma.employee.update({
          where: {
            id: employeeId,
          },
          data: {
            name,
            department
          }
        })
        )

        return reply.status(204).send()
      }
    )
}