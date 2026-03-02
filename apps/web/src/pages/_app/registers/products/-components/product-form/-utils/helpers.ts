import type { GetOrganizationsSlugProductsIdCommissionScenarios200 } from "@/http/generated";
import type {
	ProductCommissionFormData,
	ProductCommissionScenarioFormData,
	ProductFormData,
} from "@/schemas/product-schema";
import {
	CONDITION_OPTIONS,
	DEFAULT_SCENARIO_NAME,
	PERCENTAGE_SCALE,
} from "./constants";
import type { ConditionType, SelectOption } from "./types";

export function roundPercentage(value: number) {
	return (
		Math.round((Number(value || 0) + Number.EPSILON) * PERCENTAGE_SCALE) /
		PERCENTAGE_SCALE
	);
}

export function distributeInstallments(totalPercentage: number, count: number) {
	const safeCount = Math.max(1, Math.trunc(count));
	const safeTotal = roundPercentage(totalPercentage);
	const totalScaled = Math.round((safeTotal + Number.EPSILON) * PERCENTAGE_SCALE);
	const base = Math.floor(totalScaled / safeCount);
	const remainder = totalScaled - base * safeCount;

	return Array.from({ length: safeCount }, (_, index) => {
		const scaled = index === safeCount - 1 ? base + remainder : base;
		return {
			installmentNumber: index + 1,
			percentage: scaled / PERCENTAGE_SCALE,
		};
	});
}

export function createDefaultCommission(): ProductCommissionFormData {
	return {
		recipientType: "COMPANY",
		beneficiaryId: undefined,
		beneficiaryLabel: undefined,
		totalPercentage: 1,
		installments: distributeInstallments(1, 1),
	};
}

export function createDefaultScenario(
	name = DEFAULT_SCENARIO_NAME,
): ProductCommissionScenarioFormData {
	return {
		name,
		conditions: [],
		commissions: [],
	};
}

export function getMultiSelectLabel(selectedOptions: SelectOption[]) {
	if (selectedOptions.length === 0) return "Selecione";
	if (selectedOptions.length <= 2) {
		return selectedOptions.map((option) => option.label).join(", ");
	}

	return `${selectedOptions[0]?.label ?? ""}, ${selectedOptions[1]?.label ?? ""} +${selectedOptions.length - 2}`;
}

export function mapApiScenarioToForm(
	scenario: GetOrganizationsSlugProductsIdCommissionScenarios200["scenarios"][number],
): ProductCommissionScenarioFormData {
	const conditionValueIdsByType = new Map<ConditionType, Array<string | null>>();
	for (const condition of scenario.conditions) {
		const existingValues = conditionValueIdsByType.get(condition.type) ?? [];
		if (!existingValues.includes(condition.valueId)) {
			existingValues.push(condition.valueId);
			conditionValueIdsByType.set(condition.type, existingValues);
		}
	}

	return {
		name: scenario.name,
		conditions: CONDITION_OPTIONS.flatMap((option) => {
			const valueIds = conditionValueIdsByType.get(option.value);
			return valueIds && valueIds.length > 0
				? [
						{
							type: option.value,
							valueIds,
						},
					]
				: [];
		}),
		commissions:
			scenario.commissions.length > 0
				? scenario.commissions.map((commission) => {
						const installments =
							commission.installments.length > 0
								? commission.installments.map((installment, installmentIndex) => ({
										installmentNumber: installmentIndex + 1,
										percentage: roundPercentage(installment.percentage),
									}))
								: distributeInstallments(commission.totalPercentage, 1);

						return {
							recipientType: commission.recipientType,
							beneficiaryId: commission.beneficiaryId,
							beneficiaryLabel: commission.beneficiaryLabel,
							totalPercentage: roundPercentage(commission.totalPercentage),
							installments,
						};
					})
				: [],
	};
}

export function mapScenariosToPayload(scenarios: ProductFormData["scenarios"]) {
	return scenarios.map((scenario) => ({
		name: scenario.name.trim(),
		conditions: scenario.conditions.flatMap((condition) =>
			condition.valueIds.map((valueId) => ({
				type: condition.type,
				valueId,
			})),
		),
		commissions: scenario.commissions.map((commission) => ({
			recipientType: commission.recipientType,
			beneficiaryId: commission.beneficiaryId,
			beneficiaryLabel:
				commission.recipientType === "OTHER"
					? commission.beneficiaryLabel?.trim()
					: undefined,
			totalPercentage: roundPercentage(commission.totalPercentage),
			installments: commission.installments.map((installment, installmentIndex) => ({
				installmentNumber: installmentIndex + 1,
				percentage: roundPercentage(installment.percentage),
			})),
		})),
	}));
}
