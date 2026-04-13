import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import { BadRequestError } from "../_errors/bad-request-error";
import {
	assertSaleDelinquencyImportRateLimit,
	saleDelinquencyImportRateLimit,
} from "./sale-delinquency-import-rate-limit";
import {
	GetSaleDelinquencyImportTemplatesQuerySchema,
	SaleDelinquencyImportTemplatesResponseSchema,
} from "./sale-delinquency-import-schemas";
import {
	fromSaleDelinquencyStoredTemplateName,
	isSaleDelinquencyTemplateStoredName,
	parseSaleDelinquencyTemplateMappingJson,
	SALE_DELINQUENCY_TEMPLATE_NAME_PREFIX,
} from "./sale-delinquency-import-template-utils";

export async function getSaleDelinquencyImportTemplates(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.get(
			"/organizations/:slug/sales/delinquency/import-templates",
			{
				schema: {
					tags: ["sales"],
					summary: "List sale delinquency import templates",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
					}),
					querystring: GetSaleDelinquencyImportTemplatesQuerySchema,
					response: {
						200: SaleDelinquencyImportTemplatesResponseSchema,
					},
				},
			},
			async (request) => {
				const { slug } = request.params;
				const { headerSignature } = request.query;
				const userId = await request.getCurrentUserId();
				const { organization } = await request.getUserMembership(slug);

				assertSaleDelinquencyImportRateLimit(
					`${organization.id}:${userId}:sale-delinquency-import-templates:list`,
					saleDelinquencyImportRateLimit.templates,
				);

				const templates = await prisma.saleImportTemplate.findMany({
					where: {
						organizationId: organization.id,
						name: {
							startsWith: SALE_DELINQUENCY_TEMPLATE_NAME_PREFIX,
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
					typeof SaleDelinquencyImportTemplatesResponseSchema
				>["templates"] = [];

				for (const template of templates) {
					if (!isSaleDelinquencyTemplateStoredName(template.name)) {
						continue;
					}

					try {
						const parsedName = fromSaleDelinquencyStoredTemplateName(template.name);
						if (!parsedName) {
							continue;
						}

						parsedTemplates.push({
							id: template.id,
							name: parsedName,
							headerSignature: template.headerSignature,
							mapping: parseSaleDelinquencyTemplateMappingJson(template.mappingJson),
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
