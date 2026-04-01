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
	PostCommissionReceiptImportPreviewBodySchema,
	PostCommissionReceiptImportPreviewResponseSchema,
} from "./commission-receipt-import-schemas";
import { buildCommissionReceiptImportPreview } from "./commission-receipt-import-service";
import { isCommissionReceiptTemplateStoredName } from "./commission-receipt-import-template-utils";

export async function postCommissionReceiptImportPreview(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.post(
			"/organizations/:slug/commissions/receipts/imports/preview",
			{
				schema: {
					tags: ["sales"],
					summary: "Preview commission receipt import",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
					}),
					body: PostCommissionReceiptImportPreviewBodySchema,
					response: {
						200: PostCommissionReceiptImportPreviewResponseSchema,
					},
				},
			},
			async (request) => {
				const { slug } = request.params;
				const data = request.body;
				const userId = await request.getCurrentUserId();
				const { organization } = await request.getUserMembership(slug);

				assertCommissionReceiptImportRateLimit(
					`${organization.id}:${userId}:commission-receipt-imports:preview`,
					commissionReceiptImportRateLimit.imports,
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

					if (
						!template ||
						!isCommissionReceiptTemplateStoredName(template.name)
					) {
						throw new BadRequestError(
							"Commission receipt import template not found",
						);
					}
				}

				const preview = await buildCommissionReceiptImportPreview({
					prismaClient: prisma,
					organizationId: organization.id,
					rows: data.rows,
					mapping: data.mapping,
				});

				return preview;
			},
		);
}
