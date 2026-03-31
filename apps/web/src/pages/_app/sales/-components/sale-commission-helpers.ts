import type { GetOrganizationsSlugProductsIdCommissionScenarios200 } from "@/http/generated";
import type { SaleCommissionFormData } from "@/schemas/sale-schema";
import {
	SALE_COMMISSION_RECIPIENT_TYPE_LABEL,
	type SaleCommissionDirection,
	type SaleCommissionRecipientType,
} from "@/schemas/types/sales";

const COMMISSION_PERCENTAGE_SCALE = 10_000;
const COMMISSION_AMOUNT_DENOMINATOR = BigInt(100 * COMMISSION_PERCENTAGE_SCALE);
const COMMISSION_PERCENTAGE_COMPOSITION_DENOMINATOR =
	100 * COMMISSION_PERCENTAGE_SCALE;

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

function fromScaledPercentage(value: number) {
	return value / COMMISSION_PERCENTAGE_SCALE;
}

function composeScaledPercentages(baseScaled: number, dependentScaled: number) {
	return Math.round(
		(baseScaled * dependentScaled) / COMMISSION_PERCENTAGE_COMPOSITION_DENOMINATOR,
	);
}

function normalizeInstallmentsScaledToTotal({
	totalScaled,
	installmentsScaled,
}: {
	totalScaled: number;
	installmentsScaled: number[];
}) {
	if (installmentsScaled.length === 0) {
		return [];
	}

	const normalizedInstallmentsScaled = [...installmentsScaled];
	const installmentsTotalScaled = normalizedInstallmentsScaled.reduce(
		(sum, installmentScaled) => sum + installmentScaled,
		0,
	);
	const residual = totalScaled - installmentsTotalScaled;
	const lastInstallmentIndex = normalizedInstallmentsScaled.length - 1;
	const adjustedLastInstallmentScaled = Math.max(
		0,
		(normalizedInstallmentsScaled[lastInstallmentIndex] ?? 0) + residual,
	);
	normalizedInstallmentsScaled[lastInstallmentIndex] =
		adjustedLastInstallmentScaled;

	return normalizedInstallmentsScaled;
}

function resolveEffectiveCommissionsScaledPercentages(
	commissions: Array<{
		calculationBase?: "SALE_TOTAL" | "COMMISSION";
		baseCommissionIndex?: number;
		totalPercentage: number;
		installments: Array<{
			percentage: number;
		}>;
	}>,
) {
	const memo = new Map<
		number,
		{
			totalScaled: number;
			installmentsScaled: number[];
		}
	>();

	const resolveByIndex = (
		commissionIndex: number,
		stack: Set<number>,
	): {
		totalScaled: number;
		installmentsScaled: number[];
	} => {
		const memoized = memo.get(commissionIndex);
		if (memoized) {
			return memoized;
		}

		const commission = commissions[commissionIndex];
		const ownTotalScaled = toScaledPercentage(commission?.totalPercentage ?? 0);
		const ownInstallmentsScaled = normalizeInstallmentsScaledToTotal({
			totalScaled: ownTotalScaled,
			installmentsScaled:
				commission?.installments.map((installment) =>
					toScaledPercentage(installment.percentage),
				) ?? [],
		});

		const calculationBase = commission?.calculationBase ?? "SALE_TOTAL";
		const baseCommissionIndex = commission?.baseCommissionIndex;

		if (
			calculationBase !== "COMMISSION" ||
			baseCommissionIndex === undefined ||
			baseCommissionIndex < 0 ||
			baseCommissionIndex >= commissions.length ||
			baseCommissionIndex === commissionIndex ||
			stack.has(commissionIndex)
		) {
			const ownResult = {
				totalScaled: ownTotalScaled,
				installmentsScaled: ownInstallmentsScaled,
			};
			memo.set(commissionIndex, ownResult);
			return ownResult;
		}

		const baseCommission = commissions[baseCommissionIndex];
		const baseCalculationBase = baseCommission?.calculationBase ?? "SALE_TOTAL";
		if (!baseCommission || baseCalculationBase !== "SALE_TOTAL") {
			const ownResult = {
				totalScaled: ownTotalScaled,
				installmentsScaled: ownInstallmentsScaled,
			};
			memo.set(commissionIndex, ownResult);
			return ownResult;
		}

		const nextStack = new Set(stack);
		nextStack.add(commissionIndex);
		const baseEffective = resolveByIndex(baseCommissionIndex, nextStack);

		const effectiveTotalScaled = composeScaledPercentages(
			baseEffective.totalScaled,
			ownTotalScaled,
		);
		const effectiveInstallmentsScaled = normalizeInstallmentsScaledToTotal({
			totalScaled: effectiveTotalScaled,
			installmentsScaled: ownInstallmentsScaled.map((installmentScaled) =>
				composeScaledPercentages(baseEffective.totalScaled, installmentScaled),
			),
		});

		const result = {
			totalScaled: effectiveTotalScaled,
			installmentsScaled: effectiveInstallmentsScaled,
		};
		memo.set(commissionIndex, result);
		return result;
	};

	return commissions.map((_commission, commissionIndex) =>
		resolveByIndex(commissionIndex, new Set<number>()),
	);
}

