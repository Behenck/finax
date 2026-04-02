import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { Prisma } from "generated/prisma/client";
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
import { parseSaleDateInput, SaleDateInputSchema } from "./sale-schemas";

const REVERSED_AMOUNT_DENOMINATOR = BigInt(100 * 10_000);

function calculateReversalAmountFromScaledPercentage(
	totalPaidPositiveAmount: number,
	percentageScaled: number,
) {
	const numerator =
		BigInt(totalPaidPositiveAmount) * BigInt(percentageScaled);
	const amount = Number(
		(numerator + REVERSED_AMOUNT_DENOMINATOR / 2n) /
			REVERSED_AMOUNT_DENOMINATOR,
	);

	return -amount;
}

async function loadInstallmentReversalPercentage(params: {
	tx: Prisma.TransactionClient;
	organizationId: string;
	productId: string;
	installmentNumber: number;
}) {
	const { tx, organizationId, productId, installmentNumber } = params;
	const visitedProductIds = new Set<string>();
	let currentProductId: string | null = productId;

	while (currentProductId) {
		if (visitedProductIds.has(currentProductId)) {
			break;
		}
		visitedProductIds.add(currentProductId);

		const product: {
			id: string;
			parentId: string | null;
		} | null = await tx.product.findFirst({
			where: {
				id: currentProductId,
				organizationId,
			},
			select: {
				id: true,
				parentId: true,
			},
		});

		if (!product) {
			break;
		}

		const rules = await tx.productCommissionReversalRule.findMany({
			where: {
				productId: product.id,
			},
			orderBy: {
				installmentNumber: "asc",
			},
			select: {
				installmentNumber: true,
				percentage: true,
			},
		});

		if (rules.length > 0) {
			const matchedRule = rules.find(
				(rule) => rule.installmentNumber === installmentNumber,
			);
			return matchedRule?.percentage ?? null;
		}

		currentProductId = product.parentId;
	}

	return null;
}

export async function postSaleCommissionInstallmentReversal(
	app: FastifyInstance,
) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.post(
			"/organizations/:slug/sales/:saleId/commission-installments/:installmentId/reversal",
			{
				schema: {
					tags: ["sales"],
					summary: "Reverse sale commission installment",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
						saleId: z.uuid(),
						installmentId: z.uuid(),
					}),
					body: z
						.object({
							reversalDate: SaleDateInputSchema,
							manualAmount: z.number().int().max(-1).optional(),
						})
						.strict(),
					response: {
						204: z.null(),
					},
				},
			},
			async (request, reply) => {
				const { slug, saleId, installmentId } = request.params;
				const { reversalDate, manualAmount } = request.body;
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
								installmentNumber: true,
								status: true,
								saleCommissionId: true,
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

						if (
							installment.status !== "PENDING" &&
							installment.status !== "PAID"
						) {
							throw new BadRequestError(
								"Only pending or paid installments can be reversed",
							);
						}

						const reversalPercentage = await loadInstallmentReversalPercentage({
							tx,
							organizationId: organization.id,
							productId: installment.saleCommission.sale.productId,
							installmentNumber: installment.installmentNumber,
						});

						let reversalAmount: number;
						if (manualAmount !== undefined) {
							if (manualAmount >= 0) {
								throw new BadRequestError(
									"Manual amount must be negative for reversal",
								);
							}

							reversalAmount = manualAmount;
						} else if (reversalPercentage !== null) {
							const paidAggregate = await tx.saleCommissionInstallment.aggregate({
								where: {
									saleCommissionId: installment.saleCommissionId,
									status: "PAID",
									amount: {
										gt: 0,
									},
								},
								_sum: {
									amount: true,
								},
							});

							const totalPaidPositiveAmount = paidAggregate._sum.amount ?? 0;
							reversalAmount = calculateReversalAmountFromScaledPercentage(
								totalPaidPositiveAmount,
								reversalPercentage,
							);

							if (reversalAmount >= 0) {
								throw new BadRequestError(
									"No positive paid amount available to calculate reversal",
								);
							}
						} else {
							throw new BadRequestError(
								"Manual amount is required when no reversal rule is configured for this installment",
							);
						}

						await tx.saleCommissionInstallment.update({
							where: {
								id: installment.id,
							},
							data: {
								status: "REVERSED",
								amount: reversalAmount,
								paymentDate: parseSaleDateInput(reversalDate),
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
