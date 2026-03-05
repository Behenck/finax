import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import { BadRequestError } from "../_errors/bad-request-error";
import { loadSaleCommissionInstallments } from "./sale-commissions";
import { SaleCommissionInstallmentRowSchema } from "./sale-schemas";

export async function getSaleCommissionInstallments(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.get(
			"/organizations/:slug/sales/:saleId/commission-installments",
			{
				schema: {
					tags: ["sales"],
					summary: "Get sale commission installments",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
						saleId: z.uuid(),
					}),
					response: {
						200: z.object({
							installments: z.array(SaleCommissionInstallmentRowSchema),
						}),
					},
				},
			},
			async (request) => {
				const { slug, saleId } = request.params;

				const organization = await prisma.organization.findUnique({
					where: {
						slug,
					},
					select: {
						id: true,
					},
				});

				if (!organization) {
					throw new BadRequestError("Organization not found");
				}

				const sale = await prisma.sale.findFirst({
					where: {
						id: saleId,
						organizationId: organization.id,
					},
					select: {
						id: true,
					},
				});

				if (!sale) {
					throw new BadRequestError("Sale not found");
				}

				const installments = await loadSaleCommissionInstallments(
					saleId,
					organization.id,
				);

				return {
					installments,
				};
			},
		);
}
