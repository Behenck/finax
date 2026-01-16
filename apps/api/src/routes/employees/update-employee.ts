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
    .put("/organizations/:slug/employees/:employeeId", {
      schema: {
        tags: ["employees"],
        summary: "Update employee",
        security: [{ bearerAuth: [] }],
        params: z.object({
          slug: z.string(),
          employeeId: z.uuid(),
        }),
        body: z.object({
          name: z.string(),
          role: z.string().optional(),
          email: z.string(),
          department: z.string().optional(),
          companyId: z.uuid(),
        }),
        response: {
          204: z.null()
        }
      }
    },
      async (request, reply) => {
        const { slug, employeeId } = request.params
        const { name, role, email, department, companyId } = request.body

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

        const employee = await prisma.employee.findFirst({
          where: {
            id: employeeId,
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
            role,
            email,
            department,
            companyId
          }
        })
        )

        return reply.status(204).send()
      }
    )
}