import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { Prisma } from "generated/prisma/client";
import z from "zod";
import { db } from "@/lib/db";
import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import { BadRequestError } from "../_errors/bad-request-error";
import { assertRateLimit, saleImportRateLimit } from "./sale-import-rate-limit";
import { UpdateSaleImportTemplateBodySchema } from "./sale-import-schemas";
import {
	assertImportFixedValuesBelongToOrganization,
	assertTemplateMappingBelongsToOrganization,
} from "./sale-import-template-utils";

export async function updateSaleImportTemplate(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.put(
			"/organizations/:slug/sales/import-templates/:templateId",
			{
				schema: {
					tags: ["sales"],
					summary: "Update sale import template",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
						templateId: z.uuid(),
					}),
					body: UpdateSaleImportTemplateBodySchema,
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

				assertRateLimit(
					`${organization.id}:${userId}:sale-import-templates:update`,
					saleImportRateLimit.templates,
				);

				const existingTemplate = await prisma.saleImportTemplate.findFirst({
					where: {
						id: templateId,
						organizationId: organization.id,
					},
					select: {
						id: true,
					},
				});

				if (!existingTemplate) {
					throw new BadRequestError("Sale import template not found");
				}

				await assertImportFixedValuesBelongToOrganization(
					organization.id,
					data.fixedValues,
				);
				await assertTemplateMappingBelongsToOrganization(organization.id, {
					mapping: data.mapping,
					selectedProductId: data.fixedValues.parentProductId,
				});

				const duplicateNameTemplate = await prisma.saleImportTemplate.findFirst({
					where: {
						organizationId: organization.id,
						name: data.name,
						NOT: {
							id: templateId,
						},
					},
					select: {
						id: true,
					},
				});

				if (duplicateNameTemplate) {
					throw new BadRequestError("Sale import template name already exists");
				}

				await db(() =>
					prisma.saleImportTemplate.update({
						where: {
							id: templateId,
						},
						data: {
							name: data.name,
							headerSignature: data.headerSignature,
							mappingJson: data.mapping as unknown as Prisma.InputJsonValue,
							fixedValuesJson: data.fixedValues as unknown as Prisma.InputJsonValue,
						},
					}),
				);

				return reply.status(204).send();
			},
		);
}
