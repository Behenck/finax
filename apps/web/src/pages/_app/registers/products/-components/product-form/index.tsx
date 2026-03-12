import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import {
	Controller,
	type FieldErrors,
	useFieldArray,
	useForm,
	useWatch,
} from "react-hook-form";
import { toast } from "sonner";
import { FieldError as FormFieldError } from "@/components/field-error";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApp } from "@/context/app-context";
import { resolveErrorMessage } from "@/errors";
import { normalizeApiError } from "@/errors/api-error";
import {
	getOrganizationsSlugProductsIdCommissionScenariosQueryKey,
	getOrganizationsSlugProductsIdSaleFieldsQueryKey,
	getOrganizationsSlugProductsQueryKey,
	useGetOrganizationsSlugCompanies,
	useGetOrganizationsSlugMembersRole,
	useGetOrganizationsSlugPartners,
	useGetOrganizationsSlugProductsIdCommissionScenarios,
	useGetOrganizationsSlugProductsIdSaleFields,
	useGetOrganizationsSlugSellers,
	usePostOrganizationsSlugProducts,
	usePutOrganizationsSlugProductsId,
	usePutOrganizationsSlugProductsIdCommissionScenarios,
	usePutOrganizationsSlugProductsIdSaleFields,
} from "@/http/generated";
import {
	type ProductFormData,
	productSchema,
} from "@/schemas/product-schema";
import {
	SALE_DYNAMIC_FIELD_TYPE_LABEL,
	SALE_DYNAMIC_FIELD_TYPE_VALUES,
	type SaleDynamicFieldType,
} from "@/schemas/types/sale-dynamic-fields";
import type { ProductListItem } from "@/schemas/types/product";
import { ChevronDown, ChevronUp, CirclePlus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ScenarioTabContent } from "./-components/scenario-tab-content";
import {
	createDefaultScenario,
	distributeInstallments,
	mapApiScenarioToForm,
	mapScenariosToPayload,
} from "./-utils/helpers";
import type { SelectOption } from "./-utils/types";

interface ProductFormProps {
	onSuccess?: () => void;
	mode?: "create" | "edit";
	initialData?: ProductListItem;
	fixedParentId?: string;
	duplicateFromProductId?: string;
	duplicateFromProductName?: string;
	duplicateParentId?: string | null;
}

function isDatabaseSchemaOutdatedMessage(message: string) {
	return message.toLowerCase().includes("estrutura do banco desatualizada");
}

function resolveFirstFormErrorMessage(value: unknown): string | null {
	if (!value || typeof value !== "object") {
		return null;
	}

	const recordValue = value as Record<string, unknown>;

	if (
		typeof recordValue.message === "string" &&
		recordValue.message.trim().length > 0
	) {
		return recordValue.message;
	}

	for (const nestedValue of Object.values(recordValue)) {
		const nestedMessage = resolveFirstFormErrorMessage(nestedValue);
		if (nestedMessage) {
			return nestedMessage;
		}
	}

	return null;
}

