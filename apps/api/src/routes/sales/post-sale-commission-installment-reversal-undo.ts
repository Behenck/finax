import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import {
	SaleCommissionInstallmentStatus,
	SaleHistoryAction,
	SaleStatus,
} from "generated/prisma/enums";
import z from "zod";
import { db } from "@/lib/db";
import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import {
	buildSaleCommissionsBeneficiaryVisibilityWhere,
	loadMemberDataVisibilityContext,
} from "@/permissions/data-visibility";
import { BadRequestError } from "../_errors/bad-request-error";
import {
	createSaleDiffHistoryEvent,
	loadSaleHistorySnapshot,
} from "./sale-history";

export async function postSaleCommissionInstallmentReversalUndo(
	app: FastifyInstance,
) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.post(
			"/organizations/:slug/sales/:saleId/commission-installments/:installmentId/reversal/undo",
			{
				schema: {
					tags: ["sales"],
					summary: "Undo sale commission installment reversal",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
						saleId: z.uuid(),
						installmentId: z.uuid(),
					}),
					response: {
						204: z.null(),
					},
				},
			},
			async (request, reply) => {
				const { slug, saleId, installmentId } = request.params;
				const actorId = await request.getCurrentUserId();
				const { organization, membership } =
					await request.getUserMembership(slug);

				const canViewAllCommissions = await request.hasPermission(
					slug,
					"sales.commissions.view.all",
				);
				const visibilityContext = await loadMemberDataVisibilityContext({
					organizationId: organization.id,
					memberId: membership.id,
					userId: membership.userId,
					customersScope: membership.customersScope,
					salesScope: membership.salesScope,
					commissionsScope: membership.commissionsScope,
				});
				const saleCommissionsVisibilityWhere = canViewAllCommissions
					? undefined
					: buildSaleCommissionsBeneficiaryVisibilityWhere(visibilityContext);

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

				if (sale.status === SaleStatus.PENDING) {
					throw new BadRequestError(
						"Cannot update commission installments while sale is pending",
					);
				}

				if (sale.status === SaleStatus.CANCELED) {
					throw new BadRequestError(
						"Cannot update commission installments for canceled sale",
					);
				}

				const beforeSnapshot = await loadSaleHistorySnapshot(
					prisma,
					saleId,
					organization.id,
				);

				if (!beforeSnapshot) {
					throw new BadRequestError("Sale not found");
				}

				await db(() =>
					prisma.$transaction(async (tx) => {
						const installment = await tx.saleCommissionInstallment.findFirst({
							where: {
								id: installmentId,
								saleCommission: {
									saleId,
									sale: {
										organizationId: organization.id,
									},
									...(saleCommissionsVisibilityWhere ?? {}),
								},
							},
							select: {
								id: true,
								status: true,
								originInstallmentId: true,
								saleCommissionId: true,
								installmentNumber: true,
								reversedFromStatus: true,
								reversedFromAmount: true,
								reversedFromPaymentDate: true,
							},
						});

						if (!installment) {
							throw new BadRequestError("Commission installment not found");
						}

						if (installment.status !== "REVERSED") {
							throw new BadRequestError(
								"Only reversed installments can be restored",
							);
						}

						if (installment.originInstallmentId) {
							const originInstallment =
								await tx.saleCommissionInstallment.findFirst({
									where: {
										id: installment.originInstallmentId,
										saleCommission: {
											saleId,
											sale: {
												organizationId: organization.id,
											},
											...(saleCommissionsVisibilityWhere ?? {}),
										},
									},
									select: {
										saleCommissionId: true,
										installmentNumber: true,
									},
								});

							if (!originInstallment) {
								throw new BadRequestError("Commission installment not found");
							}

							const canceledInstallmentsToRestore =
								await tx.saleCommissionInstallment.findMany({
									where: {
										saleCommissionId: originInstallment.saleCommissionId,
										installmentNumber: {
											gte: originInstallment.installmentNumber,
										},
										status: SaleCommissionInstallmentStatus.CANCELED,
										reversedFromStatus: {
											in: [
												SaleCommissionInstallmentStatus.PENDING,
												SaleCommissionInstallmentStatus.PAID,
											],
										},
									},
									orderBy: {
										installmentNumber: "asc",
									},
									select: {
										id: true,
										reversedFromStatus: true,
										reversedFromAmount: true,
										reversedFromPaymentDate: true,
									},
								});

							for (const canceledInstallment of canceledInstallmentsToRestore) {
								if (
									canceledInstallment.reversedFromStatus !==
										SaleCommissionInstallmentStatus.PENDING &&
									canceledInstallment.reversedFromStatus !==
										SaleCommissionInstallmentStatus.PAID
								) {
									continue;
								}

								await tx.saleCommissionInstallment.update({
									where: {
										id: canceledInstallment.id,
									},
									data: {
										status: canceledInstallment.reversedFromStatus,
										...(canceledInstallment.reversedFromAmount === null
											? {}
											: { amount: canceledInstallment.reversedFromAmount }),
										paymentDate:
											canceledInstallment.reversedFromStatus ===
											SaleCommissionInstallmentStatus.PAID
												? canceledInstallment.reversedFromPaymentDate
												: null,
										reversedFromStatus: null,
										reversedFromAmount: null,
										reversedFromPaymentDate: null,
									},
								});
							}

							await tx.saleCommissionInstallment.delete({
								where: {
									id: installment.id,
								},
							});

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
								action: SaleHistoryAction.COMMISSION_INSTALLMENT_UPDATED,
								beforeSnapshot,
								afterSnapshot,
							});

							return;
						}

						if (
							!installment.reversedFromStatus ||
							installment.reversedFromAmount === null
						) {
							throw new BadRequestError(
								"This reversed installment cannot be restored automatically. Update it manually.",
							);
						}

						if (
							installment.reversedFromStatus !== "PENDING" &&
							installment.reversedFromStatus !== "PAID"
						) {
							throw new BadRequestError(
								"Stored original status is invalid for automatic restore",
							);
						}

						const canceledInstallmentsToRestore =
							await tx.saleCommissionInstallment.findMany({
								where: {
									saleCommissionId: installment.saleCommissionId,
									installmentNumber: {
										gt: installment.installmentNumber,
									},
									status: SaleCommissionInstallmentStatus.CANCELED,
									reversedFromStatus: SaleCommissionInstallmentStatus.PENDING,
								},
								orderBy: {
									installmentNumber: "asc",
								},
								select: {
									id: true,
									reversedFromAmount: true,
								},
							});

						for (const canceledInstallment of canceledInstallmentsToRestore) {
							await tx.saleCommissionInstallment.update({
								where: {
									id: canceledInstallment.id,
								},
								data: {
									status: SaleCommissionInstallmentStatus.PENDING,
									...(canceledInstallment.reversedFromAmount === null
										? {}
										: { amount: canceledInstallment.reversedFromAmount }),
									paymentDate: null,
									reversedFromStatus: null,
									reversedFromAmount: null,
									reversedFromPaymentDate: null,
								},
							});
						}

						await tx.saleCommissionInstallment.update({
							where: {
								id: installment.id,
							},
							data: {
								status: installment.reversedFromStatus,
								amount: installment.reversedFromAmount,
								paymentDate: installment.reversedFromPaymentDate,
								reversedFromStatus: null,
								reversedFromAmount: null,
								reversedFromPaymentDate: null,
							},
						});

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
							action: SaleHistoryAction.COMMISSION_INSTALLMENT_UPDATED,
							beforeSnapshot,
							afterSnapshot,
						});
					}),
				);

				return reply.status(204).send();
			},
		);
}
