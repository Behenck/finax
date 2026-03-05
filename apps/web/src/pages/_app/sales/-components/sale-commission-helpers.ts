import type { GetOrganizationsSlugProductsIdCommissionScenarios200 } from "@/http/generated";
import type { SaleCommissionFormData } from "@/schemas/sale-schema";
import type {
	SaleCommissionDirection,
	SaleCommissionRecipientType,
} from "@/schemas/types/sales";

const COMMISSION_PERCENTAGE_SCALE = 10_000;
const COMMISSION_AMOUNT_DENOMINATOR = BigInt(100 * COMMISSION_PERCENTAGE_SCALE);

export type ProductCommissionScenario =
	GetOrganizationsSlugProductsIdCommissionScenarios200["scenarios"][number];
export type ProductCommissionCondition =
	ProductCommissionScenario["conditions"][number];
export type ProductCommission =
	ProductCommissionScenario["commissions"][number];

export type SaleCommissionMatchContext = {
	companyId?: string;
	unitId?: string;
	sellerId?: string;
	partnerId?: string;
};

export function deriveSaleCommissionDirectionFromRecipientType(
	recipientType: SaleCommissionRecipientType,
): SaleCommissionDirection {
	if (recipientType === "COMPANY" || recipientType === "UNIT") {
		return "INCOME";
	}

	return "OUTCOME";
}

function matchesCommissionCondition(
	condition: ProductCommissionCondition,
	context: SaleCommissionMatchContext,
) {
	switch (condition.type) {
		case "COMPANY":
			return condition.valueId === null
				? Boolean(context.companyId)
				: context.companyId === condition.valueId;
		case "UNIT":
			return condition.valueId === null
				? Boolean(context.unitId)
				: context.unitId === condition.valueId;
		case "SELLER":
			return condition.valueId === null
				? Boolean(context.sellerId)
				: context.sellerId === condition.valueId;
		case "PARTNER":
			return condition.valueId === null
				? Boolean(context.partnerId)
				: context.partnerId === condition.valueId;
		default:
			return false;
	}
}

function matchesCommissionScenario(
	scenario: ProductCommissionScenario,
	context: SaleCommissionMatchContext,
) {
	if (scenario.conditions.length === 0) {
		return true;
	}

	const conditionsByType = new Map<
		ProductCommissionCondition["type"],
		ProductCommissionCondition[]
	>();

	for (const condition of scenario.conditions) {
		const current = conditionsByType.get(condition.type) ?? [];
		current.push(condition);
		conditionsByType.set(condition.type, current);
	}

	return Array.from(conditionsByType.values()).every((conditions) =>
		conditions.some((condition) =>
			matchesCommissionCondition(condition, context),
		),
	);
}

export function resolveMatchedCommissionScenario(
	scenarios: ProductCommissionScenario[],
	context: SaleCommissionMatchContext,
) {
	const matchedScenarios = scenarios
		.map((scenario, index) => ({
			index,
			scenario,
			isMatch: matchesCommissionScenario(scenario, context),
			specificity: scenario.conditions.length,
		}))
		.filter((item) => item.isMatch)
		.sort((left, right) => {
			if (right.specificity !== left.specificity) {
				return right.specificity - left.specificity;
			}

			return left.index - right.index;
		});

	return matchedScenarios[0]?.scenario;
}

export function roundSaleCommissionPercentage(value: number) {
	return (
		Math.round(
			(Number(value || 0) + Number.EPSILON) * COMMISSION_PERCENTAGE_SCALE,
		) / COMMISSION_PERCENTAGE_SCALE
	);
}

function toScaledPercentage(value: number) {
	return Math.round(
		(roundSaleCommissionPercentage(value) + Number.EPSILON) *
			COMMISSION_PERCENTAGE_SCALE,
	);
}

function toScaledAmountFloor(totalAmount: number, percentageScaled: number) {
	const numerator = BigInt(totalAmount) * BigInt(percentageScaled);
	return Number(numerator / COMMISSION_AMOUNT_DENOMINATOR);
}

function toScaledAmountRounded(totalAmount: number, percentageScaled: number) {
	const numerator = BigInt(totalAmount) * BigInt(percentageScaled);
	return Number(
		(numerator + COMMISSION_AMOUNT_DENOMINATOR / 2n) /
			COMMISSION_AMOUNT_DENOMINATOR,
	);
}

