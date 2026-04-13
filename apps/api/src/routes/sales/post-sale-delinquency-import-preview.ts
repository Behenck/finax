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
	PostSaleDelinquencyImportPreviewBodySchema,
	PostSaleDelinquencyImportPreviewResponseSchema,
} from "./sale-delinquency-import-schemas";
import { buildSaleDelinquencyImportPreview } from "./sale-delinquency-import-service";
import { isSaleDelinquencyTemplateStoredName } from "./sale-delinquency-import-template-utils";

export async function postSaleDelinquencyImportPreview(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.post(
			"/organizations/:slug/sales/delinquency/imports/preview",
			{
				schema: {
					tags: ["sales"],
					summary: "Preview sale delinquency import",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
					}),
					body: PostSaleDelinquencyImportPreviewBodySchema,
					response: {
						200: PostSaleDelinquencyImportPreviewResponseSchema,
					},
				},
			},
			async (request) => {
				const { slug } = request.params;
				const data = request.body;
				const userId = await request.getCurrentUserId();
				const { organization } = await request.getUserMembership(slug);

				assertSaleDelinquencyImportRateLimit(
					`${organization.id}:${userId}:sale-delinquency-imports:preview`,
					saleDelinquencyImportRateLimit.imports,
				);

				if (data.templateId) {
					const template = await prisma.saleImportTemplate.findFirst({
						where: {
							id: data.templateId,
							organizationId: organization.id,
						},
						select: {
							id: true,
							name: true,
						},
					});

					if (!template || !isSaleDelinquencyTemplateStoredName(template.name)) {
						throw new BadRequestError(
							"Sale delinquency import template not found",
						);
					}
				}

				return buildSaleDelinquencyImportPreview({
					prismaClient: prisma,
					organizationId: organization.id,
					importDate: data.importDate,
					rows: data.rows,
					mapping: data.mapping,
				});
			},
		);
}
