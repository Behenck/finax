import type { Prisma } from "generated/prisma/client";
import {
	ProductBonusParticipantType,
	ProductBonusPeriodFrequency,
	SaleCommissionDirection,
	SaleCommissionRecipientType,
	SaleResponsibleType,
	SaleStatus,
} from "generated/prisma/enums";
import { BONUS_PERCENTAGE_SCALE } from "../products/bonus-scenarios-schema";
import { BadRequestError } from "../_errors/bad-request-error";

const BONUS_AMOUNT_DENOMINATOR = BigInt(100 * BONUS_PERCENTAGE_SCALE);

export function getCurrentDateUtc() {
	const now = new Date();
	return new Date(
		Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
	);
}

function toScaledAmountFloor(totalAmount: number, percentageScaled: number) {
	const numerator = BigInt(totalAmount) * BigInt(percentageScaled);
	return Number(numerator / BONUS_AMOUNT_DENOMINATOR);
}

function toScaledAmountRounded(totalAmount: number, percentageScaled: number) {
	const numerator = BigInt(totalAmount) * BigInt(percentageScaled);
	return Number(
		(numerator + BONUS_AMOUNT_DENOMINATOR / 2n) / BONUS_AMOUNT_DENOMINATOR,
	);
}

function calculateInstallmentAmountsFromScaled(params: {
	totalAmount: number;
	totalPercentageScaled: number;
	installmentPercentagesScaled: number[];
}) {
	const { totalAmount, totalPercentageScaled, installmentPercentagesScaled } =
		params;

	if (installmentPercentagesScaled.length === 0) {
		return [];
	}

	const baseAmounts = installmentPercentagesScaled.map((percentageScaled) =>
		toScaledAmountFloor(totalAmount, percentageScaled),
	);
	const roundedTotalAmount = toScaledAmountRounded(
		totalAmount,
		totalPercentageScaled,
	);
	const baseTotalAmount = baseAmounts.reduce((sum, amount) => sum + amount, 0);
	const residualAmount = roundedTotalAmount - baseTotalAmount;
	const lastInstallmentIndex = baseAmounts.length - 1;
	const adjustedLastInstallmentAmount =
		(baseAmounts[lastInstallmentIndex] ?? 0) + residualAmount;

	if (adjustedLastInstallmentAmount < 0) {
		throw new BadRequestError("Invalid bonus installment amount calculation");
	}

	return baseAmounts.map((amount, installmentIndex) =>
		installmentIndex === lastInstallmentIndex
			? adjustedLastInstallmentAmount
			: amount,
	);
}

function getPeriodRange(params: {
	periodFrequency: ProductBonusPeriodFrequency;
	periodYear: number;
	periodIndex: number;
}) {
	const { periodFrequency, periodYear, periodIndex } = params;

	if (periodFrequency === ProductBonusPeriodFrequency.ANNUAL) {
		return {
			from: new Date(Date.UTC(periodYear, 0, 1)),
			to: new Date(Date.UTC(periodYear, 11 + 1, 0)),
		};
	}

	if (periodFrequency === ProductBonusPeriodFrequency.SEMIANNUAL) {
		const startMonth = periodIndex === 1 ? 0 : 6;
		const endMonth = startMonth + 5;
		return {
			from: new Date(Date.UTC(periodYear, startMonth, 1)),
			to: new Date(Date.UTC(periodYear, endMonth + 1, 0)),
		};
	}

	const month = periodIndex - 1;
	return {
		from: new Date(Date.UTC(periodYear, month, 1)),
		to: new Date(Date.UTC(periodYear, month + 1, 0)),
	};
}

