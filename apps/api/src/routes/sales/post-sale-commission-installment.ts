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
import { syncSaleCommissionTotalPercentage } from "./sale-commissions";
import {
	parseSaleDateInput,
	PostSaleCommissionInstallmentBodySchema,
	toScaledPercentage,
} from "./sale-schemas";

export async function postSaleCommissionInstallment(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.post(
			"/organizations/:slug/sales/:saleId/commission-installments",
			{
				schema: {
					tags: ["sales"],
					summary: "Create sale commission installment",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
						saleId: z.uuid(),
					}),
					body: PostSaleCommissionInstallmentBodySchema,
					response: {
						204: z.null(),
					},
				},
			},
			async (request, reply) => {
				const { slug, saleId } = request.params;
				const data = request.body;
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
						const saleCommission = await tx.saleCommission.findFirst({
							where: {
								id: data.saleCommissionId,
								saleId,
								sale: {
									organizationId: organization.id,
								},
								...(saleCommissionsVisibilityWhere ?? {}),
							},
							select: {
								id: true,
								installments: {
									orderBy: [
										{ installmentNumber: "desc" },
										{ createdAt: "desc" },
										{ id: "desc" },
									],
									take: 1,
									select: {
										installmentNumber: true,
									},
								},
							},
						});

						if (!saleCommission) {
							throw new BadRequestError("Sale commission not found");
						}

						const nextInstallmentNumber =
							(saleCommission.installments[0]?.installmentNumber ?? 0) + 1;

						await tx.saleCommissionInstallment.create({
							data: {
								saleCommissionId: saleCommission.id,
								originInstallmentId: null,
								installmentNumber: nextInstallmentNumber,
								percentage: toScaledPercentage(data.percentage),
								amount: data.amount,
								status: SaleCommissionInstallmentStatus.PENDING,
								expectedPaymentDate: parseSaleDateInput(
									data.expectedPaymentDate,
								),
								paymentDate: null,
								reversedFromStatus: null,
								reversedFromAmount: null,
								reversedFromPaymentDate: null,
							},
						});

						await syncSaleCommissionTotalPercentage(tx, saleCommission.id);

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
