import { db } from "@/lib/db";
import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import {
	SaleCommissionInstallmentStatus,
	SaleHistoryAction,
	PartnerStatus,
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
import {
	PatchSalesStatusBulkBodySchema,
	PatchSalesStatusBulkResponseSchema,
} from "./sale-schemas";
import { isValidSaleStatusTransition } from "./sale-status-transition";
import {
	cancelPendingSaleTransactionForSale,
	createOrSyncSaleTransactionOnSaleCompleted,
} from "./sale-transactions";

export async function patchSalesStatusBulk(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.patch(
			"/organizations/:slug/sales/status/bulk",
			{
				schema: {
					tags: ["sales"],
					summary: "Bulk update sales status",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
					}),
					body: PatchSalesStatusBulkBodySchema,
					response: {
						200: PatchSalesStatusBulkResponseSchema,
					},
				},
			},
			async (request) => {
				const { slug } = request.params;
				const { saleIds, status } = request.body;
				const actorId = await request.getCurrentUserId();

				const organization = await prisma.organization.findUnique({
					where: {
						slug,
					},
					select: {
						id: true,
						enableSalesTransactionsSync: true,
					},
				});

				if (!organization) {
					throw new BadRequestError("Organization not found");
				}

				const uniqueSaleIds = Array.from(new Set(saleIds));

				const sales = await prisma.sale.findMany({
					where: {
						organizationId: organization.id,
						id: {
							in: uniqueSaleIds,
						},
					},
					select: {
						id: true,
						status: true,
						responsibleType: true,
						responsibleId: true,
					},
				});

				if (sales.length !== uniqueSaleIds.length) {
					throw new BadRequestError("One or more sales were not found");
				}

				const invalidSale = sales.find((sale) => {
					return !isValidSaleStatusTransition(sale.status, status);
				});

				if (invalidSale) {
					throw new BadRequestError(
						`Cannot change sale status from ${invalidSale.status} to ${status}`,
					);
				}

				await db(() =>
					prisma.$transaction(async (tx) => {
						for (const sale of sales) {
							const beforeSnapshot = await loadSaleHistorySnapshot(
								tx,
								sale.id,
								organization.id,
							);

							if (!beforeSnapshot) {
								throw new BadRequestError("Sale not found");
							}

							await tx.sale.update({
								where: {
									id: sale.id,
								},
								data: {
									status,
								},
							});

							if (status === SaleStatus.CANCELED) {
								await tx.saleCommissionInstallment.updateMany({
									where: {
										saleCommission: {
											saleId: sale.id,
										},
										status: {
											not: SaleCommissionInstallmentStatus.REVERSED,
										},
									},
									data: {
										status: SaleCommissionInstallmentStatus.CANCELED,
										amount: 0,
										paymentDate: null,
									},
								});
							}

							if (organization.enableSalesTransactionsSync) {
								if (status === SaleStatus.COMPLETED) {
									await createOrSyncSaleTransactionOnSaleCompleted(tx, {
										saleId: sale.id,
										organizationId: organization.id,
										actorId,
										completedAt: new Date(),
									});
								}

								if (status === SaleStatus.CANCELED) {
									await cancelPendingSaleTransactionForSale(tx, {
										saleId: sale.id,
										organizationId: organization.id,
									});
								}
							}

							if (
								status === SaleStatus.COMPLETED &&
								sale.responsibleType === "PARTNER" &&
								sale.responsibleId
							) {
								await tx.partner.updateMany({
									where: {
										id: sale.responsibleId,
										organizationId: organization.id,
										status: PartnerStatus.INACTIVE,
									},
									data: {
										status: PartnerStatus.ACTIVE,
									},
								});
							}

							const afterSnapshot = await loadSaleHistorySnapshot(
								tx,
								sale.id,
								organization.id,
							);

							if (!afterSnapshot) {
								throw new BadRequestError("Sale not found");
							}

							await createSaleDiffHistoryEvent(tx, {
								saleId: sale.id,
								organizationId: organization.id,
								actorId,
								action: SaleHistoryAction.STATUS_CHANGED,
								beforeSnapshot,
								afterSnapshot,
							});
						}
					}),
				);

				return {
					updated: sales.length,
				};
			},
		);
}
