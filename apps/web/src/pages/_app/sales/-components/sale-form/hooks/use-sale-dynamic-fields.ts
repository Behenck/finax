import { useEffect, useMemo, useRef, useState } from "react";
import { type UseFormSetValue } from "react-hook-form";
import {
	useGetOrganizationsSlugProductsIdSaleFields,
} from "@/http/generated";
import { type SaleFormInput } from "@/schemas/sale-schema";
import type { SaleDynamicFieldSchemaItem } from "@/schemas/types/sale-dynamic-fields";
import type { SaleFormProps } from "../types";

interface UseSaleDynamicFieldsParams {
	mode: NonNullable<SaleFormProps["mode"]>;
	initialSale?: SaleFormProps["initialSale"];
	organizationSlug?: string;
	selectedProductId: string;
	setValue: UseFormSetValue<SaleFormInput>;
	onProductChanged?: () => void;
}

function resolveDynamicFieldDefaultValues(schema: SaleDynamicFieldSchemaItem[]) {
	const defaultValues: Record<string, unknown> = {};

	for (const field of schema) {
		if (field.type === "SELECT") {
			const defaultOptionId = field.options.find((option) => option.isDefault)?.id;
			if (defaultOptionId) {
				defaultValues[field.fieldId] = defaultOptionId;
			}
			continue;
		}

		if (field.type === "MULTI_SELECT") {
			const defaultOptionIds = field.options
				.filter((option) => option.isDefault)
				.map((option) => option.id);
			if (defaultOptionIds.length > 0) {
				defaultValues[field.fieldId] = defaultOptionIds;
			}
		}
	}

	return defaultValues;
}

export function useSaleDynamicFields({
	mode,
	initialSale,
	organizationSlug,
	selectedProductId,
	setValue,
	onProductChanged,
}: UseSaleDynamicFieldsParams) {
	const [dynamicFieldSchemaByProductId, setDynamicFieldSchemaByProductId] =
		useState<Record<string, SaleDynamicFieldSchemaItem[]>>({});
	const [hasSwitchedProduct, setHasSwitchedProduct] = useState(false);
	const [shouldApplyDefaults, setShouldApplyDefaults] = useState(false);
	const previousProductIdRef = useRef(initialSale?.productId ?? "");

	const shouldUseInitialDynamicFieldSchema =
		mode === "UPDATE" &&
		Boolean(initialSale) &&
		!hasSwitchedProduct &&
		selectedProductId === initialSale?.productId;

	const productSaleFieldsQuery = useGetOrganizationsSlugProductsIdSaleFields(
		{
			slug: organizationSlug ?? "",
			id: selectedProductId || "",
			params: {
				includeInherited: true,
			},
		},
		{
			query: {
				enabled:
					Boolean(organizationSlug && selectedProductId) &&
					!shouldUseInitialDynamicFieldSchema,
			},
		},
	);

	const dynamicFieldSchema = useMemo<SaleDynamicFieldSchemaItem[]>(() => {
		if (shouldUseInitialDynamicFieldSchema) {
			return (initialSale?.dynamicFieldSchema ?? []) as SaleDynamicFieldSchemaItem[];
		}

		if (!selectedProductId) {
			return [];
		}

		return dynamicFieldSchemaByProductId[selectedProductId] ?? [];
	}, [
		dynamicFieldSchemaByProductId,
		initialSale?.dynamicFieldSchema,
		selectedProductId,
		shouldUseInitialDynamicFieldSchema,
	]);

	const isDynamicFieldsLoading =
		Boolean(selectedProductId) &&
		!shouldUseInitialDynamicFieldSchema &&
		(productSaleFieldsQuery.isLoading || productSaleFieldsQuery.isFetching);

	useEffect(() => {
		if (shouldUseInitialDynamicFieldSchema || !selectedProductId) {
			return;
		}

		if (!productSaleFieldsQuery.data?.fields) {
			return;
		}

		const mappedFields = productSaleFieldsQuery.data.fields.map((field) => ({
			fieldId: field.id,
			label: field.label,
			type: field.type as SaleDynamicFieldSchemaItem["type"],
			required: field.required,
			options: field.options.map((option) => ({
				id: option.id,
				label: option.label,
				isDefault: option.isDefault,
			})),
		}));

		setDynamicFieldSchemaByProductId((currentValue) => ({
			...currentValue,
			[selectedProductId]: mappedFields,
		}));

		if (shouldApplyDefaults) {
			const defaultValues = resolveDynamicFieldDefaultValues(mappedFields);
			setValue("dynamicFields", defaultValues, {
				shouldDirty: true,
				shouldValidate: true,
			});
			setShouldApplyDefaults(false);
		}
	}, [
		productSaleFieldsQuery.data?.fields,
		selectedProductId,
		setValue,
		shouldApplyDefaults,
		shouldUseInitialDynamicFieldSchema,
	]);

	useEffect(() => {
		const previousProductId = previousProductIdRef.current;
		if (selectedProductId === previousProductId) {
			return;
		}

		previousProductIdRef.current = selectedProductId;
		onProductChanged?.();
		setShouldApplyDefaults(Boolean(selectedProductId));
		setValue("dynamicFields", {}, { shouldDirty: true, shouldValidate: true });

		if (
			mode === "UPDATE" &&
			initialSale?.productId &&
			selectedProductId !== initialSale.productId
		) {
			setHasSwitchedProduct(true);
		}
	}, [initialSale?.productId, mode, onProductChanged, selectedProductId, setValue]);

	return {
		dynamicFieldSchema,
		isDynamicFieldsLoading,
	};
}
