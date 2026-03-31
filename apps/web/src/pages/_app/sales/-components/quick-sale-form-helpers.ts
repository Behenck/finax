import { format } from "date-fns";
import type { SaleHierarchicalProductOption } from "@/hooks/sales/use-sale-form-options";
import {
	QUICK_SALE_BATCH_MAX_ITEMS,
	type QuickSaleBatchFormData,
	type QuickSaleBatchFormInput,
} from "@/schemas/sale-quick-batch-schema";
import type {
	SaleDynamicFieldSchemaItem,
	SaleDynamicFieldValues,
} from "@/schemas/types/sale-dynamic-fields";
import type { SaleResponsibleType } from "@/schemas/types/sales";
import { parseBRLCurrencyToCents } from "@/utils/format-amount";
import { toSaleDynamicFieldPayloadValues } from "./sale-dynamic-fields";

export interface QuickSaleScopedProductOption {
	id: string;
	depth: number;
	label: string;
}

export interface QuickSaleBatchPayload {
	parentProductId: string;
	customerId: string;
	companyId: string;
	unitId?: string;
	responsible: {
		type: SaleResponsibleType;
		id: string;
	};
	items: Array<{
		productId: string;
		saleDate: string;
		totalAmount: number;
		dynamicFields?: SaleDynamicFieldValues;
	}>;
}

export function resolveQuickSaleItemQuantity(
	item: {
		quantity?: string | number | null;
	},
) {
	const parsedQuantity = Number.parseInt(String(item.quantity ?? ""), 10);

	if (Number.isNaN(parsedQuantity) || parsedQuantity < 1) {
		return 1;
	}

	return parsedQuantity;
}

export function resolveScopedItemProducts(
	parentProductId: string | undefined,
	products: SaleHierarchicalProductOption[],
) {
	if (!parentProductId) {
		return [] as QuickSaleScopedProductOption[];
	}

	return products
		.filter((product) => product.rootId === parentProductId)
		.map((product) => ({
			id: product.id,
			depth: product.depth,
			label:
				product.depth === 0
					? `${product.name} (Produto pai)`
					: product.relativeLabel,
		}));
}

export function createQuickSaleItemDraft(
	parentProductId?: string,
	saleDate = format(new Date(), "yyyy-MM-dd"),
): QuickSaleBatchFormInput["items"][number] {
	return {
		productId: parentProductId ?? "",
		quantity: "1",
		saleDate,
		totalAmount: "",
		dynamicFields: {},
	};
}

export function canAddQuickSaleItem(currentCount: number) {
	return currentCount < QUICK_SALE_BATCH_MAX_ITEMS;
}

export function canRemoveQuickSaleItem(currentCount: number) {
	return currentCount > 1;
}

export function buildQuickSaleBatchPayload(params: {
	values: QuickSaleBatchFormData;
	dynamicFieldSchemaByProductId: Record<string, SaleDynamicFieldSchemaItem[]>;
}) {
	const { values, dynamicFieldSchemaByProductId } = params;

	const payloadItems = values.items.flatMap((item) => {
		const quantity = resolveQuickSaleItemQuantity(item);
		const dynamicFieldSchema = dynamicFieldSchemaByProductId[item.productId] ?? [];
		const normalizedDynamicFields = toSaleDynamicFieldPayloadValues(
			dynamicFieldSchema,
			item.dynamicFields ?? {},
		);
		const normalizedItem = {
			productId: item.productId,
			saleDate: item.saleDate,
			totalAmount: parseBRLCurrencyToCents(item.totalAmount),
			dynamicFields:
				Object.keys(normalizedDynamicFields).length > 0
					? normalizedDynamicFields
					: undefined,
		};

		return Array.from({ length: quantity }, () => ({ ...normalizedItem }));
	});

	return {
		parentProductId: values.parentProductId,
		customerId: values.customerId,
		companyId: values.companyId,
		unitId: values.unitId,
		responsible: {
			type: values.responsibleType,
			id: values.responsibleId,
		},
		items: payloadItems,
	} satisfies QuickSaleBatchPayload;
}
