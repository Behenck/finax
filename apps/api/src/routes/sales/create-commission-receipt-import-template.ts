import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { Prisma } from "generated/prisma/client";
import z from "zod";
import { db } from "@/lib/db";
import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import {
	assertCommissionReceiptImportRateLimit,
	commissionReceiptImportRateLimit,
} from "./commission-receipt-import-rate-limit";
import {
	CreateCommissionReceiptImportTemplateBodySchema,
	CreateCommissionReceiptImportTemplateResponseSchema,
} from "./commission-receipt-import-schemas";
import { toCommissionReceiptStoredTemplateName } from "./commission-receipt-import-template-utils";

export async function createCommissionReceiptImportTemplate(
	app: FastifyInstance,
) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.post(
			"/organizations/:slug/commissions/receipts/import-templates",
			{
				schema: {
					tags: ["sales"],
					summary: "Create commission receipt import template",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
					}),
					body: CreateCommissionReceiptImportTemplateBodySchema,
					response: {
						201: CreateCommissionReceiptImportTemplateResponseSchema,
					},
				},
			},
			async (request, reply) => {
				const { slug } = request.params;
				const data = request.body;
				const userId = await request.getCurrentUserId();
				const { organization } = await request.getUserMembership(slug);

				assertCommissionReceiptImportRateLimit(
					`${organization.id}:${userId}:commission-receipt-import-templates:create`,
					commissionReceiptImportRateLimit.templates,
				);

				const storedTemplateName = toCommissionReceiptStoredTemplateName(
					data.name,
				);

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
								namespace: "COMMISSION_RECEIPT_IMPORT",
							} as Prisma.InputJsonValue,
						},
						create: {
							organizationId: organization.id,
							name: storedTemplateName,
							headerSignature: data.headerSignature,
							mappingJson: data.mapping as unknown as Prisma.InputJsonValue,
							fixedValuesJson: {
								namespace: "COMMISSION_RECEIPT_IMPORT",
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
