import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import { BadRequestError } from "../_errors/bad-request-error";
import { db } from "@/lib/db";
import {
	companyMutationBodySchema,
	normalizeCompanyMutationBody,
} from "./company-schemas";

export async function createCompany(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .post("/organizations/:slug/companies", {
      schema: {
        tags: ["companies"],
        summary: "Create a new company",
        security: [{ bearerAuth: [] }],
        params: z.object({
          slug: z.string()
        }),
        body: companyMutationBodySchema,
        response: {
          201: z.object({
            companyId: z.uuid()
          })
        }
      }
    },
      async (request, reply) => {
        const { slug } = request.params
        const data = normalizeCompanyMutationBody(request.body)

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

        const company = await db(() =>
          prisma.company.create({
            data: {
              name: data.name,
              cnpj: data.cnpj,
              organizationId: organization.id,
            },
          })
        )

        return reply.status(201).send({
          companyId: company.id,
        })
      }
    )
}
