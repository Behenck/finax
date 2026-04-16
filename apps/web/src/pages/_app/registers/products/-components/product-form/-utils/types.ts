import type {
	ProductCommissionScenarioFormData,
	ProductFormData,
} from "@/schemas/product-schema";

export interface SelectOption {
	id: string;
	label: string;
}

export type ConditionType =
	ProductCommissionScenarioFormData["conditions"][number]["type"];
export type BonusParticipantType =
	ProductFormData["bonusScenarios"][number]["participants"][number]["type"];
