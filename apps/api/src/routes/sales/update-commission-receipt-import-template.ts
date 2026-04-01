import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { Prisma } from "generated/prisma/client";
import z from "zod";
import { db } from "@/lib/db";
import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import { BadRequestError } from "../_errors/bad-request-error";
import {
	assertCommissionReceiptImportRateLimit,
	commissionReceiptImportRateLimit,
} from "./commission-receipt-import-rate-limit";
import { UpdateCommissionReceiptImportTemplateBodySchema } from "./commission-receipt-import-schemas";
import {
	isCommissionReceiptTemplateStoredName,
	toCommissionReceiptStoredTemplateName,
} from "./commission-receipt-import-template-utils";

export async function updateCommissionReceiptImportTemplate(
	app: FastifyInstance,
) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.put(
			"/organizations/:slug/commissions/receipts/import-templates/:templateId",
			{
				schema: {
					tags: ["sales"],
					summary: "Update commission receipt import template",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
						templateId: z.uuid(),
					}),
					body: UpdateCommissionReceiptImportTemplateBodySchema,
					response: {
						204: z.null(),
					},
				},
			},
			async (request, reply) => {
				const { slug, templateId } = request.params;
				const data = request.body;
				const userId = await request.getCurrentUserId();
				const { organization } = await request.getUserMembership(slug);

				assertCommissionReceiptImportRateLimit(
					`${organization.id}:${userId}:commission-receipt-import-templates:update`,
					commissionReceiptImportRateLimit.templates,
				);

				const existingTemplate = await prisma.saleImportTemplate.findFirst({
					where: {
						id: templateId,
						organizationId: organization.id,
					},
					select: {
						id: true,
						name: true,
					},
				});

				if (!existingTemplate) {
					throw new BadRequestError(
						"Commission receipt import template not found",
					);
				}

				if (!isCommissionReceiptTemplateStoredName(existingTemplate.name)) {
					throw new BadRequestError(
						"Commission receipt import template not found",
					);
				}

				const storedTemplateName = toCommissionReceiptStoredTemplateName(
					data.name,
				);

				if (storedTemplateName !== existingTemplate.name) {
					const duplicate = await prisma.saleImportTemplate.findFirst({
						where: {
							organizationId: organization.id,
							name: storedTemplateName,
							NOT: {
								id: templateId,
							},
						},
						select: {
							id: true,
						},
					});

					if (duplicate) {
						throw new BadRequestError(
							"Commission receipt import template name already exists",
						);
					}
				}

				await db(() =>
					prisma.saleImportTemplate.update({
						where: {
							id: templateId,
						},
						data: {
							name: storedTemplateName,
							headerSignature: data.headerSignature,
							mappingJson: data.mapping as unknown as Prisma.InputJsonValue,
							fixedValuesJson: {
								namespace: "COMMISSION_RECEIPT_IMPORT",
							} as Prisma.InputJsonValue,
						},
					}),
				);

				return reply.status(204).send();
			},
		);
}