function isClosedCycle(params: {
	periodFrequency: ProductBonusPeriodFrequency;
	periodYear: number;
	periodIndex: number;
	referenceDate?: Date;
}) {
	const referenceDate = params.referenceDate ?? getCurrentDateUtc();
	const currentYear = referenceDate.getUTCFullYear();
	const currentMonth = referenceDate.getUTCMonth() + 1;

	if (params.periodFrequency === ProductBonusPeriodFrequency.ANNUAL) {
		return params.periodYear < currentYear;
	}

	if (params.periodFrequency === ProductBonusPeriodFrequency.SEMIANNUAL) {
		const currentSemester = currentMonth <= 6 ? 1 : 2;
		return (
			params.periodYear < currentYear ||
			(params.periodYear === currentYear &&
				params.periodIndex < currentSemester)
		);
	}

	return (
		params.periodYear < currentYear ||
		(params.periodYear === currentYear && params.periodIndex < currentMonth)
	);
}

function resolveMonthFixedDayDate(params: {
	year: number;
	month: number;
	day: number;
}) {
	const { year, month, day } = params;
	const lastDayOfMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
	const resolvedDay = Math.min(day, lastDayOfMonth);
	return new Date(Date.UTC(year, month, resolvedDay));
}

function addUtcMonthOffset(params: {
	year: number;
	month: number;
	offset: number;
}) {
	const totalMonths = params.year * 12 + params.month + params.offset;
	return {
		year: Math.floor(totalMonths / 12),
		month: ((totalMonths % 12) + 12) % 12,
	};
}

function resolveFirstDueDate(params: { baseDate: Date; dueDay: number }) {
	const { baseDate, dueDay } = params;
	const baseDateUtc = new Date(
		Date.UTC(
			baseDate.getUTCFullYear(),
			baseDate.getUTCMonth(),
			baseDate.getUTCDate(),
		),
	);
	let candidateDate = resolveMonthFixedDayDate({
		year: baseDateUtc.getUTCFullYear(),
		month: baseDateUtc.getUTCMonth(),
		day: dueDay,
	});

	if (candidateDate.getTime() < baseDateUtc.getTime()) {
		const nextMonth = addUtcMonthOffset({
			year: baseDateUtc.getUTCFullYear(),
			month: baseDateUtc.getUTCMonth(),
			offset: 1,
		});
		candidateDate = resolveMonthFixedDayDate({
			year: nextMonth.year,
			month: nextMonth.month,
			day: dueDay,
		});
	}

	return candidateDate;
}

function resolveInstallmentDueDate(params: {
	firstDueDate: Date;
	installmentOffset: number;
	dueDay: number;
}) {
	const { firstDueDate, installmentOffset, dueDay } = params;
	const shiftedMonth = addUtcMonthOffset({
		year: firstDueDate.getUTCFullYear(),
		month: firstDueDate.getUTCMonth(),
		offset: installmentOffset,
	});
	return resolveMonthFixedDayDate({
		year: shiftedMonth.year,
		month: shiftedMonth.month,
		day: dueDay,
	});
}

function getProductTreeIds(params: {
	products: Array<{
		id: string;
		parentId: string | null;
	}>;
	rootProductId: string;
}) {
	const { products, rootProductId } = params;
	const childrenByParentId = new Map<string, string[]>();

	for (const product of products) {
		if (!product.parentId) {
			continue;
		}

		const currentChildren = childrenByParentId.get(product.parentId) ?? [];
		currentChildren.push(product.id);
		childrenByParentId.set(product.parentId, currentChildren);
	}

	const queue: string[] = [rootProductId];
	const resultIds = new Set<string>();

	while (queue.length > 0) {
		const currentId = queue.shift();
		if (!currentId || resultIds.has(currentId)) {
			continue;
		}

		resultIds.add(currentId);
		const children = childrenByParentId.get(currentId) ?? [];
		for (const childId of children) {
			if (!resultIds.has(childId)) {
				queue.push(childId);
			}
		}
	}

	return Array.from(resultIds);
}

