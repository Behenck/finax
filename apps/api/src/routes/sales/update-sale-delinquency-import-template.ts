import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { Prisma } from "generated/prisma/client";
import z from "zod";
import { db } from "@/lib/db";
import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import { BadRequestError } from "../_errors/bad-request-error";
import {
	assertSaleDelinquencyImportRateLimit,
	saleDelinquencyImportRateLimit,
} from "./sale-delinquency-import-rate-limit";
import { UpdateSaleDelinquencyImportTemplateBodySchema } from "./sale-delinquency-import-schemas";
import {
	isSaleDelinquencyTemplateStoredName,
	toSaleDelinquencyStoredTemplateName,
} from "./sale-delinquency-import-template-utils";

export async function updateSaleDelinquencyImportTemplate(
	app: FastifyInstance,
) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.put(
			"/organizations/:slug/sales/delinquency/import-templates/:templateId",
			{
				schema: {
					tags: ["sales"],
					summary: "Update sale delinquency import template",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
						templateId: z.uuid(),
					}),
					body: UpdateSaleDelinquencyImportTemplateBodySchema,
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

				assertSaleDelinquencyImportRateLimit(
					`${organization.id}:${userId}:sale-delinquency-import-templates:update`,
					saleDelinquencyImportRateLimit.templates,
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
					throw new BadRequestError("Sale delinquency import template not found");
				}

				if (!isSaleDelinquencyTemplateStoredName(existingTemplate.name)) {
					throw new BadRequestError("Sale delinquency import template not found");
				}

				const storedTemplateName = toSaleDelinquencyStoredTemplateName(data.name);

				if (storedTemplateName !== existingTemplate.name) {
					const duplicateTemplate = await prisma.saleImportTemplate.findFirst({
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

					if (duplicateTemplate) {
						throw new BadRequestError(
							"Sale delinquency import template name already exists",
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
								namespace: "SALE_DELINQUENCY_IMPORT",
							} as Prisma.InputJsonValue,
						},
					}),
				);

				return reply.status(204).send();
			},
		);
}
