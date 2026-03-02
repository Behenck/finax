import type { ProductCommissionScenarioFormData } from "@/schemas/product-schema";

export interface SelectOption {
	id: string;
	label: string;
}

export type ConditionType =
	ProductCommissionScenarioFormData["conditions"][number]["type"];
