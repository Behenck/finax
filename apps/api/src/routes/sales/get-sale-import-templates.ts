import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import { auth } from "@/middleware/auth";
import { prisma } from "@/lib/prisma";
import { BadRequestError } from "../_errors/bad-request-error";
import { assertRateLimit, saleImportRateLimit } from "./sale-import-rate-limit";
import {
	GetSaleImportTemplatesQuerySchema,
	SaleImportTemplatesResponseSchema,
} from "./sale-import-schemas";
import {
	parseTemplateFixedValuesJson,
	parseTemplateMappingJson,
} from "./sale-import-template-utils";

export async function getSaleImportTemplates(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.get(
			"/organizations/:slug/sales/import-templates",
			{
				schema: {
					tags: ["sales"],
					summary: "List sale import templates",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
					}),
					querystring: GetSaleImportTemplatesQuerySchema,
					response: {
						200: SaleImportTemplatesResponseSchema,
					},
				},
			},
			async (request) => {
				const { slug } = request.params;
				const { headerSignature } = request.query;
				const userId = await request.getCurrentUserId();
				const { organization } = await request.getUserMembership(slug);

				assertRateLimit(
					`${organization.id}:${userId}:sale-import-templates:list`,
					saleImportRateLimit.templates,
				);

				const templates = await prisma.saleImportTemplate.findMany({
					where: {
						organizationId: organization.id,
					},
					orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
					select: {
						id: true,
						name: true,
						headerSignature: true,
						mappingJson: true,
						fixedValuesJson: true,
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
					typeof SaleImportTemplatesResponseSchema
				>["templates"] = [];

				for (const template of templates) {
					try {
						const parsedMapping = parseTemplateMappingJson(template.mappingJson);
						const parsedFixedValues = parseTemplateFixedValuesJson(
							template.fixedValuesJson,
							{
								fallbackProductId:
									parsedMapping.dynamicByProduct[0]?.productId,
							},
						);

						parsedTemplates.push({
							id: template.id,
							name: template.name,
							headerSignature: template.headerSignature,
							mapping: parseTemplateMappingJson(template.mappingJson, {
								selectedProductId: parsedFixedValues.parentProductId,
							}),
							fixedValues: parsedFixedValues,
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