function resolveBeneficiaryLabel(params: {
	type: ProductBonusParticipantType;
	companyName?: string | null;
	partnerName?: string | null;
	sellerName?: string | null;
	supervisorName?: string | null;
	supervisorEmail?: string | null;
}) {
	const {
		type,
		companyName,
		partnerName,
		sellerName,
		supervisorName,
		supervisorEmail,
	} = params;

	if (type === ProductBonusParticipantType.COMPANY) {
		return companyName ?? "Empresa";
	}
	if (type === ProductBonusParticipantType.PARTNER) {
		return partnerName ?? "Parceiro";
	}
	if (type === ProductBonusParticipantType.SELLER) {
		return sellerName ?? "Vendedor";
	}

	return supervisorName ?? supervisorEmail ?? "Supervisor";
}

export function toSaleCommissionRecipientType(
	type: ProductBonusParticipantType,
) {
	if (type === ProductBonusParticipantType.COMPANY) {
		return SaleCommissionRecipientType.COMPANY;
	}
	if (type === ProductBonusParticipantType.PARTNER) {
		return SaleCommissionRecipientType.PARTNER;
	}
	if (type === ProductBonusParticipantType.SELLER) {
		return SaleCommissionRecipientType.SELLER;
	}
	return SaleCommissionRecipientType.SUPERVISOR;
}

type ScenarioWithRelations = {
	id: string;
	name: string;
	targetAmount: number;
	payoutEnabled: boolean;
	payoutTotalPercentage: number | null;
	payoutDueDay: number | null;
	participants: Array<{
		type: ProductBonusParticipantType;
		companyId: string | null;
		partnerId: string | null;
		sellerId: string | null;
		supervisorId: string | null;
		company: { id: string; name: string } | null;
		partner: { id: string; name: string } | null;
		seller: { id: string; name: string } | null;
		supervisor: {
			id: string;
			userId: string;
			user: {
				name: string | null;
				email: string;
			};
		} | null;
	}>;
	payoutInstallments: Array<{
		installmentNumber: number;
		percentage: number;
	}>;
};

export type BonusSettlementWinner = {
	scenarioId: string;
	scenarioName: string;
	participantType: ProductBonusParticipantType;
	recipientType: SaleCommissionRecipientType;
	beneficiaryCompanyId: string | null;
	beneficiaryPartnerId: string | null;
	beneficiarySellerId: string | null;
	beneficiarySupervisorId: string | null;
	beneficiaryLabel: string;
	achievedAmount: number;
	targetAmount: number;
	payoutEnabled: boolean;
	payoutAmount: number;
	payoutTotalPercentage: number;
	payoutDueDay: number;
	payoutInstallments: Array<{
		installmentNumber: number;
		percentage: number;
		amount: number;
		expectedPaymentDate: Date;
	}>;
};

export type BonusSettlementCalculationResult = {
	settlementId: string | null;
	isSettled: boolean;
	product: {
		id: string;
		name: string;
	};
	periodFrequency: ProductBonusPeriodFrequency;
	periodYear: number;
	periodIndex: number;
	periodStart: Date;
	periodEnd: Date;
	settledAt: Date;
	salesCount: number;
	salesTotalAmount: number;
	scenariosCount: number;
	winners: BonusSettlementWinner[];
	installmentsCount: number;
};

