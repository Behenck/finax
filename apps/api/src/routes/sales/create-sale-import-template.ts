import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { Prisma } from "generated/prisma/client";
import z from "zod";
import { db } from "@/lib/db";
import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import {
	CreateSaleImportTemplateBodySchema,
	CreateSaleImportTemplateResponseSchema,
} from "./sale-import-schemas";
import {
	assertImportFixedValuesBelongToOrganization,
	assertTemplateMappingBelongsToOrganization,
} from "./sale-import-template-utils";
import { assertRateLimit, saleImportRateLimit } from "./sale-import-rate-limit";

export async function createSaleImportTemplate(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.post(
			"/organizations/:slug/sales/import-templates",
			{
				schema: {
					tags: ["sales"],
					summary: "Create sale import template",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
					}),
					body: CreateSaleImportTemplateBodySchema,
					response: {
						201: CreateSaleImportTemplateResponseSchema,
					},
				},
			},
			async (request, reply) => {
				const { slug } = request.params;
				const data = request.body;
				const userId = await request.getCurrentUserId();
				const { organization } = await request.getUserMembership(slug);

				assertRateLimit(
					`${organization.id}:${userId}:sale-import-templates:create`,
					saleImportRateLimit.templates,
				);

				await assertImportFixedValuesBelongToOrganization(
					organization.id,
					data.fixedValues,
				);
				await assertTemplateMappingBelongsToOrganization(organization.id, {
					mapping: data.mapping,
					selectedProductId: data.fixedValues.parentProductId,
				});

				const template = await db(() =>
					prisma.saleImportTemplate.upsert({
						where: {
							organizationId_name: {
								organizationId: organization.id,
								name: data.name,
							},
						},
						update: {
							headerSignature: data.headerSignature,
							mappingJson: data.mapping as unknown as Prisma.InputJsonValue,
							fixedValuesJson: data.fixedValues as unknown as Prisma.InputJsonValue,
						},
						create: {
							organizationId: organization.id,
							name: data.name,
							headerSignature: data.headerSignature,
							mappingJson: data.mapping as unknown as Prisma.InputJsonValue,
							fixedValuesJson: data.fixedValues as unknown as Prisma.InputJsonValue,
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
