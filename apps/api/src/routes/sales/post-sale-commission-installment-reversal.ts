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
type ProductCommissionReversalMode =
	| "INSTALLMENT_BY_NUMBER"
	| "TOTAL_PAID_PERCENTAGE";

type EffectiveProductReversalConfig =
	| {
			mode: "INSTALLMENT_BY_NUMBER";
			installmentPercentageScaled: number | null;
	  }
	| {
			mode: "TOTAL_PAID_PERCENTAGE";
			totalPaidPercentageScaled: number;
	  }
	| null;

type ProductReversalCandidate = {
	id: string;
	parentId: string | null;
	commissionReversalMode: ProductCommissionReversalMode | null;
	commissionReversalTotalPercentage: number | null;
	commissionReversalRules: Array<{
		installmentNumber: number;
		percentage: number;
	}>;
};

function calculateReversalAmountFromScaledPercentage(
	totalPaidPositiveAmount: number,
	percentageScaled: number,
) {
	const numerator = BigInt(totalPaidPositiveAmount) * BigInt(percentageScaled);
	const amount = Number(
		(numerator + REVERSED_AMOUNT_DENOMINATOR / 2n) /
			REVERSED_AMOUNT_DENOMINATOR,
	);

	return -amount;
}

function inferLocalProductReversalMode(params: {
	storedMode: ProductCommissionReversalMode | null;
	totalPaidPercentageScaled: number | null;
	rulesCount: number;
}) {
	if (params.storedMode) {
		return params.storedMode;
	}

	if (params.totalPaidPercentageScaled !== null) {
		return "TOTAL_PAID_PERCENTAGE";
	}

	if (params.rulesCount > 0) {
		return "INSTALLMENT_BY_NUMBER";
	}

	return null;
}