export async function calculateBonusSettlementPreview(params: {
	tx: Prisma.TransactionClient;
	organizationId: string;
	productId: string;
	periodFrequency: ProductBonusPeriodFrequency;
	periodYear: number;
	periodIndex: number;
	settledAtDate: Date;
	allowSettled?: boolean;
}) {
	const {
		tx,
		organizationId,
		productId,
		periodFrequency,
		periodYear,
		periodIndex,
		settledAtDate,
		allowSettled = false,
	} = params;

	if (
		!isClosedCycle({
			periodFrequency,
			periodYear,
			periodIndex,
		})
	) {
		throw new BadRequestError("Bonus settlement cycle must be closed");
	}

	const periodRange = getPeriodRange({
		periodFrequency,
		periodYear,
		periodIndex,
	});

	const product = await tx.product.findFirst({
		where: {
			id: productId,
			organizationId,
		},
		select: {
			id: true,
			name: true,
		},
	});

	if (!product) {
		throw new BadRequestError("Product not found");
	}

	const duplicateSettlement = await tx.bonusSettlement.findFirst({
		where: {
			organizationId,
			productId,
			periodFrequency,
			periodYear,
			periodIndex,
		},
		select: {
			id: true,
		},
	});

	if (duplicateSettlement && !allowSettled) {
		throw new BadRequestError("Este ciclo já foi apurado");
	}

	const scenarios: ScenarioWithRelations[] =
		await tx.productBonusScenario.findMany({
			where: {
				productId,
				isActive: true,
				periodFrequency,
			},
			orderBy: {
				sortOrder: "asc",
			},
			select: {
				id: true,
				name: true,
				targetAmount: true,
				payoutEnabled: true,
				payoutTotalPercentage: true,
				payoutDueDay: true,
				participants: {
					orderBy: {
						sortOrder: "asc",
					},
					select: {
						type: true,
						companyId: true,
						partnerId: true,
						sellerId: true,
						supervisorId: true,
						company: {
							select: {
								id: true,
								name: true,
							},
						},
						partner: {
							select: {
								id: true,
								name: true,
							},
						},
						seller: {
							select: {
								id: true,
								name: true,
							},
						},
						supervisor: {
							select: {
								id: true,
								userId: true,
								user: {
									select: {
										name: true,
										email: true,
									},
								},
							},
						},
					},
				},
				payoutInstallments: {
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

	if (scenarios.length === 0) {
		throw new BadRequestError(
			"Product has no local bonus scenarios for the selected period",
		);
	}

	const products = await tx.product.findMany({
		where: {
			organizationId,
		},
		select: {
			id: true,
			parentId: true,
		},
	});
	const productIdsInScope = getProductTreeIds({
		products,
		rootProductId: productId,
	});

	const sales = await tx.sale.findMany({
		where: {
			organizationId,
			status: SaleStatus.COMPLETED,
			productId: {
				in: productIdsInScope,
			},
			saleDate: {
				gte: periodRange.from,
				lte: periodRange.to,
			},
		},
		select: {
			totalAmount: true,
			companyId: true,
			responsibleType: true,
			responsibleId: true,
		},
	});

	const partnerResponsibleIds = Array.from(
		new Set(
			sales
				.filter(
					(sale) =>
						sale.responsibleType === SaleResponsibleType.PARTNER &&
						Boolean(sale.responsibleId),
				)
				.map((sale) => sale.responsibleId as string),
		),
	);
	const partnerSupervisors = partnerResponsibleIds.length
		? await tx.partnerSupervisor.findMany({
				where: {
					organizationId,
					partnerId: {
						in: partnerResponsibleIds,
					},
				},
				select: {
					supervisorId: true,
					partnerId: true,
				},
			})
		: [];
	const supervisorUserIdsByPartnerId = new Map<string, string[]>();
	for (const partnerSupervisor of partnerSupervisors) {
		const supervisors =
			supervisorUserIdsByPartnerId.get(partnerSupervisor.partnerId) ?? [];
		supervisors.push(partnerSupervisor.supervisorId);
		supervisorUserIdsByPartnerId.set(partnerSupervisor.partnerId, supervisors);
	}

	const salesTotalByCompanyId = new Map<string, number>();
	const salesTotalByPartnerId = new Map<string, number>();
	const salesTotalBySellerId = new Map<string, number>();
	const salesTotalBySupervisorUserId = new Map<string, number>();
	const salesTotalAmount = sales.reduce(
		(sum, sale) => sum + sale.totalAmount,
		0,
	);

	for (const sale of sales) {
		salesTotalByCompanyId.set(
			sale.companyId,
			(salesTotalByCompanyId.get(sale.companyId) ?? 0) + sale.totalAmount,
		);

		if (
			sale.responsibleType === SaleResponsibleType.PARTNER &&
			sale.responsibleId
		) {
			salesTotalByPartnerId.set(
				sale.responsibleId,
				(salesTotalByPartnerId.get(sale.responsibleId) ?? 0) + sale.totalAmount,
			);

			const supervisorUserIds =
				supervisorUserIdsByPartnerId.get(sale.responsibleId) ?? [];
			for (const supervisorUserId of supervisorUserIds) {
				salesTotalBySupervisorUserId.set(
					supervisorUserId,
					(salesTotalBySupervisorUserId.get(supervisorUserId) ?? 0) +
						sale.totalAmount,
				);
			}
		}

		if (
			sale.responsibleType === SaleResponsibleType.SELLER &&
			sale.responsibleId
		) {
			salesTotalBySellerId.set(
				sale.responsibleId,
				(salesTotalBySellerId.get(sale.responsibleId) ?? 0) + sale.totalAmount,
			);
		}
	}

	const winners: BonusSettlementWinner[] = [];

	for (const scenario of scenarios) {
		for (const participant of scenario.participants) {
			const achievedAmount =
				participant.type === ProductBonusParticipantType.COMPANY
					? participant.companyId
						? (salesTotalByCompanyId.get(participant.companyId) ?? 0)
						: 0
					: participant.type === ProductBonusParticipantType.PARTNER
						? participant.partnerId
							? (salesTotalByPartnerId.get(participant.partnerId) ?? 0)
							: 0
						: participant.type === ProductBonusParticipantType.SELLER
							? participant.sellerId
								? (salesTotalBySellerId.get(participant.sellerId) ?? 0)
								: 0
							: participant.supervisor?.userId
								? (salesTotalBySupervisorUserId.get(
										participant.supervisor.userId,
									) ?? 0)
								: 0;

			if (achievedAmount < scenario.targetAmount) {
				continue;
			}

			const payoutTotalPercentage =
				scenario.payoutEnabled && scenario.payoutTotalPercentage
					? scenario.payoutTotalPercentage
					: 0;
			const payoutAmount =
				scenario.payoutEnabled && payoutTotalPercentage > 0
					? toScaledAmountRounded(achievedAmount, payoutTotalPercentage)
					: 0;
			const payoutDueDay = scenario.payoutDueDay ?? 1;
			const installmentAmounts =
				scenario.payoutEnabled && scenario.payoutInstallments.length > 0
					? calculateInstallmentAmountsFromScaled({
							totalAmount: payoutAmount,
							totalPercentageScaled: payoutTotalPercentage,
							installmentPercentagesScaled: scenario.payoutInstallments.map(
								(installment) => installment.percentage,
							),
						})
					: [];
			const firstDueDate = resolveFirstDueDate({
				baseDate: settledAtDate,
				dueDay: payoutDueDay,
			});
			const payoutInstallments = scenario.payoutEnabled
				? scenario.payoutInstallments.map((installment, installmentIndex) => ({
						installmentNumber: installment.installmentNumber,
						percentage: installment.percentage,
						amount: installmentAmounts[installmentIndex] ?? 0,
						expectedPaymentDate: resolveInstallmentDueDate({
							firstDueDate,
							installmentOffset: installmentIndex,
							dueDay: payoutDueDay,
						}),
					}))
				: [];

			winners.push({
				scenarioId: scenario.id,
				scenarioName: scenario.name,
				participantType: participant.type,
				recipientType: toSaleCommissionRecipientType(participant.type),
				beneficiaryCompanyId: participant.companyId,
				beneficiaryPartnerId: participant.partnerId,
				beneficiarySellerId: participant.sellerId,
				beneficiarySupervisorId: participant.supervisorId,
				beneficiaryLabel: resolveBeneficiaryLabel({
					type: participant.type,
					companyName: participant.company?.name,
					partnerName: participant.partner?.name,
					sellerName: participant.seller?.name,
					supervisorName: participant.supervisor?.user.name,
					supervisorEmail: participant.supervisor?.user.email,
				}),
				achievedAmount,
				targetAmount: scenario.targetAmount,
				payoutEnabled: scenario.payoutEnabled,
				payoutAmount,
				payoutTotalPercentage,
				payoutDueDay,
				payoutInstallments,
			});
		}
	}

	return {
		settlementId: duplicateSettlement?.id ?? null,
		isSettled: Boolean(duplicateSettlement),
		product,
		periodFrequency,
		periodYear,
		periodIndex,
		periodStart: periodRange.from,
		periodEnd: periodRange.to,
		settledAt: settledAtDate,
		salesCount: sales.length,
		salesTotalAmount,
		scenariosCount: scenarios.length,
		winners,
		installmentsCount: winners.reduce(
			(sum, winner) => sum + winner.payoutInstallments.length,
			0,
		),
	};
}

export function mapBonusSettlementPreviewResponse(
	calculation: BonusSettlementCalculationResult,
) {
	return {
		settlementId: calculation.settlementId,
		isSettled: calculation.isSettled,
		product: calculation.product,
		periodFrequency: calculation.periodFrequency,
		periodYear: calculation.periodYear,
		periodIndex: calculation.periodIndex,
		periodStart: calculation.periodStart,
		periodEnd: calculation.periodEnd,
		settledAt: calculation.settledAt,
		salesCount: calculation.salesCount,
		salesTotalAmount: calculation.salesTotalAmount,
		scenariosCount: calculation.scenariosCount,
		winnersCount: calculation.winners.length,
		installmentsCount: calculation.installmentsCount,
		winners: calculation.winners.map((winner) => ({
			scenarioId: winner.scenarioId,
			scenarioName: winner.scenarioName,
			participantType: winner.participantType,
			recipientType: winner.recipientType,
			beneficiaryLabel: winner.beneficiaryLabel,
			achievedAmount: winner.achievedAmount,
			targetAmount: winner.targetAmount,
			payoutEnabled: winner.payoutEnabled,
			payoutAmount: winner.payoutAmount,
			payoutTotalPercentage:
				winner.payoutTotalPercentage / BONUS_PERCENTAGE_SCALE,
			payoutInstallments: winner.payoutInstallments.map((installment) => ({
				installmentNumber: installment.installmentNumber,
				percentage: installment.percentage / BONUS_PERCENTAGE_SCALE,
				amount: installment.amount,
				expectedPaymentDate: installment.expectedPaymentDate,
			})),
		})),
	};
}

export function mapBonusInstallmentCreateManyData(params: {
	organizationId: string;
	settlementId: string;
	resultId: string;
	productId: string;
	periodFrequency: ProductBonusPeriodFrequency;
	periodYear: number;
	periodIndex: number;
	winner: BonusSettlementWinner;
}) {
	const {
		organizationId,
		settlementId,
		resultId,
		productId,
		periodFrequency,
		periodYear,
		periodIndex,
		winner,
	} = params;

	return winner.payoutInstallments.map((installment) => ({
		organizationId,
		settlementId,
		resultId,
		scenarioId: winner.scenarioId,
		productId,
		scenarioName: winner.scenarioName,
		periodFrequency,
		periodYear,
		periodIndex,
		recipientType: winner.recipientType,
		direction: SaleCommissionDirection.OUTCOME,
		beneficiaryCompanyId: winner.beneficiaryCompanyId,
		beneficiaryPartnerId: winner.beneficiaryPartnerId,
		beneficiarySellerId: winner.beneficiarySellerId,
		beneficiarySupervisorId: winner.beneficiarySupervisorId,
		beneficiaryLabel: winner.beneficiaryLabel,
		installmentNumber: installment.installmentNumber,
		percentage: installment.percentage,
		amount: installment.amount,
		status: "PENDING" as const,
		expectedPaymentDate: installment.expectedPaymentDate,
		paymentDate: null,
	}));
}
