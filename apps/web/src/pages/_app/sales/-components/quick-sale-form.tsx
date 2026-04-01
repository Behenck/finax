import { zodResolver } from "@hookform/resolvers/zod";
import { useQueries } from "@tanstack/react-query";
import { Copy, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
	Controller,
	useFieldArray,
	useForm,
	type UseFormReturn,
	useWatch,
} from "react-hook-form";
import { FieldError } from "@/components/field-error";
import { Button } from "@/components/ui/button";
import { CalendarDateInput } from "@/components/ui/calendar-date-input";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { resolveErrorMessage } from "@/errors";
import { normalizeApiError } from "@/errors/api-error";
import type {
	SaleHierarchicalProductOption,
	SaleRootProductOption,
} from "@/hooks/sales/use-sale-form-options";
import { cn } from "@/lib/utils";
import {
	QUICK_SALE_BATCH_MAX_ITEMS,
	quickSaleBatchSchema,
	type QuickSaleBatchFormData,
	type QuickSaleBatchFormInput,
} from "@/schemas/sale-quick-batch-schema";
import type { SaleDynamicFieldSchemaItem } from "@/schemas/types/sale-dynamic-fields";
import {
	SALE_RESPONSIBLE_TYPE_LABEL,
	type SaleResponsibleType,
} from "@/schemas/types/sales";
import { formatCurrencyBRL } from "@/utils/format-amount";
import { formatDocument } from "@/utils/format-document";
import { formatPhone } from "@/utils/format-phone";
import {
	filterCustomersForSaleSearch,
	MIN_SALE_CUSTOMER_SEARCH_LENGTH,
	normalizeCustomerSearchValue,
} from "./sale-form/customer-search";
import { OPTIONAL_NONE_VALUE } from "./sale-form/constants";
import { EditSelectedCustomerDialog } from "./sale-form/dialogs/edit-selected-customer-dialog";
import {
	buildQuickSaleBatchPayload,
	canAddQuickSaleItem,
	canRemoveQuickSaleItem,
	createQuickSaleItemDraft,
	type QuickSaleBatchPayload,
	resolveScopedItemProducts,
	resolveQuickSaleItemQuantity,
} from "./quick-sale-form-helpers";
import { RichTextEditor } from "./rich-text-editor";

interface QuickSaleFormCompanyOption {
	id: string;
	name: string;
	units: Array<{
		id: string;
		name: string;
	}>;
}

interface QuickSaleFormCustomerOption {
	id: string;
	name: string;
	documentType: string;
	documentNumber: string;
	phone: string | null;
}

interface QuickSaleFormResponsibleOption {
	id: string;
	name: string;
}

type QuickSaleFormValues = QuickSaleBatchFormInput;
type QuickSaleFormSubmitData = QuickSaleBatchFormData;

interface QuickSaleFormProps {
	rootProducts: SaleRootProductOption[];
	hierarchicalProducts: SaleHierarchicalProductOption[];
	customers: QuickSaleFormCustomerOption[];
	companies: QuickSaleFormCompanyOption[];
	sellers: QuickSaleFormResponsibleOption[];
	partners: QuickSaleFormResponsibleOption[];
	loadProductDynamicFields(
		productId: string,
	): Promise<SaleDynamicFieldSchemaItem[]>;
	onSubmitBatch(payload: QuickSaleBatchPayload): Promise<void>;
	onRefreshCustomers?(): Promise<void> | void;
	onSuccess?(): void;
	isSubmitting?: boolean;
	initialValues?: Partial<QuickSaleFormValues>;
}

interface QuickSaleItemDynamicFieldsSectionProps {
	itemIndex: number;
	itemProductId: string;
	control: UseFormReturn<
		QuickSaleFormValues,
		unknown,
		QuickSaleFormSubmitData
	>["control"];
	dynamicFieldSchema: SaleDynamicFieldSchemaItem[];
	isLoading: boolean;
}

