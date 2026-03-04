import type { GetOrganizationsSlugProductsIdCommissionScenarios200 } from "@/http/generated";
import type { SaleCommissionFormData } from "@/schemas/sale-schema";

const COMMISSION_PERCENTAGE_SCALE = 10_000;

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

export function createDefaultManualSaleCommission(): SaleCommissionFormData {
	return {
		sourceType: "MANUAL",
		recipientType: "COMPANY",
		beneficiaryId: undefined,
		beneficiaryLabel: undefined,
		totalPercentage: 1,
		installments: distributeSaleCommissionInstallments(1, 1),
	};
}

type CommissionFormLike = {
	sourceType: "PULLED" | "MANUAL";
	recipientType: SaleCommissionFormData["recipientType"];
	beneficiaryId?: string | null;
	beneficiaryLabel?: string | null;
	totalPercentage: number;
	installments: Array<{
		installmentNumber: number;
		percentage: number;
	}>;
};

export function mapSaleCommissionToForm(
	commission: CommissionFormLike,
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
		beneficiaryId: commission.beneficiaryId ?? undefined,
		beneficiaryLabel: commission.beneficiaryLabel?.trim() || undefined,
		totalPercentage: roundSaleCommissionPercentage(commission.totalPercentage),
		installments,
	};
}

export function mapScenarioCommissionsToPulledSaleCommissions(
	commissions: ProductCommission[],
) {
	return commissions.map((commission) =>
		mapSaleCommissionToForm({
			sourceType: "PULLED",
			recipientType: commission.recipientType,
			beneficiaryId: commission.beneficiaryId,
			beneficiaryLabel: commission.beneficiaryLabel,
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
