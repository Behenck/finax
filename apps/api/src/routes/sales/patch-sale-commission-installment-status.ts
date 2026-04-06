import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { SaleHistoryAction, SaleStatus } from "generated/prisma/enums";
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
import {
	PatchSaleCommissionInstallmentStatusBodySchema,
	parseSaleDateInput,
} from "./sale-schemas";
import { applyInstallmentCancellationWithAutomaticReversal } from "./sale-commission-cancellation";

function getCurrentDateUtc() {
	const now = new Date();
	return new Date(
		Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
	);
}

export async function patchSaleCommissionInstallmentStatus(
	app: FastifyInstance,
) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.patch(
			"/organizations/:slug/sales/:saleId/commission-installments/:installmentId/status",
			{
				schema: {
					tags: ["sales"],
					summary: "Update sale commission installment status",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
						saleId: z.uuid(),
						installmentId: z.uuid(),
					}),
					body: PatchSaleCommissionInstallmentStatusBodySchema,
					response: {
						204: z.null(),
					},
				},
			},
			async (request, reply) => {
				const { slug, saleId, installmentId } = request.params;
				const { status, paymentDate, reversalDate, amount } = request.body;
				const actorId = await request.getCurrentUserId();
				const { organization, membership } = await request.getUserMembership(slug);
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

				const installment = await prisma.saleCommissionInstallment.findFirst({
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
						originInstallmentId: true,
						saleCommissionId: true,
						installmentNumber: true,
						percentage: true,
						amount: true,
						expectedPaymentDate: true,
						status: true,
						paymentDate: true,
						saleCommission: {
							select: {
								sale: {
									select: {
										productId: true,
									},
								},
							},
						},
					},
				});

				if (!installment) {
					throw new BadRequestError("Commission installment not found");
				}

				await db(() =>
					prisma.$transaction(async (tx) => {
						if (status === "CANCELED") {
							if (!reversalDate) {
								throw new BadRequestError(
									"reversalDate is required when status is CANCELED",
								);
							}

							await applyInstallmentCancellationWithAutomaticReversal({
								tx,
								organizationId: organization.id,
								targetInstallment: {
									id: installment.id,
									originInstallmentId: installment.originInstallmentId,
									saleCommissionId: installment.saleCommissionId,
									installmentNumber: installment.installmentNumber,
									percentage: installment.percentage,
									amount: installment.amount,
									status: installment.status,
									expectedPaymentDate: installment.expectedPaymentDate,
									paymentDate: installment.paymentDate,
									productId: installment.saleCommission.sale.productId,
								},
								reversalDate,
								targetAmount: amount,
							});
						} else {
							await tx.saleCommissionInstallment.update({
								where: {
									id: installment.id,
								},
								data: {
									status,
									paymentDate:
										paymentDate
											? parseSaleDateInput(paymentDate)
											: installment.status === "PAID" &&
													installment.paymentDate
												? installment.paymentDate
												: getCurrentDateUtc(),
									...(amount === undefined ? {} : { amount }),
									reversedFromStatus: null,
									reversedFromAmount: null,
									reversedFromPaymentDate: null,
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
							action: SaleHistoryAction.COMMISSION_INSTALLMENT_STATUS_UPDATED,
							beforeSnapshot,
							afterSnapshot,
						});
					}),
				);

				return reply.status(204).send();
			},
		);
}
