import type {
	SaleDynamicFieldSchemaItem,
	SaleDynamicFieldValues,
} from "@/schemas/types/sale-dynamic-fields";
import { mapSaleCommissionToForm } from "../sale-commission-helpers";
import { toSaleDynamicFieldFormValues } from "../sale-dynamic-fields";
import { parseSaleDateFromApi } from "./date-utils";
import type { SaleCommissionDetailLike, SaleDetail } from "./types";

export function resolveInitialCommissions(initialSale?: SaleDetail) {
	const fallbackStartDate = initialSale
		? parseSaleDateFromApi(initialSale.saleDate)
		: undefined;

	return ((initialSale?.commissions ?? []) as SaleCommissionDetailLike[]).map(
		(commission) => mapSaleCommissionToForm(commission, fallbackStartDate),
	);
}

export function resolveInitialDynamicFields(initialSale?: SaleDetail) {
	const dynamicFieldSchema = (initialSale?.dynamicFieldSchema ??
		[]) as SaleDynamicFieldSchemaItem[];
	const dynamicFieldValues = (initialSale?.dynamicFieldValues ??
		{}) as SaleDynamicFieldValues;

	return toSaleDynamicFieldFormValues(dynamicFieldSchema, dynamicFieldValues);
}
