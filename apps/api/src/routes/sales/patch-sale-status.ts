import { db } from "@/lib/db";
import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import { SaleStatus } from "generated/prisma/enums";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import { BadRequestError } from "../_errors/bad-request-error";
import { PatchSaleStatusBodySchema } from "./sale-schemas";

function isValidSaleStatusTransition(from: SaleStatus, to: SaleStatus) {
	if (from === SaleStatus.PENDING) {
		return to === SaleStatus.APPROVED || to === SaleStatus.CANCELED;
	}

	if (from === SaleStatus.APPROVED) {
		return to === SaleStatus.COMPLETED || to === SaleStatus.CANCELED;
	}

	return false;
}

export async function patchSaleStatus(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.patch(
			"/organizations/:slug/sales/:saleId/status",
			{
				schema: {
					tags: ["sales"],
					summary: "Update sale status",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
						saleId: z.uuid(),
					}),
					body: PatchSaleStatusBodySchema,
					response: {
						204: z.null(),
					},
				},
			},
			async (request, reply) => {
				const { slug, saleId } = request.params;
				const { status } = request.body;

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
						status: true,
					},
				});

				if (!sale) {
					throw new BadRequestError("Sale not found");
				}

				if (!isValidSaleStatusTransition(sale.status, status)) {
					throw new BadRequestError(
						`Cannot change sale status from ${sale.status} to ${status}`,
					);
				}

				await db(() =>
					prisma.sale.update({
						where: {
							id: saleId,
						},
						data: {
							status,
						},
					}),
				);

				return reply.status(204).send();
			},
		);
}

