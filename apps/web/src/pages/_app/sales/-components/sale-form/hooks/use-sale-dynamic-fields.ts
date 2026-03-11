import { useEffect, useMemo, useRef, useState } from "react";
import { type UseFormSetValue } from "react-hook-form";
import {
	getOrganizationsSlugProductsIdSaleFieldsQueryKey,
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
	const previousProductIdRef = useRef(initialSale?.productId ?? "");

	const shouldUseInitialDynamicFieldSchema =
		mode === "UPDATE" &&
		Boolean(initialSale) &&
		!hasSwitchedProduct &&
		selectedProductId === initialSale?.productId;

	const inheritedSaleFieldsQueryKey = useMemo(
		() =>
			[
				...getOrganizationsSlugProductsIdSaleFieldsQueryKey({
					slug: organizationSlug ?? "",
					id: selectedProductId || "",
				}),
				{ includeInherited: true },
			] as const,
		[organizationSlug, selectedProductId],
	);

	const productSaleFieldsQuery = useGetOrganizationsSlugProductsIdSaleFields(
		{
			slug: organizationSlug ?? "",
			id: selectedProductId || "",
		},
		{
			client: {
				params: {
					includeInherited: true,
				},
			},
			query: {
				queryKey: inheritedSaleFieldsQueryKey,
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

		setDynamicFieldSchemaByProductId((currentValue) => ({
			...currentValue,
			[selectedProductId]: productSaleFieldsQuery.data.fields.map((field) => ({
				fieldId: field.id,
				label: field.label,
				type: field.type as SaleDynamicFieldSchemaItem["type"],
				required: field.required,
				options: field.options,
			})),
		}));
	}, [
		productSaleFieldsQuery.data?.fields,
		selectedProductId,
		shouldUseInitialDynamicFieldSchema,
	]);

	useEffect(() => {
		const previousProductId = previousProductIdRef.current;
		if (selectedProductId === previousProductId) {
			return;
		}

		previousProductIdRef.current = selectedProductId;
		onProductChanged?.();
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
