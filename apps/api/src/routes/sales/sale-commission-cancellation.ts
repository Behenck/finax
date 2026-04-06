import type { Prisma } from "generated/prisma/client";
import { SaleCommissionInstallmentStatus } from "generated/prisma/enums";
import { parseSaleDateInput } from "./sale-schemas";

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

export type CancelInstallmentTarget = {
	id: string;
	originInstallmentId: string | null;
	saleCommissionId: string;
	installmentNumber: number;
	percentage: number;
	amount: number;
	status: SaleCommissionInstallmentStatus;
	expectedPaymentDate: Date;
	paymentDate: Date | null;
	productId: string;
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

		const product: ProductReversalCandidate | null = await tx.product.findFirst({
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
		});

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

export async function applyInstallmentCancellationWithAutomaticReversal(params: {
	tx: Prisma.TransactionClient;
	organizationId: string;
	targetInstallment: CancelInstallmentTarget;
	reversalDate: string;
	targetAmount?: number;
	targetPercentage?: number;
	targetExpectedPaymentDate?: Date;
}) {
	const {
		tx,
		organizationId,
		targetInstallment,
		reversalDate,
		targetAmount,
		targetPercentage,
		targetExpectedPaymentDate,
	} = params;

	const finalTargetAmount = targetAmount ?? targetInstallment.amount;
	const finalTargetPercentage = targetPercentage ?? targetInstallment.percentage;
	const finalTargetExpectedPaymentDate =
		targetExpectedPaymentDate ?? targetInstallment.expectedPaymentDate;

	await tx.saleCommissionInstallment.update({
		where: {
			id: targetInstallment.id,
		},
		data: {
			status: SaleCommissionInstallmentStatus.CANCELED,
			amount: 0,
			percentage: finalTargetPercentage,
			expectedPaymentDate: finalTargetExpectedPaymentDate,
			paymentDate: null,
			reversedFromStatus: targetInstallment.status,
			reversedFromAmount: targetInstallment.amount,
			reversedFromPaymentDate: targetInstallment.paymentDate,
		},
	});

	const pendingFutureInstallments = await tx.saleCommissionInstallment.findMany({
		where: {
			saleCommissionId: targetInstallment.saleCommissionId,
			installmentNumber: {
				gt: targetInstallment.installmentNumber,
			},
			status: SaleCommissionInstallmentStatus.PENDING,
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
				status: SaleCommissionInstallmentStatus.CANCELED,
				amount: 0,
				paymentDate: null,
				reversedFromStatus: SaleCommissionInstallmentStatus.PENDING,
				reversedFromAmount: pendingInstallment.amount,
				reversedFromPaymentDate: null,
			},
		});
	}

	if (targetInstallment.originInstallmentId) {
		return;
	}

	const effectiveConfig = await loadEffectiveProductReversalConfig({
		tx,
		organizationId,
		productId: targetInstallment.productId,
		installmentNumber: targetInstallment.installmentNumber,
	});

	let reversalAmount: number | null = null;

	if (effectiveConfig?.mode === "INSTALLMENT_BY_NUMBER") {
		if (effectiveConfig.installmentPercentageScaled !== null) {
			const paidAggregate = await tx.saleCommissionInstallment.aggregate({
				where: {
					saleCommissionId: targetInstallment.saleCommissionId,
					status: SaleCommissionInstallmentStatus.PAID,
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
		}
	} else if (effectiveConfig?.mode === "TOTAL_PAID_PERCENTAGE") {
		const hasAnotherAutomaticReversedInstallment =
			(await tx.saleCommissionInstallment.count({
				where: {
					saleCommissionId: targetInstallment.saleCommissionId,
					status: SaleCommissionInstallmentStatus.REVERSED,
					OR: [
						{
							originInstallmentId: {
								not: null,
							},
						},
						{
							originInstallmentId: null,
							reversedFromStatus: {
								in: [
									SaleCommissionInstallmentStatus.PENDING,
									SaleCommissionInstallmentStatus.PAID,
								],
							},
						},
					],
				},
			})) > 0;

		if (!hasAnotherAutomaticReversedInstallment) {
			const paidAggregate = await tx.saleCommissionInstallment.aggregate({
				where: {
					saleCommissionId: targetInstallment.saleCommissionId,
					status: SaleCommissionInstallmentStatus.PAID,
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
		}
	}

	if (reversalAmount === null || reversalAmount >= 0 || finalTargetAmount <= 0) {
		return;
	}

	const existingReversedAggregate = await tx.saleCommissionInstallment.aggregate({
		where: {
			originInstallmentId: targetInstallment.id,
			status: SaleCommissionInstallmentStatus.REVERSED,
		},
		_sum: {
			amount: true,
		},
	});
	const existingReversedAmountAbsolute = Math.abs(
		existingReversedAggregate._sum.amount ?? 0,
	);
	const nextReversedAmountAbsolute = Math.abs(reversalAmount);

	if (existingReversedAmountAbsolute + nextReversedAmountAbsolute > finalTargetAmount) {
		return;
	}

	await tx.saleCommissionInstallment.create({
		data: {
			saleCommissionId: targetInstallment.saleCommissionId,
			originInstallmentId: targetInstallment.id,
			installmentNumber: targetInstallment.installmentNumber,
			percentage: finalTargetPercentage,
			amount: reversalAmount,
			status: SaleCommissionInstallmentStatus.REVERSED,
			expectedPaymentDate: finalTargetExpectedPaymentDate,
			paymentDate: parseSaleDateInput(reversalDate),
		},
	});
}
