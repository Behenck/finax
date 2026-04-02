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
import { syncSaleCommissionTotalPercentage } from "./sale-commissions";
import {
	PatchSaleCommissionInstallmentBodySchema,
	parseSaleDateInput,
	toScaledPercentage,
} from "./sale-schemas";

function getCurrentDateUtc() {
	const now = new Date();
	return new Date(
		Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
	);
}

export async function patchSaleCommissionInstallment(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.patch(
			"/organizations/:slug/sales/:saleId/commission-installments/:installmentId",
			{
				schema: {
					tags: ["sales"],
					summary: "Update sale commission installment",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
						saleId: z.uuid(),
						installmentId: z.uuid(),
					}),
					body: PatchSaleCommissionInstallmentBodySchema,
					response: {
						204: z.null(),
					},
				},
			},
			async (request, reply) => {
				const { slug, saleId, installmentId } = request.params;
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
								saleCommissionId: true,
								status: true,
								amount: true,
								paymentDate: true,
							},
						});

						if (!installment) {
							throw new BadRequestError("Commission installment not found");
						}

						const finalStatus = data.status ?? installment.status;
						const finalAmount = data.amount ?? installment.amount;
						const statusRequiresPaymentDate =
							finalStatus === "PAID" || finalStatus === "REVERSED";

						if (finalStatus === "REVERSED" && finalAmount >= 0) {
							throw new BadRequestError(
								"Reversed installment amount must be a negative value",
							);
						}

						if (finalStatus !== "REVERSED" && finalAmount < 0) {
							throw new BadRequestError(
								"Negative amount is only allowed for reversed installments",
							);
						}

						const nextPaymentDate =
							statusRequiresPaymentDate
								? data.paymentDate !== undefined
									? data.paymentDate
										? parseSaleDateInput(data.paymentDate)
										: null
									: installment.status === finalStatus && installment.paymentDate
										? installment.paymentDate
										: getCurrentDateUtc()
								: null;

						await tx.saleCommissionInstallment.update({
							where: {
								id: installment.id,
							},
							data: {
								...(data.percentage === undefined
									? {}
									: { percentage: toScaledPercentage(data.percentage) }),
								...(data.amount === undefined ? {} : { amount: data.amount }),
								...(data.status === undefined ? {} : { status: data.status }),
								...(data.expectedPaymentDate === undefined
									? {}
									: {
											expectedPaymentDate: parseSaleDateInput(
												data.expectedPaymentDate,
											),
										}),
								paymentDate: nextPaymentDate,
							},
						});

						await syncSaleCommissionTotalPercentage(
							tx,
							installment.saleCommissionId,
						);

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