export function ProductForm({
	onSuccess,
	mode = "create",
	initialData,
	fixedParentId,
	duplicateFromProductId,
	duplicateFromProductName,
	duplicateParentId,
}: ProductFormProps) {
	const { organization } = useApp();
	const queryClient = useQueryClient();
	const initializedFromApiRef = useRef(false);

	const { mutateAsync: createProduct, isPending: isCreating } =
		usePostOrganizationsSlugProducts();
	const { mutateAsync: updateProduct, isPending: isUpdating } =
		usePutOrganizationsSlugProductsId();
	const { mutateAsync: replaceCommissionScenarios, isPending: isSavingScenarios } =
		usePutOrganizationsSlugProductsIdCommissionScenarios();
	const { mutateAsync: replaceProductSaleFields, isPending: isSavingSaleFields } =
		usePutOrganizationsSlugProductsIdSaleFields();

	const isEditMode = mode === "edit" && !!initialData;
	const sourceProductId = isEditMode
		? initialData?.id ?? ""
		: duplicateFromProductId ?? "";
	const shouldLoadSourceProductData = Boolean(sourceProductId);
	const duplicateProductName =
		duplicateFromProductName?.trim() ?? "";

	const { data: companiesData } = useGetOrganizationsSlugCompanies(
		{ slug: organization?.slug ?? "" },
		{ query: { enabled: !!organization?.slug } },
	);

	const { data: sellersData } = useGetOrganizationsSlugSellers(
		{ slug: organization?.slug ?? "" },
		{ query: { enabled: !!organization?.slug } },
	);

	const { data: partnersData } = useGetOrganizationsSlugPartners(
		{ slug: organization?.slug ?? "" },
		{ query: { enabled: !!organization?.slug } },
	);

	const { data: supervisorsData } = useGetOrganizationsSlugMembersRole(
		{ slug: organization?.slug ?? "", role: "SUPERVISOR" },
		{ query: { enabled: !!organization?.slug } },
	);

	const {
		data: scenariosData,
		isLoading: isLoadingScenarios,
		isError: isScenariosError,
		error: scenariosError,
	} = useGetOrganizationsSlugProductsIdCommissionScenarios(
		{ slug: organization?.slug ?? "", id: sourceProductId },
		{
			query: {
				enabled: !!organization?.slug && shouldLoadSourceProductData,
			},
		},
	);
	const {
		data: saleFieldsData,
		isLoading: isLoadingSaleFields,
		isError: isSaleFieldsError,
		error: saleFieldsError,
	} =
		useGetOrganizationsSlugProductsIdSaleFields(
			{ slug: organization?.slug ?? "", id: sourceProductId },
			{
				query: {
					enabled: !!organization?.slug && shouldLoadSourceProductData,
				},
			},
		);

	const form = useForm<ProductFormData>({
		resolver: zodResolver(productSchema),
		defaultValues: {
			name: isEditMode
				? initialData?.name ?? ""
				: duplicateProductName
					? `Cópia de ${duplicateProductName}`
					: "",
			scenarios: [],
			saleFields: [],
		},
	});

	const {
		handleSubmit,
		control,
		register,
		reset,
		setValue,
		getValues,
		clearErrors,
		trigger,
		formState: { errors, isDirty },
	} = form;

	const {
		fields: scenarioFields,
		append: appendScenario,
		remove: removeScenario,
	} = useFieldArray({
		control,
		name: "scenarios",
	});
	const {
		fields: saleFieldFields,
		append: appendSaleField,
		remove: removeSaleField,
		move: moveSaleField,
	} = useFieldArray({
		control,
		name: "saleFields",
	});

	const scenarioValues = useWatch({ control, name: "scenarios" }) ?? [];
	const saleFieldValues = useWatch({ control, name: "saleFields" }) ?? [];

	const [activeScenarioTab, setActiveScenarioTab] = useState("");
	const [activeProductConfigTab, setActiveProductConfigTab] =
		useState("commission-scenarios");
	const isPending =
		isCreating || isUpdating || isSavingScenarios || isSavingSaleFields;
	const resolvedActiveScenarioTab = scenarioFields.some(
		(_, scenarioIndex) => `scenario-${scenarioIndex}` === activeScenarioTab,
	)
		? activeScenarioTab
		: scenarioFields.length > 0
			? "scenario-0"
			: "";

	const companyOptions = useMemo<SelectOption[]>(() => {
		const companies = companiesData?.companies ?? [];
		return companies.map((company) => ({
			id: company.id,
			label: company.name,
		}));
	}, [companiesData?.companies]);

	const unitOptions = useMemo<SelectOption[]>(() => {
		const companies = companiesData?.companies ?? [];
		return companies.flatMap((company) =>
			company.units.map((unit) => ({
				id: unit.id,
				label: `${company.name} -> ${unit.name}`,
			})),
		);
	}, [companiesData?.companies]);

	const sellerOptions = useMemo<SelectOption[]>(() => {
		const sellers = sellersData?.sellers ?? [];
		return sellers
			.filter((seller) => seller.status === "ACTIVE")
			.map((seller) => ({
				id: seller.id,
				label: seller.name,
			}));
	}, [sellersData?.sellers]);

	const partnerOptions = useMemo<SelectOption[]>(() => {
		const partners = partnersData?.partners ?? [];
		return partners.map((partner) => ({
			id: partner.id,
			label: partner.name,
		}));
	}, [partnersData?.partners]);

	const supervisorOptions = useMemo<SelectOption[]>(() => {
		const members = supervisorsData?.members ?? [];
		return members.map((member) => ({
			id: member.id,
			label: member.name ?? member.email,
		}));
	}, [supervisorsData?.members]);

	const scenariosLoadErrorMessage = useMemo(() => {
		if (!isScenariosError) {
			return null;
		}

		return resolveErrorMessage(normalizeApiError(scenariosError));
	}, [isScenariosError, scenariosError]);

	const saleFieldsLoadErrorMessage = useMemo(() => {
		if (!isSaleFieldsError) {
			return null;
		}

		return resolveErrorMessage(normalizeApiError(saleFieldsError));
	}, [isSaleFieldsError, saleFieldsError]);

	useEffect(() => {
		if (!shouldLoadSourceProductData) return;
		if (isLoadingScenarios || isLoadingSaleFields) return;
		if (initializedFromApiRef.current && isDirty) return;

		const currentName = getValues("name").trim();
		const resolvedName = isEditMode
			? initialData?.name ?? ""
			: currentName ||
				(duplicateProductName ? `Cópia de ${duplicateProductName}` : "");

		reset({
			name: resolvedName,
			scenarios:
				(scenariosData?.scenarios ?? []).length > 0
					? (scenariosData?.scenarios ?? []).map(mapApiScenarioToForm)
					: [],
			saleFields: (saleFieldsData?.fields ?? []).map((field) => ({
				label: field.label,
				type: field.type as SaleDynamicFieldType,
				required: field.required,
				options: field.options.map((option) => ({
					label: option.label,
					isDefault: option.isDefault,
				})),
			})),
		});
		initializedFromApiRef.current = true;
	}, [
		duplicateProductName,
		getValues,
		initialData,
		isDirty,
		isEditMode,
		isLoadingSaleFields,
		isLoadingScenarios,
		reset,
		saleFieldsData,
		scenariosData,
		shouldLoadSourceProductData,
	]);

	useEffect(() => {
		initializedFromApiRef.current = false;
	}, [mode, sourceProductId]);

	const invalidateProducts = async () => {
		await queryClient.invalidateQueries({
			queryKey: getOrganizationsSlugProductsQueryKey({
				slug: organization!.slug,
			}),
		});
	};

	const invalidateProductCommissionScenarios = async (productId: string) => {
		await queryClient.invalidateQueries({
			queryKey: getOrganizationsSlugProductsIdCommissionScenariosQueryKey({
				slug: organization!.slug,
				id: productId,
			}),
		});
	};

	const invalidateProductSaleFields = async (productId: string) => {
		await queryClient.invalidateQueries({
			queryKey: getOrganizationsSlugProductsIdSaleFieldsQueryKey({
				slug: organization!.slug,
				id: productId,
			}),
		});
	};

	const handleAddScenario = () => {
		const nextIndex = scenarioFields.length;
		appendScenario(createDefaultScenario(`Cenário ${nextIndex + 1}`));
		setActiveScenarioTab(`scenario-${nextIndex}`);
	};

	const handleRemoveScenario = (index: number) => {
		const nextLength = scenarioFields.length - 1;
		removeScenario(index);
		if (nextLength <= 0) {
			setActiveScenarioTab("");
			return;
		}

		const nextTabIndex = index >= nextLength ? nextLength - 1 : index;
		setActiveScenarioTab(`scenario-${nextTabIndex}`);
	};

	const handleAddSaleField = () => {
		appendSaleField({
			label: "",
			type: "TEXT",
			required: false,
			options: [],
		});
	};

	const handleMoveSaleField = (fromIndex: number, toIndex: number) => {
		if (
			fromIndex < 0 ||
			toIndex < 0 ||
			fromIndex >= saleFieldFields.length ||
			toIndex >= saleFieldFields.length ||
			fromIndex === toIndex
		) {
			return;
		}

		moveSaleField(fromIndex, toIndex);
		clearErrors("saleFields");
		void trigger("saleFields");
	};

	const handleAddSaleFieldOption = (fieldIndex: number) => {
		const currentOptions = getValues(`saleFields.${fieldIndex}.options`) ?? [];
		setValue(
			`saleFields.${fieldIndex}.options`,
			[
				...currentOptions,
				{
					label: "",
					isDefault: false,
				},
			],
			{
				shouldDirty: true,
				shouldValidate: true,
			},
		);
	};

	const handleRemoveSaleFieldOption = (
		fieldIndex: number,
		optionIndex: number,
	) => {
		const currentOptions = getValues(`saleFields.${fieldIndex}.options`) ?? [];
		setValue(
			`saleFields.${fieldIndex}.options`,
			currentOptions.filter((_option, index) => index !== optionIndex),
			{
				shouldDirty: true,
				shouldValidate: true,
			},
		);
	};

	const handleToggleSaleFieldOptionDefault = (
		fieldIndex: number,
		optionIndex: number,
		checked: boolean,
	) => {
		const currentOptions = getValues(`saleFields.${fieldIndex}.options`) ?? [];
		const fieldType = getValues(`saleFields.${fieldIndex}.type`);
		const nextOptions = currentOptions.map((option, index) => {
			if (fieldType === "SELECT" && checked) {
				return {
					...option,
					isDefault: index === optionIndex,
				};
			}

			if (index !== optionIndex) {
				return option;
			}

			return {
				...option,
				isDefault: checked,
			};
		});

		setValue(`saleFields.${fieldIndex}.options`, nextOptions, {
			shouldDirty: true,
			shouldValidate: true,
		});
	};

	const handleInstallmentCountChange = (
		scenarioIndex: number,
		commissionIndex: number,
		nextCount: number,
	) => {
		const totalPercentage = getValues(
			`scenarios.${scenarioIndex}.commissions.${commissionIndex}.totalPercentage`,
		);
		setValue(
			`scenarios.${scenarioIndex}.commissions.${commissionIndex}.installments`,
			distributeInstallments(totalPercentage, nextCount),
			{
				shouldDirty: true,
				shouldValidate: true,
			},
		);
	};

	const saveProductCommissionScenarios = async (
		productId: string,
		scenarios: ProductFormData["scenarios"],
	) => {
		await replaceCommissionScenarios({
			slug: organization!.slug,
			id: productId,
			data: {
				scenarios: mapScenariosToPayload(scenarios),
			},
		});
	};

	const saveProductSaleFields = async (
		productId: string,
		saleFields: ProductFormData["saleFields"],
	) => {
		await replaceProductSaleFields({
			slug: organization!.slug,
			id: productId,
			data: {
				fields: saleFields.map((field) => ({
					label: field.label.trim(),
					type: field.type,
					required: field.required,
					options:
						field.type === "SELECT" || field.type === "MULTI_SELECT"
							? field.options.map((option) => ({
									label: option.label.trim(),
									isDefault: Boolean(option.isDefault),
								}))
							: [],
				})),
			},
		});
	};

	const onSubmit = async (data: ProductFormData) => {
		const name = data.name.trim();

		if (!isEditMode) {
			let createdProductId: string;
			try {
				const createdProduct = await createProduct({
					slug: organization!.slug,
					data: {
						name,
						description: null,
						parentId: fixedParentId ?? duplicateParentId ?? null,
					},
				});
				createdProductId = createdProduct.productId;
			} catch (error) {
				const message = resolveErrorMessage(normalizeApiError(error));
				toast.error(message);
				return;
			}

			try {
				await saveProductCommissionScenarios(createdProductId, data.scenarios);
				await saveProductSaleFields(createdProductId, data.saleFields);
				await invalidateProductCommissionScenarios(createdProductId);
				await invalidateProductSaleFields(createdProductId);
				await invalidateProducts();
				toast.success("Produto cadastrado com sucesso");
				onSuccess?.();
			} catch (error) {
				await invalidateProducts();
				const message = resolveErrorMessage(normalizeApiError(error));
				if (isDatabaseSchemaOutdatedMessage(message)) {
					toast.error(
						`Produto cadastrado, mas as regras de comissão/campos não foram salvas. ${message} Execute as migrações no backend ("pnpm --filter @sass/api db:migrate" local ou "pnpm --filter @sass/api db:migrate:deploy" em deploy) e tente novamente.`,
					);
				} else {
					toast.error(
						`Produto cadastrado, mas as regras de comissão/campos não foram salvas. ${message}. Edite o produto para concluir a configuração.`,
					);
				}
				onSuccess?.();
			}
			return;
		}

		if (!initialData) return;

		try {
			await updateProduct({
				slug: organization!.slug,
				id: initialData.id,
				data: {
					name,
					description: initialData.description ?? null,
					parentId: initialData.parentId,
					isActive: initialData.isActive,
					sortOrder: initialData.sortOrder,
				},
			});
		} catch (error) {
			const message = resolveErrorMessage(normalizeApiError(error));
			toast.error(message);
			return;
		}

		try {
			await saveProductCommissionScenarios(initialData.id, data.scenarios);
			await saveProductSaleFields(initialData.id, data.saleFields);
			await invalidateProductCommissionScenarios(initialData.id);
			await invalidateProductSaleFields(initialData.id);
			await invalidateProducts();
			toast.success("Produto atualizado com sucesso");
			onSuccess?.();
		} catch (error) {
			await invalidateProducts();
			const message = resolveErrorMessage(normalizeApiError(error));
			if (isDatabaseSchemaOutdatedMessage(message)) {
				toast.error(
					`Produto atualizado, mas as regras de comissão/campos não foram salvas. ${message} Execute as migrações no backend ("pnpm --filter @sass/api db:migrate" local ou "pnpm --filter @sass/api db:migrate:deploy" em deploy) e tente novamente.`,
				);
			} else {
				toast.error(
					`Produto atualizado, mas as regras de comissão/campos não foram salvas. ${message}. Ajuste os dados e tente novamente.`,
				);
			}
		}
	};

	const onInvalidSubmit = (formErrors: FieldErrors<ProductFormData>) => {
		const message =
			resolveFirstFormErrorMessage(formErrors) ??
			"Revise os campos obrigatórios antes de salvar.";
		toast.error(message);
	};

	return (
		<form
			onSubmit={handleSubmit(onSubmit, onInvalidSubmit)}
			className="space-y-6 py-4 [&_[data-slot=label]]:font-normal [&_span]:font-normal"
		>
			<div className="grid gap-3">
				<FieldGroup>
					<Field className="gap-1">
						<FieldLabel htmlFor="product-name">Nome</FieldLabel>
						<Controller
							name="name"
							control={control}
							render={({ field, fieldState }) => (
								<>
									<Input
										{...field}
										id="product-name"
										type="text"
										placeholder="Digite o nome do produto"
									/>
									<FormFieldError error={fieldState.error} />
								</>
							)}
						/>
					</Field>
				</FieldGroup>
			</div>

			<Tabs
				value={activeProductConfigTab}
				onValueChange={setActiveProductConfigTab}
				className="space-y-4"
			>
				<TabsList className="w-full justify-start rounded-sm **:data-[slot=tab-indicator]:rounded-sm bg-gray-200 p-1">
					<TabsTrigger
						value="commission-scenarios"
						className="rounded-sm font-normal"
					>
						Cenários de comissão
					</TabsTrigger>
					<TabsTrigger value="sale-fields" className="rounded-sm font-normal">
						Campos da venda
					</TabsTrigger>
				</TabsList>

				<TabsContent value="sale-fields" className="space-y-4">
					<div className="flex items-center justify-between">
						<span className="text-sm font-normal">Campos da venda</span>
						<Button
							type="button"
							variant="outline"
							className="font-normal"
							onClick={handleAddSaleField}
						>
							<CirclePlus />
							Adicionar campo
						</Button>
					</div>

					<div className="max-h-[45vh] space-y-3 overflow-y-auto pr-1">
						{shouldLoadSourceProductData && isLoadingSaleFields ? (
							<Card className="p-4">
								<span className="text-muted-foreground text-sm">
									Carregando campos da venda...
								</span>
							</Card>
						) : shouldLoadSourceProductData && isSaleFieldsError ? (
							<Card className="space-y-2 p-4">
								<span className="text-destructive text-sm">
									{saleFieldsLoadErrorMessage ??
										"Não foi possível carregar os campos da venda."}
								</span>
								{isDatabaseSchemaOutdatedMessage(saleFieldsLoadErrorMessage ?? "") ? (
									<p className="text-muted-foreground text-xs">
										Execute as migrações no backend e tente novamente.
									</p>
								) : null}
							</Card>
						) : saleFieldFields.length === 0 ? (
							<Card className="p-4">
								<span className="text-muted-foreground text-sm">
									Nenhum campo personalizado configurado.
								</span>
							</Card>
						) : (
							saleFieldFields.map((saleField, fieldIndex) => {
								const fieldErrors = errors.saleFields?.[fieldIndex];
								const fieldType = saleFieldValues[fieldIndex]?.type ?? "TEXT";
								const isSelectionField =
									fieldType === "SELECT" || fieldType === "MULTI_SELECT";
								const options = saleFieldValues[fieldIndex]?.options ?? [];

								return (
									<Card key={saleField.id} className="space-y-3 p-4">
										<div className="grid gap-3 md:grid-cols-[1fr_220px_120px_auto]">
											<Field className="gap-1">
												<FieldLabel>Nome do campo</FieldLabel>
												<Input
													placeholder="Ex.: Grupo"
													{...register(`saleFields.${fieldIndex}.label` as const)}
												/>
												<FormFieldError error={fieldErrors?.label} />
											</Field>

											<Field className="gap-1">
												<FieldLabel>Tipo</FieldLabel>
												<Controller
													control={control}
													name={`saleFields.${fieldIndex}.type`}
													render={({ field, fieldState }) => (
														<>
															<Select
																value={field.value ?? "TEXT"}
																onValueChange={(value) => {
																	field.onChange(value as SaleDynamicFieldType);
																	const nextIsSelectionField =
																		value === "SELECT" || value === "MULTI_SELECT";
																	if (!nextIsSelectionField) {
																		setValue(
																			`saleFields.${fieldIndex}.options`,
																			[],
																			{
																				shouldDirty: true,
																				shouldValidate: true,
																			},
																		);
																		return;
																	}

																	if (value === "SELECT") {
																		const currentOptions =
																			getValues(`saleFields.${fieldIndex}.options`) ?? [];
																		const firstDefaultIndex = currentOptions.findIndex(
																			(option) => Boolean(option.isDefault),
																		);

																		if (firstDefaultIndex === -1) {
																			return;
																		}

																		setValue(
																			`saleFields.${fieldIndex}.options`,
																			currentOptions.map((option, optionIndex) => ({
																				...option,
																				isDefault: optionIndex === firstDefaultIndex,
																			})),
																			{
																				shouldDirty: true,
																				shouldValidate: true,
																			},
																		);
																	}
																}}
															>
																<SelectTrigger>
																	<SelectValue />
																</SelectTrigger>
																<SelectContent>
																	{SALE_DYNAMIC_FIELD_TYPE_VALUES.map((type) => (
																		<SelectItem key={type} value={type}>
																			{SALE_DYNAMIC_FIELD_TYPE_LABEL[type]}
																		</SelectItem>
																	))}
																</SelectContent>
															</Select>
															<FormFieldError error={fieldState.error} />
														</>
													)}
												/>
											</Field>

											<Field className="gap-2">
												<FieldLabel>Obrigatório</FieldLabel>
												<Controller
													control={control}
													name={`saleFields.${fieldIndex}.required`}
													render={({ field }) => (
														<div className="w-fit">
															<Switch
																checked={Boolean(field.value)}
																onCheckedChange={field.onChange}
															/>
														</div>
													)}
												/>
											</Field>

											<div className="flex items-end gap-1">
												<Button
													type="button"
													variant="outline"
													size="icon"
													onClick={() =>
														handleMoveSaleField(fieldIndex, fieldIndex - 1)
													}
													disabled={fieldIndex === 0}
													aria-label="Subir campo"
												>
													<ChevronUp className="size-4" />
												</Button>
												<Button
													type="button"
													variant="outline"
													size="icon"
													onClick={() =>
														handleMoveSaleField(fieldIndex, fieldIndex + 1)
													}
													disabled={fieldIndex === saleFieldFields.length - 1}
													aria-label="Descer campo"
												>
													<ChevronDown className="size-4" />
												</Button>
												<Button
													type="button"
													variant="outline"
													size="icon"
													onClick={() => removeSaleField(fieldIndex)}
													aria-label="Remover campo"
												>
													<Trash2 className="size-4" />
												</Button>
											</div>
										</div>

										{isSelectionField ? (
											<div className="space-y-2">
												<div className="flex items-center justify-between">
													<span className="text-sm font-medium">Opções</span>
													<Button
														type="button"
														variant="outline"
														className="font-normal"
														onClick={() => handleAddSaleFieldOption(fieldIndex)}
													>
														<CirclePlus />
														Adicionar opção
													</Button>
												</div>

												{options.length === 0 ? (
													<p className="text-muted-foreground text-sm">
														Adicione ao menos uma opção.
													</p>
												) : (
													<div className="space-y-2">
														{options.map((_option, optionIndex) => (
															<div
																key={`${saleField.id}-option-${optionIndex}`}
																className="flex items-center gap-2"
															>
																<Input
																	placeholder={`Opção ${optionIndex + 1}`}
																	{...register(
																		`saleFields.${fieldIndex}.options.${optionIndex}.label` as const,
																	)}
																/>
																<div className="flex items-center gap-2 rounded-sm border px-2 py-1">
																	<span className="text-sm">Padrão</span>
																	<Switch
																		checked={Boolean(options[optionIndex]?.isDefault)}
																		onCheckedChange={(checked) =>
																			handleToggleSaleFieldOptionDefault(
																				fieldIndex,
																				optionIndex,
																				Boolean(checked),
																			)
																		}
																	/>
																</div>
																<Button
																	type="button"
																	variant="outline"
																	size="icon"
																	onClick={() =>
																		handleRemoveSaleFieldOption(
																			fieldIndex,
																			optionIndex,
																		)
																	}
																	aria-label="Remover opção"
																>
																	<Trash2 className="size-4" />
																</Button>
															</div>
														))}
													</div>
												)}

												<FormFieldError error={fieldErrors?.options} />
											</div>
										) : null}
									</Card>
								);
							})
						)}
					</div>
				</TabsContent>

				<TabsContent value="commission-scenarios" className="space-y-4">
					<div className="flex items-center justify-between">
						<span className="text-sm font-normal">Cenários de comissão</span>
						<Button
							type="button"
							variant="outline"
							className="font-normal"
							onClick={handleAddScenario}
						>
							<CirclePlus />
							Adicionar cenário
						</Button>
					</div>

					<div className="max-h-[60vh] overflow-y-auto pr-1">
						{shouldLoadSourceProductData && isLoadingScenarios ? (
							<Card className="p-4">
								<span className="text-muted-foreground text-sm">
									Carregando cenários de comissão...
								</span>
							</Card>
						) : shouldLoadSourceProductData && isScenariosError ? (
							<Card className="space-y-2 p-4">
								<span className="text-destructive text-sm">
									{scenariosLoadErrorMessage ??
										"Não foi possível carregar os cenários de comissão."}
								</span>
								{isDatabaseSchemaOutdatedMessage(scenariosLoadErrorMessage ?? "") ? (
									<p className="text-muted-foreground text-xs">
										Execute as migrações no backend e tente novamente.
									</p>
								) : null}
							</Card>
						) : scenarioFields.length === 0 ? (
							<Card className="p-4">
								<span className="text-muted-foreground text-sm">
									Nenhum cenário configurado. Clique em "Adicionar cenário" para
									criar.
								</span>
							</Card>
						) : (
							<Tabs
								value={resolvedActiveScenarioTab}
								onValueChange={setActiveScenarioTab}
							>
								<TabsList className="w-full justify-start rounded-sm **:data-[slot=tab-indicator]:rounded-sm bg-gray-200 p-1">
									{scenarioFields.map((scenarioField, scenarioIndex) => {
										const tabName = scenarioValues[scenarioIndex]?.name?.trim();
										const label = tabName || `Cenário ${scenarioIndex + 1}`;

										return (
											<TabsTrigger
												key={scenarioField.id}
												value={`scenario-${scenarioIndex}`}
												className="grow-0 rounded-sm font-normal"
											>
												{label}
											</TabsTrigger>
										);
									})}
								</TabsList>

								{scenarioFields.map((scenarioField, scenarioIndex) => (
									<TabsContent
										key={scenarioField.id}
										value={`scenario-${scenarioIndex}`}
									>
										<ScenarioTabContent
											control={control}
											errors={errors}
											scenarioIndex={scenarioIndex}
											companyOptions={companyOptions}
											partnerOptions={partnerOptions}
											unitOptions={unitOptions}
											sellerOptions={sellerOptions}
											supervisorOptions={supervisorOptions}
											setValue={setValue}
											getValues={getValues}
											canRemove
											onRemoveScenario={handleRemoveScenario}
											onInstallmentCountChange={handleInstallmentCountChange}
										/>
									</TabsContent>
								))}
							</Tabs>
						)}
					</div>
				</TabsContent>
			</Tabs>

			<div className="flex justify-end gap-2">
				<Button type="submit" disabled={isPending}>
					{isPending ? "Salvando..." : "Salvar"}
				</Button>
			</div>
		</form>
	);
}