function resolveDynamicFieldDefaultValues(
	schema: SaleDynamicFieldSchemaItem[],
) {
	const defaultValues: Record<string, unknown> = {};

	for (const field of schema) {
		if (field.type === "SELECT") {
			const defaultOptionId = field.options.find(
				(option) => option.isDefault,
			)?.id;
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

function hasDynamicFieldValue(value: unknown) {
	if (value === undefined || value === null) {
		return false;
	}

	if (typeof value === "string") {
		return value.trim().length > 0;
	}

	if (Array.isArray(value)) {
		return value.length > 0;
	}

	return true;
}

function cloneQuickSaleItemDynamicFields(
	dynamicFields: QuickSaleFormValues["items"][number]["dynamicFields"],
) {
	const source = dynamicFields ?? {};
	const cloned: Record<string, unknown> = {};

	for (const [fieldId, fieldValue] of Object.entries(source)) {
		if (Array.isArray(fieldValue)) {
			cloned[fieldId] = [...fieldValue];
			continue;
		}

		cloned[fieldId] = fieldValue;
	}

	return cloned;
}

function QuickSaleItemDynamicFieldsSection({
	itemIndex,
	itemProductId,
	control,
	dynamicFieldSchema,
	isLoading,
}: QuickSaleItemDynamicFieldsSectionProps) {
	if (!itemProductId) {
		return (
			<p className="text-sm text-muted-foreground">
				Selecione o produto do item para carregar os campos personalizados.
			</p>
		);
	}

	if (isLoading) {
		return (
			<p className="text-sm text-muted-foreground">
				Carregando campos personalizados do item...
			</p>
		);
	}

	if (dynamicFieldSchema.length === 0) {
		return (
			<p className="text-sm text-muted-foreground">
				Este produto não possui campos personalizados.
			</p>
		);
	}

	return (
		<div className="grid gap-4 md:grid-cols-2">
			{dynamicFieldSchema.map((dynamicField) => (
				<FieldGroup
					key={`${itemIndex}-${dynamicField.fieldId}`}
					className={cn(dynamicField.type === "RICH_TEXT" && "md:col-span-2")}
				>
					<Field className="gap-2">
						<FieldLabel>
							{dynamicField.label}
							{dynamicField.required ? " *" : ""}
						</FieldLabel>

						<Controller
							control={control}
							name={`items.${itemIndex}.dynamicFields.${dynamicField.fieldId}`}
							render={({ field, fieldState }) => {
								const rawValue = field.value;

								if (dynamicField.type === "TEXT") {
									return (
										<>
											<Input
												placeholder="Digite o texto"
												value={typeof rawValue === "string" ? rawValue : ""}
												onChange={(event) => field.onChange(event.target.value)}
											/>
											<FieldError error={fieldState.error} />
										</>
									);
								}

								if (dynamicField.type === "NUMBER") {
									return (
										<>
											<Input
												type="number"
												step="any"
												value={typeof rawValue === "string" ? rawValue : ""}
												onChange={(event) => field.onChange(event.target.value)}
											/>
											<FieldError error={fieldState.error} />
										</>
									);
								}

								if (dynamicField.type === "CURRENCY") {
									return (
										<>
											<Input
												placeholder="R$ 0,00"
												value={typeof rawValue === "string" ? rawValue : ""}
												onChange={(event) =>
													field.onChange(formatCurrencyBRL(event.target.value))
												}
											/>
											<FieldError error={fieldState.error} />
										</>
									);
								}

								if (dynamicField.type === "RICH_TEXT") {
									return (
										<>
											<RichTextEditor
												value={typeof rawValue === "string" ? rawValue : ""}
												onChange={field.onChange}
											/>
											<FieldError error={fieldState.error} />
										</>
									);
								}

								if (dynamicField.type === "PHONE") {
									return (
										<>
											<Input
												placeholder="(00) 00000-0000"
												value={typeof rawValue === "string" ? rawValue : ""}
												onChange={(event) =>
													field.onChange(formatPhone(event.target.value))
												}
											/>
											<FieldError error={fieldState.error} />
										</>
									);
								}

								if (dynamicField.type === "SELECT") {
									return (
										<>
											<Select
												value={
													typeof rawValue === "string" && rawValue
														? rawValue
														: OPTIONAL_NONE_VALUE
												}
												onValueChange={(value) =>
													field.onChange(
														value === OPTIONAL_NONE_VALUE ? "" : value,
													)
												}
											>
												<SelectTrigger>
													<SelectValue placeholder="Selecione uma opção" />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value={OPTIONAL_NONE_VALUE}>
														Sem seleção
													</SelectItem>
													{dynamicField.options.map((option) => (
														<SelectItem key={option.id} value={option.id}>
															{option.label}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
											<FieldError error={fieldState.error} />
										</>
									);
								}

								if (dynamicField.type === "MULTI_SELECT") {
									const selectedValues = Array.isArray(rawValue)
										? rawValue.filter(
												(option): option is string =>
													typeof option === "string",
											)
										: [];

									return (
										<>
											<div className="space-y-2">
												{dynamicField.options.map((option) => {
													const checked = selectedValues.includes(option.id);

													return (
														<label
															key={option.id}
															className="flex items-center gap-2 text-sm"
														>
															<Checkbox
																checked={checked}
																onCheckedChange={(isChecked) => {
																	if (isChecked) {
																		field.onChange([
																			...selectedValues,
																			option.id,
																		]);
																		return;
																	}

																	field.onChange(
																		selectedValues.filter(
																			(value) => value !== option.id,
																		),
																	);
																}}
															/>
															<span>{option.label}</span>
														</label>
													);
												})}
											</div>
											<FieldError error={fieldState.error} />
										</>
									);
								}

								if (dynamicField.type === "DATE") {
									return (
										<>
											<CalendarDateInput
												value={typeof rawValue === "string" ? rawValue : ""}
												onChange={field.onChange}
											/>
											<FieldError error={fieldState.error} />
										</>
									);
								}

								if (dynamicField.type === "DATE_TIME") {
									return (
										<>
											<Input
												type="datetime-local"
												value={typeof rawValue === "string" ? rawValue : ""}
												onChange={(event) => field.onChange(event.target.value)}
											/>
											<FieldError error={fieldState.error} />
										</>
									);
								}

								return (
									<>
										<Input
											value={typeof rawValue === "string" ? rawValue : ""}
											onChange={(event) => field.onChange(event.target.value)}
										/>
										<FieldError error={fieldState.error} />
									</>
								);
							}}
						/>
					</Field>
				</FieldGroup>
			))}
		</div>
	);
}

export function QuickSaleForm({
	rootProducts,
	hierarchicalProducts,
	customers,
	companies,
	sellers,
	partners,
	loadProductDynamicFields,
	onSubmitBatch,
	onRefreshCustomers,
	onSuccess,
	isSubmitting = false,
	initialValues,
}: QuickSaleFormProps) {
	const defaultParentProductId =
		initialValues?.parentProductId ?? rootProducts[0]?.id ?? "";
	const defaultItems =
		initialValues?.items && initialValues.items.length > 0
			? initialValues.items.map((item) => ({
					...item,
					quantity: item.quantity ?? "1",
					customerId: item.customerId ?? "",
				}))
			: [createQuickSaleItemDraft(defaultParentProductId || undefined)];

	const form = useForm<QuickSaleFormValues, unknown, QuickSaleFormSubmitData>({
		resolver: zodResolver(quickSaleBatchSchema),
		defaultValues: {
			parentProductId: defaultParentProductId,
			companyId: initialValues?.companyId ?? "",
			unitId: initialValues?.unitId ?? "",
			responsibleType: initialValues?.responsibleType ?? "SELLER",
			responsibleId: initialValues?.responsibleId ?? "",
			items: defaultItems,
		},
	});

	const {
		control,
		handleSubmit,
		setValue,
		formState: { errors },
	} = form;
	const { fields, append, remove } = useFieldArray({
		control,
		name: "items",
	});
	const selectedParentProductId =
		(useWatch({
			control,
			name: "parentProductId",
		}) as string | undefined) ?? "";
	const selectedCompanyId =
		(useWatch({
			control,
			name: "companyId",
		}) as string | undefined) ?? "";
	const selectedResponsibleType =
		(useWatch({
			control,
			name: "responsibleType",
		}) as SaleResponsibleType | undefined) ?? "SELLER";
	const selectedResponsibleId =
		(useWatch({
			control,
			name: "responsibleId",
		}) as string | undefined) ?? "";
	const watchedItems = useWatch({
		control,
		name: "items",
	}) as QuickSaleFormValues["items"] | undefined;
	const itemValues = useMemo(() => watchedItems ?? [], [watchedItems]);
	const totalReplicatedItems = useMemo(
		() =>
			itemValues.reduce(
				(total, item) => total + resolveQuickSaleItemQuantity(item),
				0,
			),
		[itemValues],
	);

	const [submitError, setSubmitError] = useState<string | null>(null);
	const [itemCustomerQueryByFieldId, setItemCustomerQueryByFieldId] = useState<
		Record<string, string | null>
	>({});
	const [
		shouldValidateItemCustomersAfterRefresh,
		setShouldValidateItemCustomersAfterRefresh,
	] = useState(false);
	const [isRefreshingCustomers, setIsRefreshingCustomers] = useState(false);
	const [editingCustomerItemFieldId, setEditingCustomerItemFieldId] = useState<
		string | null
	>(null);

	const scopedItemProducts = useMemo(
		() =>
			resolveScopedItemProducts(selectedParentProductId, hierarchicalProducts),
		[selectedParentProductId, hierarchicalProducts],
	);
	const scopedItemProductIdSet = useMemo(
		() => new Set(scopedItemProducts.map((product) => product.id)),
		[scopedItemProducts],
	);

	const companyUnits = useMemo(
		() =>
			companies.find((company) => company.id === selectedCompanyId)?.units ??
			[],
		[companies, selectedCompanyId],
	);
	const responsibleOptions =
		selectedResponsibleType === "PARTNER" ? partners : sellers;

	useEffect(() => {
		if (responsibleOptions.length === 0) {
			return;
		}

		if (selectedResponsibleId) {
			return;
		}

		setValue("responsibleId", responsibleOptions[0]?.id ?? "", {
			shouldDirty: false,
			shouldValidate: true,
		});
	}, [responsibleOptions, selectedResponsibleId, setValue]);

	useEffect(() => {
		if (!selectedParentProductId) {
			return;
		}

		for (const [itemIndex, item] of itemValues.entries()) {
			if (scopedItemProductIdSet.has(item.productId)) {
				continue;
			}

			setValue(`items.${itemIndex}.productId`, selectedParentProductId, {
				shouldDirty: true,
				shouldValidate: true,
			});
			setValue(`items.${itemIndex}.dynamicFields`, {}, { shouldDirty: true });
		}
	}, [itemValues, scopedItemProductIdSet, selectedParentProductId, setValue]);

	useEffect(() => {
		const currentFieldIdSet = new Set(fields.map((field) => field.id));
		setItemCustomerQueryByFieldId((currentValue) => {
			let hasChanges = false;
			const nextValue: Record<string, string | null> = {};

			for (const [fieldId, queryValue] of Object.entries(currentValue)) {
				if (!currentFieldIdSet.has(fieldId)) {
					hasChanges = true;
					continue;
				}

				nextValue[fieldId] = queryValue;
			}

			return hasChanges ? nextValue : currentValue;
		});
	}, [fields]);

	useEffect(() => {
		if (!shouldValidateItemCustomersAfterRefresh || isRefreshingCustomers) {
			return;
		}

		setShouldValidateItemCustomersAfterRefresh(false);

		const customersIdSet = new Set(customers.map((customer) => customer.id));
		for (const [itemIndex, item] of itemValues.entries()) {
			if (!item.customerId) {
				continue;
			}

			if (customersIdSet.has(item.customerId)) {
				continue;
			}

			setValue(`items.${itemIndex}.customerId`, "", {
				shouldDirty: true,
				shouldTouch: true,
				shouldValidate: true,
			});
		}
	}, [
		customers,
		isRefreshingCustomers,
		itemValues,
		setValue,
		shouldValidateItemCustomersAfterRefresh,
	]);

	const itemProductIds = useMemo(
		() =>
			Array.from(
				new Set(
					itemValues
						.map((item) => item.productId)
						.filter((productId): productId is string => Boolean(productId)),
				),
			),
		[itemValues],
	);
	const dynamicFieldQueries = useQueries({
		queries: itemProductIds.map((productId) => ({
			queryKey: ["quick-sale-fields", productId],
			queryFn: () => loadProductDynamicFields(productId),
			enabled: Boolean(productId),
			staleTime: 60_000,
		})),
	});

	const dynamicFieldQueryByProductId = useMemo(() => {
		return new Map(
			itemProductIds.map((productId, index) => [
				productId,
				dynamicFieldQueries[index],
			]),
		);
	}, [dynamicFieldQueries, itemProductIds]);

	const dynamicFieldSchemaByProductId = useMemo(() => {
		const entries = itemProductIds.map((productId, index) => {
			return [productId, dynamicFieldQueries[index]?.data ?? []] as const;
		});

		return Object.fromEntries(entries);
	}, [dynamicFieldQueries, itemProductIds]);

	useEffect(() => {
		for (const [itemIndex, item] of itemValues.entries()) {
			const productId = item.productId;
			if (!productId) {
				continue;
			}

			const dynamicFieldSchema = dynamicFieldSchemaByProductId[productId] ?? [];
			if (dynamicFieldSchema.length === 0) {
				continue;
			}

			const defaultDynamicFieldValues =
				resolveDynamicFieldDefaultValues(dynamicFieldSchema);
			if (Object.keys(defaultDynamicFieldValues).length === 0) {
				continue;
			}

			const currentDynamicFieldValues = item.dynamicFields ?? {};
			const nextDynamicFieldValues = { ...currentDynamicFieldValues };
			let hasChanges = false;

			for (const [fieldId, defaultValue] of Object.entries(
				defaultDynamicFieldValues,
			)) {
				if (hasDynamicFieldValue(currentDynamicFieldValues[fieldId])) {
					continue;
				}

				nextDynamicFieldValues[fieldId] = defaultValue;
				hasChanges = true;
			}

			if (!hasChanges) {
				continue;
			}

			setValue(`items.${itemIndex}.dynamicFields`, nextDynamicFieldValues, {
				shouldDirty: true,
				shouldValidate: false,
			});
		}
	}, [dynamicFieldSchemaByProductId, itemValues, setValue]);

	function handleItemCustomerQueryChange(
		itemIndex: number,
		itemFieldId: string,
		value: string,
	) {
		const selectedCustomerId = itemValues[itemIndex]?.customerId ?? "";
		const selectedCustomer = customers.find(
			(customer) => customer.id === selectedCustomerId,
		);
		if (!selectedCustomer) {
			setItemCustomerQueryByFieldId((currentValue) => ({
				...currentValue,
				[itemFieldId]: value,
			}));
			return;
		}

		const normalizedInput = normalizeCustomerSearchValue(value);
		const normalizedSelectedCustomerName = normalizeCustomerSearchValue(
			selectedCustomer.name,
		);
		if (normalizedInput === normalizedSelectedCustomerName) {
			setItemCustomerQueryByFieldId((currentValue) => ({
				...currentValue,
				[itemFieldId]: null,
			}));
			return;
		}

		setItemCustomerQueryByFieldId((currentValue) => ({
			...currentValue,
			[itemFieldId]: value,
		}));
		setValue(`items.${itemIndex}.customerId`, "", {
			shouldDirty: true,
			shouldTouch: true,
		});
	}

	function handleSelectItemCustomer(
		itemIndex: number,
		itemFieldId: string,
		customerId: string,
	) {
		setValue(`items.${itemIndex}.customerId`, customerId, {
			shouldDirty: true,
			shouldTouch: true,
			shouldValidate: true,
		});
		setItemCustomerQueryByFieldId((currentValue) => ({
			...currentValue,
			[itemFieldId]: null,
		}));
	}

	function handleOpenItemCustomerEdit(itemFieldId: string) {
		setEditingCustomerItemFieldId(itemFieldId);
	}

	async function handleSelectedCustomerUpdated() {
		try {
			if (onRefreshCustomers) {
				setIsRefreshingCustomers(true);
				await onRefreshCustomers();
			}
		} finally {
			setShouldValidateItemCustomersAfterRefresh(true);
			setEditingCustomerItemFieldId(null);
			setIsRefreshingCustomers(false);
		}
	}

	async function handleValidSubmit(values: QuickSaleFormSubmitData) {
		setSubmitError(null);

		const payload = buildQuickSaleBatchPayload({
			values,
			dynamicFieldSchemaByProductId,
		});

		try {
			await onSubmitBatch(payload);
			onSuccess?.();
		} catch (error) {
			setSubmitError(resolveErrorMessage(normalizeApiError(error)));
		}
	}

	function handleAddItem() {
		if (!canAddQuickSaleItem(totalReplicatedItems)) {
			return;
		}

		const lastItemProductId = itemValues[itemValues.length - 1]?.productId;
		const lastItemCustomerId = itemValues[itemValues.length - 1]?.customerId;
		const defaultNewItemProductId =
			lastItemProductId && scopedItemProductIdSet.has(lastItemProductId)
				? lastItemProductId
				: selectedParentProductId || undefined;

		append(
			createQuickSaleItemDraft(
				defaultNewItemProductId,
				lastItemCustomerId || undefined,
			),
		);
	}

	function handleCopyItem(itemIndex: number) {
		const sourceItem = itemValues[itemIndex];
		if (!sourceItem) {
			return;
		}

		const sourceItemQuantity = resolveQuickSaleItemQuantity(sourceItem);
		if (!canAddQuickSaleItem(totalReplicatedItems + sourceItemQuantity - 1)) {
			return;
		}

		append({
			...sourceItem,
			dynamicFields: cloneQuickSaleItemDynamicFields(sourceItem.dynamicFields),
		});
	}

	return (
		<form onSubmit={handleSubmit(handleValidSubmit)} className="space-y-6">
			<Card className="rounded-sm gap-4 p-5">
				<h2 className="font-semibold text-md">Produto Pai</h2>
				<FieldGroup>
					<Field className="gap-1">
						<FieldLabel>Produto pai *</FieldLabel>
						<Controller
							control={control}
							name="parentProductId"
							render={({ field, fieldState }) => (
								<>
									<Select
										value={field.value || undefined}
										onValueChange={(nextParentProductId) => {
											field.onChange(nextParentProductId);
										}}
									>
										<SelectTrigger>
											<SelectValue placeholder="Selecione o produto pai" />
										</SelectTrigger>
										<SelectContent>
											{rootProducts.map((product) => (
												<SelectItem key={product.id} value={product.id}>
													{product.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									<FieldError error={fieldState.error} />
								</>
							)}
						/>
					</Field>
				</FieldGroup>
			</Card>

			<Card className="rounded-sm gap-4 p-5">
				<h2 className="font-semibold text-md">Classificação da Venda</h2>

				<div className="grid gap-4 md:grid-cols-2">
					<FieldGroup>
						<Field className="gap-1">
							<FieldLabel>Empresa *</FieldLabel>
							<Controller
								control={control}
								name="companyId"
								render={({ field, fieldState }) => (
									<>
										<Select
											value={field.value || undefined}
											onValueChange={field.onChange}
										>
											<SelectTrigger>
												<SelectValue placeholder="Selecione uma empresa" />
											</SelectTrigger>
											<SelectContent>
												{companies.map((company) => (
													<SelectItem key={company.id} value={company.id}>
														{company.name}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
										<FieldError error={fieldState.error} />
									</>
								)}
							/>
						</Field>
					</FieldGroup>

					<FieldGroup>
						<Field className="gap-1">
							<FieldLabel>Unidade</FieldLabel>
							<Controller
								control={control}
								name="unitId"
								render={({ field, fieldState }) => (
									<>
										<Select
											value={
												(field.value as string | undefined) ||
												OPTIONAL_NONE_VALUE
											}
											onValueChange={(value) =>
												field.onChange(
													value === OPTIONAL_NONE_VALUE ? "" : value,
												)
											}
											disabled={!selectedCompanyId}
										>
											<SelectTrigger>
												<SelectValue placeholder="Selecione uma unidade" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value={OPTIONAL_NONE_VALUE}>
													Sem unidade
												</SelectItem>
												{companyUnits.map((unit) => (
													<SelectItem key={unit.id} value={unit.id}>
														{unit.name}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
										<FieldError error={fieldState.error} />
									</>
								)}
							/>
						</Field>
					</FieldGroup>

					<FieldGroup>
						<Field className="gap-1">
							<FieldLabel>Tipo de responsável *</FieldLabel>
							<Controller
								control={control}
								name="responsibleType"
								render={({ field, fieldState }) => (
									<>
										<Select
											value={field.value || "SELLER"}
											onValueChange={(value) => {
												field.onChange(value as SaleResponsibleType);
												setValue("responsibleId", "", {
													shouldDirty: true,
													shouldValidate: true,
												});
											}}
										>
											<SelectTrigger>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="SELLER">
													{SALE_RESPONSIBLE_TYPE_LABEL.SELLER}
												</SelectItem>
												<SelectItem value="PARTNER">
													{SALE_RESPONSIBLE_TYPE_LABEL.PARTNER}
												</SelectItem>
											</SelectContent>
										</Select>
										<FieldError error={fieldState.error} />
									</>
								)}
							/>
						</Field>
					</FieldGroup>

					<FieldGroup>
						<Field className="gap-1">
							<FieldLabel>
								{selectedResponsibleType === "PARTNER"
									? "Parceiro *"
									: "Vendedor *"}
							</FieldLabel>
							<Controller
								control={control}
								name="responsibleId"
								render={({ field, fieldState }) => (
									<>
										<Select
											value={field.value || undefined}
											onValueChange={field.onChange}
										>
											<SelectTrigger>
												<SelectValue placeholder="Selecione o responsável" />
											</SelectTrigger>
											<SelectContent>
												{responsibleOptions.map((responsible) => (
													<SelectItem
														key={responsible.id}
														value={responsible.id}
													>
														{responsible.name}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
										<FieldError error={fieldState.error} />
									</>
								)}
							/>
						</Field>
					</FieldGroup>
				</div>
			</Card>

			<Card className="rounded-sm gap-4 p-5">
				<div className="space-y-1">
					<h2 className="font-semibold text-md">Itens da Venda</h2>
					<p className="text-muted-foreground text-sm">
						Adicione itens e defina a quantidade. O total de vendas geradas é
						limitado a {QUICK_SALE_BATCH_MAX_ITEMS}.
					</p>
				</div>
				<div className="sticky top-[calc(env(safe-area-inset-top)+4rem)] z-40 flex justify-end">
					<Button
						type="button"
						variant="outline"
						onClick={handleAddItem}
						disabled={!canAddQuickSaleItem(totalReplicatedItems)}
					>
						<Plus className="size-4" />
						Adicionar item
					</Button>
				</div>

				<div className="space-y-4">
					{fields.map((itemField, index) => {
						const itemProductId = itemValues[index]?.productId ?? "";
						const itemCustomerId = itemValues[index]?.customerId ?? "";
						const selectedItemCustomer = customers.find(
							(customer) => customer.id === itemCustomerId,
						);
						const itemCustomerQueryInput =
							itemCustomerQueryByFieldId[itemField.id] ?? null;
						const itemCustomerQuery =
							itemCustomerQueryInput ?? selectedItemCustomer?.name ?? "";
						const isItemQueryingCustomers = itemCustomerQueryInput !== null;
						const trimmedItemCustomerQuery = itemCustomerQuery.trim();
						const normalizedItemCustomerQuery =
							normalizeCustomerSearchValue(itemCustomerQuery);
						const hasMinimumItemCustomerQueryLength =
							normalizedItemCustomerQuery.length >=
							MIN_SALE_CUSTOMER_SEARCH_LENGTH;
						const suggestedItemCustomers = filterCustomersForSaleSearch(
							customers,
							itemCustomerQuery,
						);
						const itemDynamicFieldSchema =
							dynamicFieldSchemaByProductId[itemProductId] ?? [];
						const itemDynamicFieldQuery =
							dynamicFieldQueryByProductId.get(itemProductId);
						const isItemDynamicFieldsLoading = Boolean(
							itemProductId &&
								(itemDynamicFieldQuery?.isLoading ||
									itemDynamicFieldQuery?.isFetching),
						);

						return (
							<Card key={itemField.id} className="gap-4 rounded-sm border p-4">
								<div className="flex items-center justify-between gap-3">
									<h3 className="font-medium text-sm">Item {index + 1}</h3>
									<div className="flex items-center gap-1">
										<Button
											type="button"
											variant="ghost"
											size="icon"
											onClick={() => handleCopyItem(index)}
											disabled={
												!canAddQuickSaleItem(
													totalReplicatedItems +
														resolveQuickSaleItemQuantity(
															itemValues[index] ?? {},
														) -
														1,
												)
											}
											aria-label={`Duplicar item ${index + 1}`}
										>
											<Copy className="size-4" />
										</Button>
										<Button
											type="button"
											variant="ghost"
											size="icon"
											onClick={() => {
												if (!canRemoveQuickSaleItem(fields.length)) {
													return;
												}

												remove(index);
											}}
											disabled={!canRemoveQuickSaleItem(fields.length)}
											aria-label={`Remover item ${index + 1}`}
										>
											<Trash2 className="size-4 text-destructive" />
										</Button>
									</div>
								</div>

								<div className="overflow-x-auto pb-2">
									<div className="pr-2">
										<div className="grid min-w-[1040px] gap-3 px-0.5 py-1 md:grid-cols-4">
											<FieldGroup>
												<Field className="gap-1">
													<FieldLabel>Produto do item *</FieldLabel>
													<Controller
														control={control}
														name={`items.${index}.productId`}
														render={({ field, fieldState }) => (
															<>
																<Select
																	value={field.value || undefined}
																	onValueChange={(value) => {
																		field.onChange(value);
																		setValue(
																			`items.${index}.dynamicFields`,
																			{},
																			{
																				shouldDirty: true,
																			},
																		);
																	}}
																	disabled={!selectedParentProductId}
																>
																	<SelectTrigger>
																		<SelectValue placeholder="Selecione o produto do item" />
																	</SelectTrigger>
																	<SelectContent>
																		{scopedItemProducts.map((productOption) => (
																			<SelectItem
																				key={productOption.id}
																				value={productOption.id}
																			>
																				{productOption.depth > 0 ? "-> " : ""}
																				{productOption.label}
																			</SelectItem>
																		))}
																	</SelectContent>
																</Select>
																<FieldError error={fieldState.error} />
															</>
														)}
													/>
												</Field>
											</FieldGroup>

											<FieldGroup>
												<Field className="gap-1">
													<FieldLabel>Data da venda *</FieldLabel>
													<Controller
														control={control}
														name={`items.${index}.saleDate`}
														render={({ field, fieldState }) => (
															<>
																<CalendarDateInput
																	value={field.value ?? ""}
																	onChange={field.onChange}
																	aria-invalid={fieldState.invalid}
																/>
																<FieldError error={fieldState.error} />
															</>
														)}
													/>
												</Field>
											</FieldGroup>

											<FieldGroup>
												<Field className="gap-1">
													<FieldLabel>Quantidade *</FieldLabel>
													<Controller
														control={control}
														name={`items.${index}.quantity`}
														render={({ field, fieldState }) => (
															<>
																<Input
																	type="number"
																	min={1}
																	step={1}
																	value={field.value ?? "1"}
																	onChange={(event) => {
																		const nextValue = event.target.value
																			.replace(/\D/g, "")
																			.slice(0, 3);
																		field.onChange(nextValue);
																	}}
																/>
																<FieldError error={fieldState.error} />
															</>
														)}
													/>
												</Field>
											</FieldGroup>

											<FieldGroup>
												<Field className="gap-1">
													<FieldLabel>Valor da venda *</FieldLabel>
													<Controller
														control={control}
														name={`items.${index}.totalAmount`}
														render={({ field, fieldState }) => (
															<>
																<Input
																	value={field.value ?? ""}
																	placeholder="R$ 0,00"
																	onChange={(event) =>
																		field.onChange(
																			formatCurrencyBRL(event.target.value),
																		)
																	}
																/>
																<FieldError error={fieldState.error} />
															</>
														)}
													/>
												</Field>
											</FieldGroup>
										</div>
									</div>
								</div>

								<div className="space-y-3 rounded-md border bg-muted/20 p-3">
									<p className="font-medium text-sm">Cliente do item *</p>
									<div className="grid gap-3 md:grid-cols-2">
										<div className="space-y-2">
											<p className="text-muted-foreground text-xs">
												Buscar cliente
											</p>
											<Controller
												control={control}
												name={`items.${index}.customerId`}
												render={({ fieldState }) => (
													<>
														<Input
															value={itemCustomerQuery}
															onChange={(event) =>
																handleItemCustomerQueryChange(
																	index,
																	itemField.id,
																	event.target.value,
																)
															}
															placeholder="Digite o nome, documento ou celular do cliente"
															disabled={isRefreshingCustomers}
														/>
														{isItemQueryingCustomers &&
														!isRefreshingCustomers ? (
															<div className="space-y-2">
																{hasMinimumItemCustomerQueryLength ? (
																	<div className="max-h-64 overflow-y-auto rounded-md border bg-background">
																		{suggestedItemCustomers.length === 0 ? (
																			<p className="p-2 text-sm text-muted-foreground">
																				Nenhum cliente encontrado.
																			</p>
																		) : (
																			suggestedItemCustomers.map((customer) => {
																				const isSelected =
																					selectedItemCustomer?.id ===
																					customer.id;
																				const customerDocumentLabel =
																					customer.documentType === "CPF"
																						? formatDocument({
																								type: "CPF",
																								value: customer.documentNumber,
																							})
																						: customer.documentNumber;
																				const customerPhoneLabel =
																					customer.phone
																						? formatPhone(customer.phone)
																						: "Sem celular";

																				return (
																					<button
																						key={customer.id}
																						type="button"
																						className={cn(
																							"flex w-full flex-col items-start gap-0.5 px-2 py-2 text-left text-sm transition-colors hover:bg-accent",
																							isSelected && "bg-accent",
																						)}
																						onClick={() =>
																							handleSelectItemCustomer(
																								index,
																								itemField.id,
																								customer.id,
																							)
																						}
																					>
																						<span className="font-medium">
																							{customer.name}
																						</span>
																						<span className="text-xs text-muted-foreground">
																							{customerDocumentLabel} •{" "}
																							{customerPhoneLabel}
																						</span>
																					</button>
																				);
																			})
																		)}
																	</div>
																) : trimmedItemCustomerQuery.length > 0 ? (
																	<p className="text-muted-foreground text-xs">
																		Digite pelo menos{" "}
																		{MIN_SALE_CUSTOMER_SEARCH_LENGTH} letras
																		para buscar clientes.
																	</p>
																) : null}
															</div>
														) : null}
														<FieldError error={fieldState.error} />
													</>
												)}
											/>
										</div>

										<div className="space-y-2 rounded-md border bg-background/70 p-3">
											<div className="flex items-center justify-between gap-2">
												<p className="text-muted-foreground text-xs">
													Resumo do cliente
												</p>
												{selectedItemCustomer ? (
													<Button
														type="button"
														variant="link"
														className="h-auto px-0 text-xs"
														onClick={() =>
															handleOpenItemCustomerEdit(itemField.id)
														}
													>
														Editar cliente
													</Button>
												) : null}
											</div>
											{selectedItemCustomer ? (
												<div className="space-y-1 text-sm">
													<p>
														<strong>Nome:</strong> {selectedItemCustomer.name}
													</p>
													<p>
														<strong>
															{selectedItemCustomer.documentType === "CPF"
																? "CPF"
																: selectedItemCustomer.documentType}
															:
														</strong>{" "}
														{selectedItemCustomer.documentType === "CPF"
															? formatDocument({
																	type: "CPF",
																	value: selectedItemCustomer.documentNumber,
																})
															: selectedItemCustomer.documentNumber}
													</p>
													<p>
														<strong>Celular:</strong>{" "}
														{selectedItemCustomer.phone
															? formatPhone(selectedItemCustomer.phone)
															: "Não informado"}
													</p>
												</div>
											) : (
												<p className="text-muted-foreground text-sm">
													Nenhum cliente selecionado.
												</p>
											)}
										</div>
									</div>
								</div>

								<div className="space-y-2 border-t pt-4">
									<p className="font-medium text-sm">
										Campos personalizados do item
									</p>
									<QuickSaleItemDynamicFieldsSection
										itemIndex={index}
										itemProductId={itemProductId}
										control={control}
										dynamicFieldSchema={itemDynamicFieldSchema}
										isLoading={isItemDynamicFieldsLoading}
									/>
								</div>
							</Card>
						);
					})}
				</div>
				<p
					className={cn(
						"text-sm",
						totalReplicatedItems > QUICK_SALE_BATCH_MAX_ITEMS
							? "text-destructive"
							: "text-muted-foreground",
					)}
				>
					Total de vendas a gerar: {totalReplicatedItems}/
					{QUICK_SALE_BATCH_MAX_ITEMS}
				</p>
				{typeof errors.items?.message === "string" ? (
					<p className="text-destructive text-sm">{errors.items.message}</p>
				) : null}
			</Card>

			{submitError ? (
				<Card className="rounded-sm border-destructive/50 p-4">
					<p className="text-destructive text-sm">{submitError}</p>
				</Card>
			) : null}
			{(() => {
				const editingItemIndex = fields.findIndex(
					(field) => field.id === editingCustomerItemFieldId,
				);
				const editingItemCustomerId =
					editingItemIndex >= 0
						? (itemValues[editingItemIndex]?.customerId ?? "")
						: "";
				return (
					<EditSelectedCustomerDialog
						open={Boolean(editingCustomerItemFieldId)}
						customerId={editingItemCustomerId || undefined}
						onOpenChange={(open) => {
							if (!open) {
								setEditingCustomerItemFieldId(null);
							}
						}}
						onUpdated={handleSelectedCustomerUpdated}
					/>
				);
			})()}

			<div className="flex justify-end">
				<Button type="submit" disabled={isSubmitting}>
					{isSubmitting ? "Salvando..." : "Salvar vendas"}
				</Button>
			</div>
		</form>
	);
}
