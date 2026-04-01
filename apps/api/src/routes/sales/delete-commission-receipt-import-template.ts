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
import { isCommissionReceiptTemplateStoredName } from "./commission-receipt-import-template-utils";

export async function deleteCommissionReceiptImportTemplate(
	app: FastifyInstance,
) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.delete(
			"/organizations/:slug/commissions/receipts/import-templates/:templateId",
			{
				schema: {
					tags: ["sales"],
					summary: "Delete commission receipt import template",
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

				assertCommissionReceiptImportRateLimit(
					`${organization.id}:${userId}:commission-receipt-import-templates:delete`,
					commissionReceiptImportRateLimit.templates,
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

				if (
					!existing ||
					!isCommissionReceiptTemplateStoredName(existing.name)
				) {
					throw new BadRequestError(
						"Commission receipt import template not found",
					);
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
