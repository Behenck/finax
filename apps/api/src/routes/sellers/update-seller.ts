import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import { BadRequestError } from "../_errors/bad-request-error";
import { db } from "@/lib/db";
import { SellerDocumentType, SellerStatus } from "generated/prisma/enums";

function normalizeOptionalText(value: string | undefined) {
	const normalizedValue = value?.trim();
	return normalizedValue ? normalizedValue : null;
}

export async function updateSeller(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .put("/organizations/:slug/sellers/:sellerId", {
      schema: {
        tags: ["sellers"],
        summary: "Update employee",
        security: [{ bearerAuth: [] }],
        params: z.object({
          slug: z.string(),
          sellerId: z.uuid(),
        }),
        body: z.object({
          name: z.string(),
          email: z.string().optional(),
          phone: z.string().optional(),
          companyName: z.string().optional(),
          documentType: z.enum(SellerDocumentType).optional(),
          document: z.string().optional(),
          country: z.string(),
          state: z.string(),
          city: z.string().optional(),
          street: z.string().optional(),
          zipCode: z.string().optional(),
          neighborhood: z.string().optional(),
          number: z.string().optional(),
          complement: z.string().optional(),
          status: z.enum(SellerStatus).optional(),
        }),
        response: {
          204: z.null()
        }
      }
    },
      async (request, reply) => {
        const { slug, sellerId } = request.params
        const data = request.body

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

        const seller = await prisma.seller.findFirst({
          where: {
            id: sellerId,
            organizationId: organization.id
          },
          select: { id: true },
        })

        if (!seller) {
          throw new BadRequestError("Seller not found")
        }

        const normalizedDocument = normalizeOptionalText(data.document)
        const normalizedEmail = normalizeOptionalText(data.email)?.toLowerCase() ?? null
        const normalizedPhone = normalizeOptionalText(data.phone)
        const normalizedCompanyName = normalizeOptionalText(data.companyName)

        await db(() => prisma.seller.update({
          where: {
            id: sellerId,
          },
          data: {
            name: data.name,
            email: normalizedEmail,
            phone: normalizedPhone,
            companyName: normalizedCompanyName,
            documentType: normalizedDocument ? data.documentType ?? null : null,
            document: normalizedDocument,
            country: data.country,
            state: data.state,
            city: data.city,
            street: data.street,
            zipCode: data.zipCode,
            neighborhood: data.neighborhood,
            number: data.number,
            complement: data.complement,
            status: data.status,
          }
        })
        )

        return reply.status(204).send()
      }
    )
}
