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
    .post("/organizations/:slug/employees", {
      schema: {
        tags: ["employees"],
        summary: "Create a new employee",
        security: [{ bearerAuth: [] }],
        params: z.object({
          slug: z.string(),
        }),
        body: z.object({
          name: z.string(),
          role: z.string().optional(),
          email: z.string(),
          department: z.string().optional(),
          userId: z.string().optional(),
          companyId: z.uuid()
        }),
        response: {
          201: z.object({
            employeeId: z.uuid()
          })
        }
      }
    },
      async (request, reply) => {
        const { slug } = request.params
        const { name, department, userId, role, email, companyId } = request.body

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
              role,
              email,
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