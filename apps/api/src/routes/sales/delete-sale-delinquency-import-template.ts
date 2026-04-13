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
import { isSaleDelinquencyTemplateStoredName } from "./sale-delinquency-import-template-utils";

export async function deleteSaleDelinquencyImportTemplate(
	app: FastifyInstance,
) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.delete(
			"/organizations/:slug/sales/delinquency/import-templates/:templateId",
			{
				schema: {
					tags: ["sales"],
					summary: "Delete sale delinquency import template",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
						templateId: z.uuid(),
					}),
					response: {
						204: z.null(),
					},
				},
			},
			async (request, reply) => {
				const { slug, templateId } = request.params;
				const userId = await request.getCurrentUserId();
				const { organization } = await request.getUserMembership(slug);

				assertSaleDelinquencyImportRateLimit(
					`${organization.id}:${userId}:sale-delinquency-import-templates:delete`,
					saleDelinquencyImportRateLimit.templates,
				);

				const existing = await prisma.saleImportTemplate.findFirst({
					where: {
						id: templateId,
						organizationId: organization.id,
					},
					select: {
						id: true,
						name: true,
					},
				});

				if (!existing || !isSaleDelinquencyTemplateStoredName(existing.name)) {
					throw new BadRequestError("Sale delinquency import template not found");
				}

				await prisma.saleImportTemplate.delete({
					where: {
						id: existing.id,
					},
				});

				return reply.status(204).send();
			},
		);
}