async function loadEffectiveProductReversalConfig(params: {
	tx: Prisma.TransactionClient;
	organizationId: string;
	productId: string;
	installmentNumber: number;
}): Promise<EffectiveProductReversalConfig> {
	const { tx, organizationId, productId, installmentNumber } = params;
	const visitedProductIds = new Set<string>();
	let currentProductId: string | null = productId;

	while (currentProductId) {
		if (visitedProductIds.has(currentProductId)) {
			break;
		}
		visitedProductIds.add(currentProductId);

		const product: ProductReversalCandidate | null = await tx.product.findFirst(
			{
				where: {
					id: currentProductId,
					organizationId,
				},
				select: {
					id: true,
					parentId: true,
					commissionReversalMode: true,
					commissionReversalTotalPercentage: true,
					commissionReversalRules: {
						orderBy: {
							installmentNumber: "asc",
						},
						select: {
							installmentNumber: true,
							percentage: true,
						},
					},
				},
			},
		);

		if (!product) {
			break;
		}

		const mode = inferLocalProductReversalMode({
			storedMode: product.commissionReversalMode,
			totalPaidPercentageScaled: product.commissionReversalTotalPercentage,
			rulesCount: product.commissionReversalRules.length,
		});

		if (mode === "TOTAL_PAID_PERCENTAGE") {
			if (product.commissionReversalTotalPercentage !== null) {
				return {
					mode,
					totalPaidPercentageScaled: product.commissionReversalTotalPercentage,
				};
			}

			currentProductId = product.parentId;
			continue;
		}

		if (mode === "INSTALLMENT_BY_NUMBER") {
			const matchedRule = product.commissionReversalRules.find(
				(rule) => rule.installmentNumber === installmentNumber,
			);

			if (matchedRule) {
				return {
					mode,
					installmentPercentageScaled: matchedRule.percentage,
				};
			}

			currentProductId = product.parentId;
			continue;
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
							cancelPendingInstallments: z.boolean().optional(),
						})
						.strict(),
					response: {
						204: z.null(),
					},
				},
			},
			async (request, reply) => {
				const { slug, saleId, installmentId } = request.params;
				const { reversalDate, manualAmount, cancelPendingInstallments } =
					request.body;
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
									originInstallmentId: true,
									installmentNumber: true,
									percentage: true,
									status: true,
									amount: true,
									expectedPaymentDate: true,
									paymentDate: true,
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

						if (installment.originInstallmentId) {
							throw new BadRequestError(
								"Reversal must target an original installment, not a reversal movement",
							);
						}

						if (
							installment.status !== "PENDING" &&
							installment.status !== "PAID"
						) {
							throw new BadRequestError(
								"Only pending or paid installments can be reversed",
							);
						}

						const hasLaterPaidInstallment =
							(await tx.saleCommissionInstallment.count({
								where: {
									saleCommissionId: installment.saleCommissionId,
									originInstallmentId: null,
									installmentNumber: {
										gt: installment.installmentNumber,
									},
									status: "PAID",
								},
							})) > 0;

						if (hasLaterPaidInstallment) {
							throw new BadRequestError(
								"Cannot reverse an installment when a later installment is already paid",
							);
						}

						const effectiveConfig = await loadEffectiveProductReversalConfig({
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
						} else if (effectiveConfig?.mode === "INSTALLMENT_BY_NUMBER") {
							if (effectiveConfig.installmentPercentageScaled === null) {
								throw new BadRequestError(
									"Manual amount is required when no reversal rule is configured for this installment",
								);
							}

							const paidAggregate =
								await tx.saleCommissionInstallment.aggregate({
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
								effectiveConfig.installmentPercentageScaled,
							);

							if (reversalAmount >= 0) {
								throw new BadRequestError(
									"No positive paid amount available to calculate reversal",
								);
							}
						} else if (effectiveConfig?.mode === "TOTAL_PAID_PERCENTAGE") {
							const hasAnotherReversedInstallment =
								(await tx.saleCommissionInstallment.count({
									where: {
										saleCommissionId: installment.saleCommissionId,
										status: "REVERSED",
										OR: [
											{
												originInstallmentId: {
													not: null,
												},
											},
											{
												originInstallmentId: null,
												reversedFromStatus: {
													in: ["PENDING", "PAID"],
												},
											},
										],
									},
								})) > 0;

							if (hasAnotherReversedInstallment) {
								throw new BadRequestError(
									"Automatic reversal by total paid can only be applied once per commission",
								);
							}

							const paidAggregate =
								await tx.saleCommissionInstallment.aggregate({
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
								effectiveConfig.totalPaidPercentageScaled,
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

						const existingReversedAggregate =
							await tx.saleCommissionInstallment.aggregate({
								where: {
									originInstallmentId: installment.id,
									status: "REVERSED",
								},
								_sum: {
									amount: true,
								},
							});
						const existingReversedAmountAbsolute = Math.abs(
							existingReversedAggregate._sum.amount ?? 0,
						);
						const remainingReversibleAmount =
							installment.amount - existingReversedAmountAbsolute;
						if (remainingReversibleAmount <= 0) {
							throw new BadRequestError("Installment is already fully reversed");
						}
						let nextReversedAmountAbsolute = Math.abs(reversalAmount);
						if (nextReversedAmountAbsolute > remainingReversibleAmount) {
							if (manualAmount !== undefined) {
								throw new BadRequestError(
									"Reversal amount exceeds the original installment amount",
								);
							}

							reversalAmount = -remainingReversibleAmount;
							nextReversedAmountAbsolute = Math.abs(reversalAmount);
						}

						const isFullDirectReversal =
							existingReversedAmountAbsolute === 0 &&
							nextReversedAmountAbsolute === installment.amount;

						if (isFullDirectReversal) {
							await tx.saleCommissionInstallment.update({
								where: {
									id: installment.id,
								},
								data: {
									status: "REVERSED",
									amount: reversalAmount,
									paymentDate: parseSaleDateInput(reversalDate),
									reversedFromStatus: installment.status,
									reversedFromAmount: installment.amount,
									reversedFromPaymentDate: installment.paymentDate,
								},
							});
						} else {
							await tx.saleCommissionInstallment.create({
								data: {
									saleCommissionId: installment.saleCommissionId,
									originInstallmentId: installment.id,
									installmentNumber: installment.installmentNumber,
									percentage: installment.percentage,
									amount: reversalAmount,
									status: "REVERSED",
									expectedPaymentDate: installment.expectedPaymentDate,
									paymentDate: parseSaleDateInput(reversalDate),
								},
							});
						}

						if (cancelPendingInstallments) {
							const pendingFutureInstallments =
								await tx.saleCommissionInstallment.findMany({
								where: {
									saleCommissionId: installment.saleCommissionId,
									installmentNumber: {
										gt: installment.installmentNumber,
									},
									status: "PENDING",
								},
								select: {
									id: true,
									amount: true,
								},
							});

							for (const pendingInstallment of pendingFutureInstallments) {
								await tx.saleCommissionInstallment.update({
									where: {
										id: pendingInstallment.id,
									},
									data: {
										status: "CANCELED",
										amount: 0,
										paymentDate: null,
										reversedFromStatus: "PENDING",
										reversedFromAmount: pendingInstallment.amount,
										reversedFromPaymentDate: null,
									},
								});
							}
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
