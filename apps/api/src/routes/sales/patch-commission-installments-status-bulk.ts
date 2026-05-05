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
import {
	parseSaleDateInput,
	PatchCommissionInstallmentsStatusBulkBodySchema,
	PatchCommissionInstallmentsStatusBulkResponseSchema,
	type PatchCommissionInstallmentsStatusBulkSkippedReason,
} from "./sale-schemas";

type BulkInstallmentStatusTarget = "PENDING" | "PAID" | "CANCELED";

type BulkInstallmentCandidate = {
	id: string;
	status: SaleCommissionInstallmentStatus;
	saleId: string;
	saleStatus: SaleStatus;
};

function canUpdateInstallmentBySaleStatus(saleStatus: SaleStatus) {
	return saleStatus === SaleStatus.COMPLETED;
}

function isValidBulkInstallmentStatusTransition(params: {
	from: SaleCommissionInstallmentStatus;
	to: BulkInstallmentStatusTarget;
}) {
	const { from, to } = params;

	if (to === "PAID") {
		return from === "PENDING";
	}

	if (to === "CANCELED") {
		return from === "PENDING";
	}

	return from === "PAID" || from === "CANCELED";
}

export async function patchCommissionInstallmentsStatusBulk(
	app: FastifyInstance,
) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.patch(
			"/organizations/:slug/commissions/installments/status/bulk",
			{
				schema: {
					tags: ["sales"],
					summary: "Bulk update commission installments status",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
					}),
					body: PatchCommissionInstallmentsStatusBulkBodySchema,
					response: {
						200: PatchCommissionInstallmentsStatusBulkResponseSchema,
					},
				},
			},
			async (request) => {
				const { slug } = request.params;
				const { installmentIds, status, paymentDate, reversalDate } =
					request.body;
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

				const uniqueInstallmentIds = Array.from(new Set(installmentIds));
				const installments = await prisma.saleCommissionInstallment.findMany({
					where: {
						id: {
							in: uniqueInstallmentIds,
						},
						saleCommission: {
							sale: {
								organizationId: organization.id,
							},
							...(saleCommissionsVisibilityWhere ?? {}),
						},
					},
					select: {
						id: true,
						status: true,
						saleCommission: {
							select: {
								saleId: true,
								sale: {
									select: {
										status: true,
									},
								},
							},
						},
					},
				});

				if (installments.length !== uniqueInstallmentIds.length) {
					throw new BadRequestError(
						"One or more commission installments were not found",
					);
				}

				const installmentsById = new Map(
					installments.map((installment) => [
						installment.id,
						{
							id: installment.id,
							status: installment.status,
							saleId: installment.saleCommission.saleId,
							saleStatus: installment.saleCommission.sale.status,
						} satisfies BulkInstallmentCandidate,
					]),
				);

				const eligibleInstallments: BulkInstallmentCandidate[] = [];
				const skipped: Array<{
					installmentId: string;
					reason: PatchCommissionInstallmentsStatusBulkSkippedReason;
				}> = [];

				for (const installmentId of uniqueInstallmentIds) {
					const installment = installmentsById.get(installmentId);

					if (!installment) {
						continue;
					}

					if (installment.status === SaleCommissionInstallmentStatus.REVERSED) {
						skipped.push({
							installmentId: installment.id,
							reason: "REVERSED_NOT_ALLOWED",
						});
						continue;
					}

					if (!canUpdateInstallmentBySaleStatus(installment.saleStatus)) {
						skipped.push({
							installmentId: installment.id,
							reason: "SALE_NOT_EDITABLE",
						});
						continue;
					}

					if (
						!isValidBulkInstallmentStatusTransition({
							from: installment.status,
							to: status,
						})
					) {
						skipped.push({
							installmentId: installment.id,
							reason: "INVALID_STATUS_TRANSITION",
						});
						continue;
					}

					eligibleInstallments.push(installment);
				}

				const parsedPaymentDate =
					status === "PAID" && paymentDate ? parseSaleDateInput(paymentDate) : null;
				const parsedCancellationDate =
					status === "CANCELED" && reversalDate
						? parseSaleDateInput(reversalDate)
						: null;

				if (eligibleInstallments.length > 0) {
					await db(() =>
						prisma.$transaction(async (tx) => {
							const affectedSaleIds = Array.from(
								new Set(
									eligibleInstallments.map((installment) => installment.saleId),
								),
							);
							const beforeSnapshotsBySaleId = new Map<string, Awaited<
								ReturnType<typeof loadSaleHistorySnapshot>
							>>();

							for (const saleId of affectedSaleIds) {
								const beforeSnapshot = await loadSaleHistorySnapshot(
									tx,
									saleId,
									organization.id,
								);

								if (!beforeSnapshot) {
									throw new BadRequestError("Sale not found");
								}

								beforeSnapshotsBySaleId.set(saleId, beforeSnapshot);
							}

							await tx.saleCommissionInstallment.updateMany({
								where: {
									id: {
										in: eligibleInstallments.map((installment) => installment.id),
									},
								},
								data: {
									status,
									...(status === "CANCELED" ? { amount: 0 } : {}),
									paymentDate:
										status === "PAID"
											? parsedPaymentDate
											: status === "CANCELED"
												? parsedCancellationDate
												: null,
									reversedFromStatus: null,
									reversedFromAmount: null,
									reversedFromPaymentDate: null,
								},
							});

							for (const saleId of affectedSaleIds) {
								const beforeSnapshot = beforeSnapshotsBySaleId.get(saleId);
								if (!beforeSnapshot) {
									throw new BadRequestError("Sale not found");
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
							}
						}),
					);
				}

				return {
					updatedCount: eligibleInstallments.length,
					skipped,
				};
			},
		);
}
