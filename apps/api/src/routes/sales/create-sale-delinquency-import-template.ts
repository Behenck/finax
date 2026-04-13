import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { Prisma } from "generated/prisma/client";
import z from "zod";
import { db } from "@/lib/db";
import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import {
	assertSaleDelinquencyImportRateLimit,
	saleDelinquencyImportRateLimit,
} from "./sale-delinquency-import-rate-limit";
import {
	CreateSaleDelinquencyImportTemplateBodySchema,
	CreateSaleDelinquencyImportTemplateResponseSchema,
} from "./sale-delinquency-import-schemas";
import { toSaleDelinquencyStoredTemplateName } from "./sale-delinquency-import-template-utils";

export async function createSaleDelinquencyImportTemplate(
	app: FastifyInstance,
) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.post(
			"/organizations/:slug/sales/delinquency/import-templates",
			{
				schema: {
					tags: ["sales"],
					summary: "Create sale delinquency import template",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
					}),
					body: CreateSaleDelinquencyImportTemplateBodySchema,
					response: {
						201: CreateSaleDelinquencyImportTemplateResponseSchema,
					},
				},
			},
			async (request, reply) => {
				const { slug } = request.params;
				const data = request.body;
				const userId = await request.getCurrentUserId();
				const { organization } = await request.getUserMembership(slug);

				assertSaleDelinquencyImportRateLimit(
					`${organization.id}:${userId}:sale-delinquency-import-templates:create`,
					saleDelinquencyImportRateLimit.templates,
				);

				const storedTemplateName = toSaleDelinquencyStoredTemplateName(data.name);

				const template = await db(() =>
					prisma.saleImportTemplate.upsert({
						where: {
							organizationId_name: {
								organizationId: organization.id,
								name: storedTemplateName,
							},
						},
						update: {
							headerSignature: data.headerSignature,
							mappingJson: data.mapping as unknown as Prisma.InputJsonValue,
							fixedValuesJson: {
								namespace: "SALE_DELINQUENCY_IMPORT",
							} as Prisma.InputJsonValue,
						},
						create: {
							organizationId: organization.id,
							name: storedTemplateName,
							headerSignature: data.headerSignature,
							mappingJson: data.mapping as unknown as Prisma.InputJsonValue,
							fixedValuesJson: {
								namespace: "SALE_DELINQUENCY_IMPORT",
							} as Prisma.InputJsonValue,
							createdById: userId,
						},
						select: {
							id: true,
						},
					}),
				);

				return reply.status(201).send({
					templateId: template.id,
				});
			},
		);
}