export function calculateSaleCommissionInstallmentAmounts({
	totalAmountInCents,
	totalPercentage,
	installments,
}: {
	totalAmountInCents: number;
	totalPercentage: number;
	installments: Array<{
		percentage: number;
	}>;
}) {
	if (installments.length === 0) {
		return [];
	}

	const safeTotalAmount = Math.max(
		0,
		Math.trunc(Number.isFinite(totalAmountInCents) ? totalAmountInCents : 0),
	);
	const totalPercentageScaled = toScaledPercentage(totalPercentage);
	const installmentPercentagesScaled = installments.map((installment) =>
		toScaledPercentage(installment.percentage),
	);
	const baseAmounts = installmentPercentagesScaled.map((percentageScaled) =>
		toScaledAmountFloor(safeTotalAmount, percentageScaled),
	);
	const roundedCommissionTotal = toScaledAmountRounded(
		safeTotalAmount,
		totalPercentageScaled,
	);
	const baseTotal = baseAmounts.reduce((sum, amount) => sum + amount, 0);
	const residual = roundedCommissionTotal - baseTotal;
	const lastInstallmentIndex = baseAmounts.length - 1;
	const adjustedLastAmount = Math.max(
		0,
		(baseAmounts[lastInstallmentIndex] ?? 0) + residual,
	);

	return baseAmounts.map((amount, index) =>
		index === lastInstallmentIndex ? adjustedLastAmount : amount,
	);
}

export function distributeSaleCommissionInstallments(
	totalPercentage: number,
	count: number,
) {
	const safeCount = Math.max(1, Math.trunc(count));
	const safeTotal = roundSaleCommissionPercentage(totalPercentage);
	const totalScaled = Math.round(
		(safeTotal + Number.EPSILON) * COMMISSION_PERCENTAGE_SCALE,
	);
	const base = Math.floor(totalScaled / safeCount);
	const remainder = totalScaled - base * safeCount;

	return Array.from({ length: safeCount }, (_, index) => {
		const scaled = index === safeCount - 1 ? base + remainder : base;
		return {
			installmentNumber: index + 1,
			percentage: scaled / COMMISSION_PERCENTAGE_SCALE,
		};
	});
}

function normalizeDateOnly(value: Date | string | null | undefined) {
	if (value instanceof Date && Number.isFinite(value.getTime())) {
		return value;
	}

	if (typeof value === "string") {
		const dateOnly = value.slice(0, 10);
		const parsed = new Date(`${dateOnly}T00:00:00`);
		if (Number.isFinite(parsed.getTime())) {
			return parsed;
		}
	}

	return new Date();
}

export function createDefaultManualSaleCommission(
	startDate?: Date,
): SaleCommissionFormData {
	return {
		sourceType: "MANUAL",
		recipientType: "COMPANY",
		direction: "INCOME",
		beneficiaryId: undefined,
		beneficiaryLabel: undefined,
		startDate: normalizeDateOnly(startDate),
		totalPercentage: 1,
		installments: distributeSaleCommissionInstallments(1, 1),
	};
}

type CommissionFormLike = {
	sourceType: "PULLED" | "MANUAL";
	recipientType: SaleCommissionFormData["recipientType"];
	direction?: SaleCommissionDirection | null;
	beneficiaryId?: string | null;
	beneficiaryLabel?: string | null;
	startDate?: Date | string | null;
	totalPercentage: number;
	installments: Array<{
		installmentNumber: number;
		percentage: number;
	}>;
};

export function mapSaleCommissionToForm(
	commission: CommissionFormLike,
	fallbackStartDate?: Date,
): SaleCommissionFormData {
	const sortedInstallments = [...commission.installments].sort(
		(left, right) => left.installmentNumber - right.installmentNumber,
	);
	const installments =
		sortedInstallments.length > 0
			? sortedInstallments.map((installment, installmentIndex) => ({
					installmentNumber: installmentIndex + 1,
					percentage: roundSaleCommissionPercentage(installment.percentage),
				}))
			: distributeSaleCommissionInstallments(commission.totalPercentage, 1);

	return {
		sourceType: commission.sourceType,
		recipientType: commission.recipientType,
		direction:
			commission.direction ??
			deriveSaleCommissionDirectionFromRecipientType(commission.recipientType),
		beneficiaryId: commission.beneficiaryId ?? undefined,
		beneficiaryLabel: commission.beneficiaryLabel?.trim() || undefined,
		startDate: normalizeDateOnly(commission.startDate ?? fallbackStartDate),
		totalPercentage: roundSaleCommissionPercentage(commission.totalPercentage),
		installments,
	};
}

export function mapScenarioCommissionsToPulledSaleCommissions(
	commissions: ProductCommission[],
	startDate?: Date,
) {
	return commissions.map((commission) =>
		mapSaleCommissionToForm({
			sourceType: "PULLED",
			recipientType: commission.recipientType,
			beneficiaryId: commission.beneficiaryId,
			beneficiaryLabel: commission.beneficiaryLabel,
			startDate,
			totalPercentage: commission.totalPercentage,
			installments: commission.installments,
		}),
	);
}

export function splitSaleCommissionsBySource(
	commissions: SaleCommissionFormData[],
) {
	const manual = commissions.filter(
		(commission) => commission.sourceType === "MANUAL",
	);
	const pulled = commissions.filter(
		(commission) => commission.sourceType === "PULLED",
	);

	return { manual, pulled };
}

export function replacePulledSaleCommissions(
	currentCommissions: SaleCommissionFormData[],
	nextPulledCommissions: SaleCommissionFormData[],
) {
	const { manual } = splitSaleCommissionsBySource(currentCommissions);
	return [...manual, ...nextPulledCommissions];
}