export function resolveEffectiveSaleCommissionsPercentages(
	commissions: SaleCommissionFormData[],
) {
	const effectiveScaledPercentages =
		resolveEffectiveCommissionsScaledPercentages(commissions);

	return effectiveScaledPercentages.map((commission) => ({
		totalPercentage: fromScaledPercentage(commission.totalScaled),
		installmentPercentages: commission.installmentsScaled.map(
			fromScaledPercentage,
		),
	}));
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
		calculationBase: "SALE_TOTAL",
		baseCommissionIndex: undefined,
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
	calculationBase?: "SALE_TOTAL" | "COMMISSION";
	baseCommissionIndex?: number;
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
	const calculationBase =
		commission.calculationBase === "COMMISSION" ? "COMMISSION" : "SALE_TOTAL";
	const baseCommissionIndex =
		calculationBase === "COMMISSION" &&
		typeof commission.baseCommissionIndex === "number"
			? commission.baseCommissionIndex
			: undefined;

	return {
		sourceType: commission.sourceType,
		recipientType: commission.recipientType,
		direction:
			commission.direction ??
			deriveSaleCommissionDirectionFromRecipientType(commission.recipientType),
		calculationBase,
		baseCommissionIndex,
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
	saleContext?: {
		companyId?: string;
		sellerId?: string;
		partnerId?: string;
	},
) {
	return commissions.map((commission) => {
		const resolvedBeneficiaryId =
			commission.recipientType === "COMPANY"
				? (commission.beneficiaryId ?? saleContext?.companyId)
				: commission.recipientType === "SELLER"
					? (commission.beneficiaryId ?? saleContext?.sellerId)
					: commission.recipientType === "PARTNER"
						? (commission.beneficiaryId ?? saleContext?.partnerId)
						: commission.beneficiaryId;

		return mapSaleCommissionToForm({
			sourceType: "PULLED",
			recipientType: commission.recipientType,
			calculationBase:
				commission.calculationBase === "COMMISSION"
					? "COMMISSION"
					: "SALE_TOTAL",
			baseCommissionIndex:
				commission.calculationBase === "COMMISSION"
					? commission.baseCommissionIndex
					: undefined,
			beneficiaryId: resolvedBeneficiaryId,
			beneficiaryLabel: commission.beneficiaryLabel,
			startDate,
			totalPercentage: commission.totalPercentage,
			installments: commission.installments.map((installment) => ({
				installmentNumber: installment.installmentNumber,
				percentage: installment.percentage,
			})),
		});
	});
}

export function buildSaleCommissionBaseOptionsByIndex(
	commissions: SaleCommissionFormData[],
) {
	return commissions.map((_commission, commissionIndex) =>
		commissions.flatMap((candidateCommission, candidateIndex) => {
			if (candidateIndex === commissionIndex) {
				return [];
			}

			const candidateCalculationBase =
				candidateCommission.calculationBase ?? "SALE_TOTAL";
			if (candidateCalculationBase !== "SALE_TOTAL") {
				return [];
			}

			const recipientLabel =
				SALE_COMMISSION_RECIPIENT_TYPE_LABEL[candidateCommission.recipientType] ??
				"Beneficiário";

			return [
				{
					index: candidateIndex,
					label: `Comissão ${candidateIndex + 1} • ${recipientLabel}`,
				},
			];
		}),
	);
}

export function groupSaleCommissionsByBase(commissions: SaleCommissionFormData[]) {
	const childrenByParent = new Map<number, number[]>();
	const childIndexes = new Set<number>();

	for (const [commissionIndex, commission] of commissions.entries()) {
		const calculationBase = commission.calculationBase ?? "SALE_TOTAL";
		const baseCommissionIndex = commission.baseCommissionIndex;
		if (
			calculationBase !== "COMMISSION" ||
			baseCommissionIndex === undefined ||
			baseCommissionIndex < 0 ||
			baseCommissionIndex >= commissions.length ||
			baseCommissionIndex === commissionIndex
		) {
			continue;
		}

		const baseCommission = commissions[baseCommissionIndex];
		const baseCalculationBase = baseCommission?.calculationBase ?? "SALE_TOTAL";
		if (!baseCommission || baseCalculationBase !== "SALE_TOTAL") {
			continue;
		}

		const currentChildren = childrenByParent.get(baseCommissionIndex) ?? [];
		currentChildren.push(commissionIndex);
		childrenByParent.set(baseCommissionIndex, currentChildren);
		childIndexes.add(commissionIndex);
	}

	const groups: Array<{
		parentIndex: number;
		childIndexes: number[];
	}> = [];
	const renderedIndexes = new Set<number>();

	for (const [commissionIndex] of commissions.entries()) {
		if (childIndexes.has(commissionIndex)) {
			continue;
		}

		const children = [...(childrenByParent.get(commissionIndex) ?? [])].sort(
			(a, b) => a - b,
		);
		groups.push({
			parentIndex: commissionIndex,
			childIndexes: children,
		});

		renderedIndexes.add(commissionIndex);
		for (const childIndex of children) {
			renderedIndexes.add(childIndex);
		}
	}

	for (const [commissionIndex] of commissions.entries()) {
		if (renderedIndexes.has(commissionIndex)) {
			continue;
		}

		groups.push({
			parentIndex: commissionIndex,
			childIndexes: [],
		});
	}

	return groups;
}

export function normalizeSaleCommissionsBaseLinks(
	commissions: SaleCommissionFormData[],
) {
	return commissions.map((commission, commissionIndex) => {
		const calculationBase = commission.calculationBase ?? "SALE_TOTAL";
		if (calculationBase !== "COMMISSION") {
			return {
				...commission,
				calculationBase: "SALE_TOTAL" as const,
				baseCommissionIndex: undefined,
			};
		}

		const baseCommissionIndex = commission.baseCommissionIndex;
		if (
			baseCommissionIndex === undefined ||
			baseCommissionIndex < 0 ||
			baseCommissionIndex >= commissions.length ||
			baseCommissionIndex === commissionIndex
		) {
			return {
				...commission,
				calculationBase: "SALE_TOTAL" as const,
				baseCommissionIndex: undefined,
			};
		}

		const baseCommission = commissions[baseCommissionIndex];
		const baseCalculationBase = baseCommission?.calculationBase ?? "SALE_TOTAL";
		if (!baseCommission || baseCalculationBase !== "SALE_TOTAL") {
			return {
				...commission,
				calculationBase: "SALE_TOTAL" as const,
				baseCommissionIndex: undefined,
			};
		}

		return {
			...commission,
			calculationBase: "COMMISSION" as const,
			baseCommissionIndex,
		};
	});
}

export function removeSaleCommissionWithDependents(
	commissions: SaleCommissionFormData[],
	commissionIndex: number,
) {
	if (
		commissionIndex < 0 ||
		commissionIndex >= commissions.length ||
		commissions.length === 0
	) {
		return commissions;
	}

	const indexesToRemove = new Set<number>([commissionIndex]);
	let hasNewDependent = true;

	while (hasNewDependent) {
		hasNewDependent = false;
		for (const [currentIndex, commission] of commissions.entries()) {
			if (indexesToRemove.has(currentIndex)) {
				continue;
			}

			const calculationBase = commission.calculationBase ?? "SALE_TOTAL";
			const baseCommissionIndex = commission.baseCommissionIndex;
			if (
				calculationBase === "COMMISSION" &&
				baseCommissionIndex !== undefined &&
				indexesToRemove.has(baseCommissionIndex)
			) {
				indexesToRemove.add(currentIndex);
				hasNewDependent = true;
			}
		}
	}

	const oldIndexToNewIndex = new Map<number, number>();
	const remainingCommissions: SaleCommissionFormData[] = [];
	for (const [currentIndex, commission] of commissions.entries()) {
		if (indexesToRemove.has(currentIndex)) {
			continue;
		}

		oldIndexToNewIndex.set(currentIndex, remainingCommissions.length);
		remainingCommissions.push(commission);
	}

	return normalizeSaleCommissionsBaseLinks(
		remainingCommissions.map((commission) => {
			const calculationBase = commission.calculationBase ?? "SALE_TOTAL";
			if (calculationBase !== "COMMISSION") {
				return commission;
			}

			const oldBaseCommissionIndex = commission.baseCommissionIndex;
			const nextBaseCommissionIndex =
				oldBaseCommissionIndex === undefined
					? undefined
					: oldIndexToNewIndex.get(oldBaseCommissionIndex);

			if (nextBaseCommissionIndex === undefined) {
				return {
					...commission,
					calculationBase: "SALE_TOTAL" as const,
					baseCommissionIndex: undefined,
				};
			}

			return {
				...commission,
				calculationBase: "COMMISSION" as const,
				baseCommissionIndex: nextBaseCommissionIndex,
			};
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
	return normalizeSaleCommissionsBaseLinks([
		...manual,
		...nextPulledCommissions,
	]);
}
