import { db } from "@/lib/db";
import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import {
	SaleHistoryAction,
	SaleCommissionInstallmentStatus,
	SaleStatus,
} from "generated/prisma/enums";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import { BadRequestError } from "../_errors/bad-request-error";
import {
	createSaleDiffHistoryEvent,
	loadSaleHistorySnapshot,
} from "./sale-history";
import { PatchSaleStatusBodySchema } from "./sale-schemas";
import { isValidSaleStatusTransition } from "./sale-status-transition";

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
				const actorId = await request.getCurrentUserId();

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

				const beforeSnapshot = await loadSaleHistorySnapshot(
					prisma,
					saleId,
					organization.id,
				);

				if (!beforeSnapshot) {
					throw new BadRequestError("Sale not found");
				}

				if (!isValidSaleStatusTransition(sale.status, status)) {
					throw new BadRequestError(
						`Cannot change sale status from ${sale.status} to ${status}`,
					);
				}

				await db(() =>
					prisma.$transaction(async (tx) => {
						await tx.sale.update({
							where: {
								id: saleId,
							},
							data: {
								status,
							},
						});

						if (status === SaleStatus.CANCELED) {
							await tx.saleCommissionInstallment.updateMany({
								where: {
									saleCommission: {
										saleId,
									},
								},
								data: {
									status: SaleCommissionInstallmentStatus.CANCELED,
									paymentDate: null,
								},
							});
						}

						const afterSnapshot = await loadSaleHistorySnapshot(
							tx,
							saleId,
							organization.id,
						);

						if (!afterSnapshot) {
							throw new BadRequestError("Sale not found");
						}

						await createSaleDiffHistoryEvent(tx, {
							saleId,
							organizationId: organization.id,
							actorId,
							action: SaleHistoryAction.STATUS_CHANGED,
							beforeSnapshot,
							afterSnapshot,
						});
					}),
				);

				return reply.status(204).send();
			},
		);
}
