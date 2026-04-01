import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import { BadRequestError } from "../_errors/bad-request-error";
import {
	assertCommissionReceiptImportRateLimit,
	commissionReceiptImportRateLimit,
} from "./commission-receipt-import-rate-limit";
import {
	CommissionReceiptImportTemplatesResponseSchema,
	GetCommissionReceiptImportTemplatesQuerySchema,
} from "./commission-receipt-import-schemas";
import {
	COMMISSION_RECEIPT_TEMPLATE_NAME_PREFIX,
	fromCommissionReceiptStoredTemplateName,
	isCommissionReceiptTemplateStoredName,
	parseCommissionReceiptTemplateMappingJson,
} from "./commission-receipt-import-template-utils";

export async function getCommissionReceiptImportTemplates(
	app: FastifyInstance,
) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.get(
			"/organizations/:slug/commissions/receipts/import-templates",
			{
				schema: {
					tags: ["sales"],
					summary: "List commission receipt import templates",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
					}),
					querystring: GetCommissionReceiptImportTemplatesQuerySchema,
					response: {
						200: CommissionReceiptImportTemplatesResponseSchema,
					},
				},
			},
			async (request) => {
				const { slug } = request.params;
				const { headerSignature } = request.query;
				const userId = await request.getCurrentUserId();
				const { organization } = await request.getUserMembership(slug);

				assertCommissionReceiptImportRateLimit(
					`${organization.id}:${userId}:commission-receipt-import-templates:list`,
					commissionReceiptImportRateLimit.templates,
				);

				const templates = await prisma.saleImportTemplate.findMany({
					where: {
						organizationId: organization.id,
						name: {
							startsWith: COMMISSION_RECEIPT_TEMPLATE_NAME_PREFIX,
						},
					},
					orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
					select: {
						id: true,
						name: true,
						headerSignature: true,
						mappingJson: true,
						createdAt: true,
						updatedAt: true,
						createdBy: {
							select: {
								id: true,
								name: true,
							},
						},
					},
				});

				const parsedTemplates: z.infer<
					typeof CommissionReceiptImportTemplatesResponseSchema
				>["templates"] = [];

				for (const template of templates) {
					if (!isCommissionReceiptTemplateStoredName(template.name)) {
						continue;
					}

					try {
						const parsedName = fromCommissionReceiptStoredTemplateName(
							template.name,
						);
						if (!parsedName) {
							continue;
						}

						parsedTemplates.push({
							id: template.id,
							name: parsedName,
							headerSignature: template.headerSignature,
							mapping: parseCommissionReceiptTemplateMappingJson(
								template.mappingJson,
							),
							createdAt: template.createdAt,
							updatedAt: template.updatedAt,
							createdBy: template.createdBy,
							isSuggested:
								Boolean(headerSignature) &&
								template.headerSignature === headerSignature,
						});
					} catch (error) {
						if (error instanceof BadRequestError) {
							continue;
						}

						throw error;
					}
				}

				parsedTemplates.sort((a, b) => {
					if (a.isSuggested === b.isSuggested) {
						return b.updatedAt.getTime() - a.updatedAt.getTime();
					}

					return a.isSuggested ? -1 : 1;
				});

				return {
					templates: parsedTemplates,
				};
			},
		);
}
