import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import {
	Controller,
	type Control,
	type FieldErrors,
	type UseFormGetValues,
	type UseFormSetValue,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApp } from "@/context/app-context";
import { resolveErrorMessage } from "@/errors";
import { normalizeApiError } from "@/errors/api-error";
import {
	getOrganizationsSlugProductsQueryKey,
	type GetOrganizationsSlugProductsIdCommissionScenarios200,
	useGetOrganizationsSlugCompanies,
	useGetOrganizationsSlugMembersRole,
	useGetOrganizationsSlugPartners,
	useGetOrganizationsSlugProductsIdCommissionScenarios,
	useGetOrganizationsSlugSellers,
	usePostOrganizationsSlugProducts,
	usePutOrganizationsSlugProductsId,
	usePutOrganizationsSlugProductsIdCommissionScenarios,
} from "@/http/generated";
import {
	type ProductCommissionFormData,
	type ProductCommissionScenarioFormData,
	type ProductFormData,
	productSchema,
} from "@/schemas/product-schema";
import type { ProductListItem } from "@/schemas/types/product";
import { CirclePlus, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

interface ProductFormProps {
	onSuccess?: () => void;
	mode?: "create" | "edit";
	initialData?: ProductListItem;
	fixedParentId?: string;
}

interface SelectOption {
	id: string;
	label: string;
}

const PERCENTAGE_SCALE = 10_000;
const DEFAULT_SCENARIO_NAME = "Venda padrão";

const CONDITION_OPTIONS = [
	{ value: "COMPANY", label: "Empresa" },
	{ value: "PARTNER", label: "Parceiro" },
	{ value: "UNIT", label: "Unidade" },
	{ value: "SELLER", label: "Vendedor" },
] as const;

const RECIPIENT_OPTIONS = [
	{ value: "COMPANY", label: "Empresa" },
	{ value: "UNIT", label: "Unidade" },
	{ value: "SELLER", label: "Vendedor" },
	{ value: "SUPERVISOR", label: "Supervisor" },
	{ value: "OTHER", label: "Outro" },
] as const;

function roundPercentage(value: number) {
	return (
		Math.round((Number(value || 0) + Number.EPSILON) * PERCENTAGE_SCALE) /
		PERCENTAGE_SCALE
	);
}

function distributeInstallments(totalPercentage: number, count: number) {
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

function createDefaultCommission(): ProductCommissionFormData {
	return {
		recipientType: "COMPANY",
		beneficiaryId: undefined,
		beneficiaryLabel: undefined,
		totalPercentage: 1,
		installments: distributeInstallments(1, 1),
	};
}

function createDefaultScenario(name = DEFAULT_SCENARIO_NAME): ProductCommissionScenarioFormData {
	return {
		name,
		conditions: [],
		commissions: [],
	};
}

function mapApiScenarioToForm(
	scenario: GetOrganizationsSlugProductsIdCommissionScenarios200["scenarios"][number],
): ProductCommissionScenarioFormData {
	return {
		name: scenario.name,
		conditions: scenario.conditions.map((condition) => ({
			type: condition.type,
			valueId: condition.valueId,
		})),
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

function mapScenariosToPayload(scenarios: ProductFormData["scenarios"]) {
	return scenarios.map((scenario) => ({
		name: scenario.name.trim(),
		conditions: scenario.conditions,
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

function ScenarioConditionRow({
	control,
	errors,
	scenarioIndex,
	conditionIndex,
	removeCondition,
	setValue,
	companyOptions,
	partnerOptions,
	unitOptions,
	sellerOptions,
}: {
	control: Control<ProductFormData>;
	errors: FieldErrors<ProductFormData>;
	scenarioIndex: number;
	conditionIndex: number;
	removeCondition(index: number): void;
	setValue: UseFormSetValue<ProductFormData>;
	companyOptions: SelectOption[];
	partnerOptions: SelectOption[];
	unitOptions: SelectOption[];
	sellerOptions: SelectOption[];
}) {
	const conditionType = useWatch({
		control,
		name: `scenarios.${scenarioIndex}.conditions.${conditionIndex}.type`,
	}) as ProductCommissionScenarioFormData["conditions"][number]["type"];

	const conditionErrors =
		errors.scenarios?.[scenarioIndex]?.conditions?.[conditionIndex];

	const valueOptions =
		conditionType === "COMPANY"
			? companyOptions
			: conditionType === "PARTNER"
				? partnerOptions
				: conditionType === "UNIT"
					? unitOptions
					: sellerOptions;

	return (
		<div className="grid gap-2 rounded-md border p-3 md:grid-cols-[200px_1fr_auto] md:items-end">
			<FieldGroup>
				<Field className="gap-1">
					<FieldLabel className="font-normal">Quem vende</FieldLabel>
					<Controller
						name={`scenarios.${scenarioIndex}.conditions.${conditionIndex}.type`}
						control={control}
						render={({ field, fieldState }) => (
							<>
								<Select
									value={field.value}
									onValueChange={(value) => {
										field.onChange(value);
										setValue(
											`scenarios.${scenarioIndex}.conditions.${conditionIndex}.valueId`,
											"",
											{
												shouldDirty: true,
												shouldValidate: false,
											},
										);
									}}
								>
									<SelectTrigger>
										<SelectValue placeholder="Selecione" />
									</SelectTrigger>
									<SelectContent>
										{CONDITION_OPTIONS.map((option) => (
											<SelectItem key={option.value} value={option.value}>
												{option.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<FormFieldError error={fieldState.error} />
							</>
						)}
					/>
				</Field>
			</FieldGroup>

			<FieldGroup>
				<Field className="gap-1">
					<FieldLabel className="font-normal">Nome</FieldLabel>
					<Controller
						name={`scenarios.${scenarioIndex}.conditions.${conditionIndex}.valueId`}
						control={control}
						render={({ field, fieldState }) => (
							<>
								<Select
									value={field.value ?? ""}
									onValueChange={field.onChange}
								>
									<SelectTrigger>
										<SelectValue placeholder="Selecione" />
									</SelectTrigger>
									<SelectContent>
										{valueOptions.map((option) => (
											<SelectItem key={option.id} value={option.id}>
												{option.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<FormFieldError error={fieldState.error} />
							</>
						)}
					/>
				</Field>
			</FieldGroup>

			<Button
				type="button"
				variant="ghost"
				onClick={() => removeCondition(conditionIndex)}
			>
				<Trash2 className="text-red-500 hover:text-red-600" />
			</Button>

			{conditionErrors?.root && (
				<span className="text-destructive text-xs">{conditionErrors.root.message}</span>
			)}
		</div>
	);
}

function ScenarioCommissionCard({
	control,
	errors,
	scenarioIndex,
	commissionIndex,
	companyOptions,
	unitOptions,
	sellerOptions,
	supervisorOptions,
	removeCommission,
	setValue,
	getValues,
	onInstallmentCountChange,
}: {
	control: Control<ProductFormData>;
	errors: FieldErrors<ProductFormData>;
	scenarioIndex: number;
	commissionIndex: number;
	companyOptions: SelectOption[];
	unitOptions: SelectOption[];
	sellerOptions: SelectOption[];
	supervisorOptions: SelectOption[];
	removeCommission(index: number): void;
	setValue: UseFormSetValue<ProductFormData>;
	getValues: UseFormGetValues<ProductFormData>;
	onInstallmentCountChange(
		scenarioIndex: number,
		commissionIndex: number,
		nextCount: number,
	): void;
}) {
	const installmentsFieldPath =
		`scenarios.${scenarioIndex}.commissions.${commissionIndex}.installments` as const;
	const { fields: installmentFields } = useFieldArray({
		control,
		name: installmentsFieldPath,
	});

	const commissionPath = `scenarios.${scenarioIndex}.commissions.${commissionIndex}` as const;
	const recipientType = useWatch({
		control,
		name: `${commissionPath}.recipientType`,
	}) as ProductCommissionFormData["recipientType"];
	const totalPercentage = useWatch({
		control,
		name: `${commissionPath}.totalPercentage`,
	}) as number;

	const commissionErrors =
		errors.scenarios?.[scenarioIndex]?.commissions?.[commissionIndex];

	useEffect(() => {
		if (installmentFields.length !== 1) return;
		const currentValue = getValues(
			`${commissionPath}.installments.0.percentage` as const,
		);
		if (roundPercentage(Number(currentValue ?? 0)) === roundPercentage(totalPercentage)) {
			return;
		}

		setValue(
			`${commissionPath}.installments.0.percentage` as const,
			roundPercentage(totalPercentage),
			{
				shouldDirty: true,
				shouldValidate: true,
			},
		);
	}, [
		commissionPath,
		getValues,
		installmentFields.length,
		setValue,
		totalPercentage,
	]);

	const beneficiaryOptions =
		recipientType === "COMPANY"
			? companyOptions
			: recipientType === "UNIT"
				? unitOptions
				: recipientType === "SELLER"
					? sellerOptions
					: supervisorOptions;

	return (
		<Card className="space-y-4 p-4">
			<div className="grid gap-2 md:grid-cols-[190px_1fr_120px_120px_auto] md:items-end">
				<FieldGroup>
					<Field className="gap-1">
						<FieldLabel className="font-normal">Tipo</FieldLabel>
						<Controller
							name={`${commissionPath}.recipientType`}
							control={control}
							render={({ field, fieldState }) => (
								<>
									<Select
										value={field.value}
										onValueChange={(value) => {
											field.onChange(value);
											setValue(`${commissionPath}.beneficiaryId`, undefined, {
												shouldDirty: true,
												shouldValidate: true,
											});
											setValue(`${commissionPath}.beneficiaryLabel`, undefined, {
												shouldDirty: true,
												shouldValidate: true,
											});
										}}
									>
										<SelectTrigger>
											<SelectValue placeholder="Selecione" />
										</SelectTrigger>
										<SelectContent>
											{RECIPIENT_OPTIONS.map((option) => (
												<SelectItem key={option.value} value={option.value}>
													{option.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									<FormFieldError error={fieldState.error} />
								</>
							)}
						/>
					</Field>
				</FieldGroup>

				{recipientType === "OTHER" ? (
					<FieldGroup>
						<Field className="gap-1">
							<FieldLabel className="font-normal">Beneficiário</FieldLabel>
							<Controller
								name={`${commissionPath}.beneficiaryLabel`}
								control={control}
								render={({ field, fieldState }) => (
									<>
										<Input
											{...field}
											value={field.value ?? ""}
											placeholder="Informe o beneficiário"
										/>
										<FormFieldError error={fieldState.error} />
									</>
								)}
							/>
						</Field>
					</FieldGroup>
				) : (
					<FieldGroup>
						<Field className="gap-1">
							<FieldLabel className="font-normal">Beneficiário</FieldLabel>
							<Controller
								name={`${commissionPath}.beneficiaryId`}
								control={control}
								render={({ field, fieldState }) => (
									<>
										<Select
											value={field.value ?? ""}
											onValueChange={field.onChange}
										>
											<SelectTrigger>
												<SelectValue placeholder="Selecione" />
											</SelectTrigger>
											<SelectContent>
												{beneficiaryOptions.map((option) => (
													<SelectItem key={option.id} value={option.id}>
														{option.label}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
										<FormFieldError error={fieldState.error} />
									</>
								)}
							/>
						</Field>
					</FieldGroup>
				)}

				<FieldGroup>
					<Field className="gap-1">
						<FieldLabel className="font-normal">% total</FieldLabel>
						<Controller
							name={`${commissionPath}.totalPercentage`}
							control={control}
							render={({ field, fieldState }) => (
								<>
									<Input
										type="number"
										step="0.0001"
										min={0}
										max={100}
										value={field.value ?? ""}
										onChange={(event) => {
											const value = Number(event.target.value);
											field.onChange(Number.isFinite(value) ? value : 0);
										}}
									/>
									<FormFieldError error={fieldState.error} />
								</>
							)}
						/>
					</Field>
				</FieldGroup>

				<FieldGroup>
					<Field className="gap-1">
						<FieldLabel className="font-normal">Parcelas</FieldLabel>
						<Input
							type="number"
							min={1}
							step={1}
							value={installmentFields.length}
							onChange={(event) => {
								const parsedValue = Number(event.target.value);
								if (!Number.isFinite(parsedValue)) return;
								onInstallmentCountChange(
									scenarioIndex,
									commissionIndex,
									Math.max(1, Math.trunc(parsedValue)),
								);
							}}
						/>
					</Field>
				</FieldGroup>

				<Button
					type="button"
					variant="ghost"
					onClick={() => removeCommission(commissionIndex)}
				>
					<Trash2 className="text-red-500 hover:text-red-600" />
				</Button>
			</div>

			{installmentFields.length > 1 && (
				<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
					{installmentFields.map((installmentField, installmentIndex) => (
						<div key={installmentField.id} className="space-y-1">
							<FieldGroup>
								<Field className="gap-1">
									<FieldLabel className="font-normal">
										Parcela {String(installmentIndex + 1).padStart(2, "0")}
									</FieldLabel>
									<Controller
										name={`${commissionPath}.installments.${installmentIndex}.percentage`}
										control={control}
										render={({ field, fieldState }) => (
											<>
												<Input
													value={field.value ?? ""}
													type="number"
													step="0.0001"
													min={0}
													max={100}
													onChange={(event) => {
														const value = Number(event.target.value);
														field.onChange(Number.isFinite(value) ? value : 0);
													}}
												/>
												<FormFieldError error={fieldState.error} />
											</>
										)}
									/>
								</Field>
							</FieldGroup>
						</div>
					))}
				</div>
			)}

			{commissionErrors?.installments && (
				<span className="text-destructive text-xs">
					{
						(commissionErrors.installments as { message?: string }).message
					}
				</span>
			)}
		</Card>
	);
}

function ScenarioTabContent({
	control,
	errors,
	scenarioIndex,
	companyOptions,
	partnerOptions,
	unitOptions,
	sellerOptions,
	supervisorOptions,
	setValue,
	getValues,
	canRemove,
	onRemoveScenario,
	onInstallmentCountChange,
}: {
	control: Control<ProductFormData>;
	errors: FieldErrors<ProductFormData>;
	scenarioIndex: number;
	companyOptions: SelectOption[];
	partnerOptions: SelectOption[];
	unitOptions: SelectOption[];
	sellerOptions: SelectOption[];
	supervisorOptions: SelectOption[];
	setValue: UseFormSetValue<ProductFormData>;
	getValues: UseFormGetValues<ProductFormData>;
	canRemove: boolean;
	onRemoveScenario(index: number): void;
	onInstallmentCountChange(
		scenarioIndex: number,
		commissionIndex: number,
		nextCount: number,
	): void;
}) {
	const { fields: conditionFields, append: appendCondition, remove: removeCondition } =
		useFieldArray({
			control,
			name: `scenarios.${scenarioIndex}.conditions`,
		});

	const {
		fields: commissionFields,
		append: appendCommission,
		remove: removeCommission,
	} = useFieldArray({
		control,
		name: `scenarios.${scenarioIndex}.commissions`,
	});

	return (
		<div className="space-y-4 rounded-md border p-4">
			<div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
				<FieldGroup>
					<Field className="gap-1">
						<FieldLabel className="font-normal">Nome do cenário</FieldLabel>
						<Controller
							name={`scenarios.${scenarioIndex}.name`}
							control={control}
							render={({ field, fieldState }) => (
								<>
									<Input {...field} placeholder="Nome do cenário" />
									<FormFieldError error={fieldState.error} />
								</>
							)}
						/>
					</Field>
				</FieldGroup>
			</div>

			<div className="space-y-2">
				<span className="text-xs font-normal text-muted-foreground block">Condições (AND)</span>

				{conditionFields.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						Sem condições. Este cenário será aplicado como regra padrão.
					</p>
				) : (
					<div className="space-y-2">
						{conditionFields.map((conditionField, conditionIndex) => (
							<ScenarioConditionRow
								key={conditionField.id}
								control={control}
								errors={errors}
								scenarioIndex={scenarioIndex}
								conditionIndex={conditionIndex}
								removeCondition={removeCondition}
								setValue={setValue}
								companyOptions={companyOptions}
								partnerOptions={partnerOptions}
								unitOptions={unitOptions}
								sellerOptions={sellerOptions}
							/>
						))}
					</div>
				)}
				<FormFieldError error={errors.scenarios?.[scenarioIndex]?.conditions} />
			</div>
			<div className="flex items-center justify-between">
				<Button
					type="button"
					variant="ghost"
					className="font-normal text-sm"
					onClick={() =>
						appendCondition({
							type: "COMPANY",
							valueId: "",
						})
					}
				>
					<Plus className="size-4" />
					Adicionar condição
				</Button>

				<Button
					type="button"
					variant="ghost"
					className="text-red-500 hover:text-red-600 font-normal"
					onClick={() => onRemoveScenario(scenarioIndex)}
					disabled={!canRemove}
				>
					<Trash2 />
					Remover cenário
				</Button>
			</div>

			<div className="space-y-3">
				<div className="flex items-center justify-between">
					<span className="text-sm font-semibold">Comissões</span>
					<Button
						type="button"
						variant="outline"
						className="font-normal"
						onClick={() => appendCommission(createDefaultCommission())}
					>
						<CirclePlus />
						Adicionar
					</Button>
				</div>

				{commissionFields.map((commissionField, commissionIndex) => (
					<ScenarioCommissionCard
						key={commissionField.id}
						control={control}
						errors={errors}
						scenarioIndex={scenarioIndex}
						commissionIndex={commissionIndex}
						companyOptions={companyOptions}
						unitOptions={unitOptions}
						sellerOptions={sellerOptions}
						supervisorOptions={supervisorOptions}
						removeCommission={removeCommission}
						setValue={setValue}
						getValues={getValues}
						onInstallmentCountChange={onInstallmentCountChange}
					/>
				))}

				<FormFieldError error={errors.scenarios?.[scenarioIndex]?.commissions} />
			</div>
		</div>
	);
}

export function ProductForm({
	onSuccess,
	mode = "create",
	initialData,
	fixedParentId,
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

	const isEditMode = mode === "edit" && !!initialData;

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

	const { data: scenariosData, isLoading: isLoadingScenarios } =
		useGetOrganizationsSlugProductsIdCommissionScenarios(
			{ slug: organization?.slug ?? "", id: initialData?.id ?? "" },
			{
				query: {
					enabled: !!organization?.slug && !!initialData?.id && isEditMode,
				},
			},
		);

	const form = useForm<ProductFormData>({
		resolver: zodResolver(productSchema),
		defaultValues: {
			name: initialData?.name ?? "",
			scenarios: [],
		},
	});

	const {
		handleSubmit,
		control,
		reset,
		setValue,
		getValues,
		formState: { errors },
	} = form;

	const {
		fields: scenarioFields,
		append: appendScenario,
		remove: removeScenario,
	} = useFieldArray({
		control,
		name: "scenarios",
	});

	const scenarioValues = useWatch({ control, name: "scenarios" }) ?? [];

	const [activeScenarioTab, setActiveScenarioTab] = useState("");
	const isPending = isCreating || isUpdating || isSavingScenarios;
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

	useEffect(() => {
		if (!isEditMode || !initialData || !scenariosData) return;
		if (initializedFromApiRef.current) return;

		reset({
			name: initialData.name,
			scenarios:
				scenariosData.scenarios.length > 0
					? scenariosData.scenarios.map(mapApiScenarioToForm)
					: [],
		});
		initializedFromApiRef.current = true;
	}, [initialData, isEditMode, reset, scenariosData]);

	useEffect(() => {
		if (mode === "create") {
			initializedFromApiRef.current = false;
		}
	}, [mode]);

	async function invalidateProducts() {
		await queryClient.invalidateQueries({
			queryKey: getOrganizationsSlugProductsQueryKey({
				slug: organization!.slug,
			}),
		});
	}

	function handleAddScenario() {
		const nextIndex = scenarioFields.length;
		appendScenario(createDefaultScenario(`Cenário ${nextIndex + 1}`));
		setActiveScenarioTab(`scenario-${nextIndex}`);
	}

	function handleRemoveScenario(index: number) {
		const nextLength = scenarioFields.length - 1;
		removeScenario(index);
		if (nextLength <= 0) {
			setActiveScenarioTab("");
			return;
		}

		const nextTabIndex = index >= nextLength ? nextLength - 1 : index;
		setActiveScenarioTab(`scenario-${nextTabIndex}`);
	}

	function handleInstallmentCountChange(
		scenarioIndex: number,
		commissionIndex: number,
		nextCount: number,
	) {
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
	}

	async function saveProductCommissionScenarios(
		productId: string,
		scenarios: ProductFormData["scenarios"],
	) {
		await replaceCommissionScenarios({
			slug: organization!.slug,
			id: productId,
			data: {
				scenarios: mapScenariosToPayload(scenarios),
			},
		});
	}

	async function onSubmit(data: ProductFormData) {
		const name = data.name.trim();

		if (!isEditMode) {
			let createdProductId: string;
			try {
				const createdProduct = await createProduct({
					slug: organization!.slug,
					data: {
						name,
						description: null,
						parentId: fixedParentId ?? null,
					},
				});
				createdProductId = createdProduct.productId;
			} catch (error) {
				const message = resolveErrorMessage(normalizeApiError(error));
				toast.error(message);
				return;
			}

			try {
				if (data.scenarios.length > 0) {
					await saveProductCommissionScenarios(createdProductId, data.scenarios);
				}
				await invalidateProducts();
				toast.success("Produto cadastrado com sucesso");
				onSuccess?.();
			} catch (error) {
				await invalidateProducts();
				const message = resolveErrorMessage(normalizeApiError(error));
				toast.error(
					`Produto cadastrado, mas as comissões não foram salvas. ${message}. Edite o produto para concluir a configuração.`,
				);
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
			await invalidateProducts();
			toast.success("Produto atualizado com sucesso");
			onSuccess?.();
		} catch (error) {
			await invalidateProducts();
			const message = resolveErrorMessage(normalizeApiError(error));
			toast.error(
				`Produto atualizado, mas as comissões não foram salvas. ${message}. Ajuste os dados e tente novamente.`,
			);
		}
	}

	return (
		<form
			onSubmit={handleSubmit(onSubmit)}
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

			<div className="space-y-4">
				<div className="flex items-center justify-between">
					<span className="text-sm font-normal">Cenários de comissão</span>
					<Button type="button" variant="outline" className="font-normal" onClick={handleAddScenario}>
						<CirclePlus />
						Adicionar cenário
					</Button>
				</div>

				<div className="max-h-[60vh] overflow-y-auto pr-1">
					{isEditMode && isLoadingScenarios ? (
						<Card className="p-4">
							<span className="text-muted-foreground text-sm">
								Carregando cenários de comissão...
							</span>
						</Card>
					) : scenarioFields.length === 0 ? (
						<Card className="p-4">
							<span className="text-muted-foreground text-sm">
								Nenhum cenário configurado. Clique em "Adicionar cenário" para criar.
							</span>
						</Card>
					) : (
						<Tabs
							value={resolvedActiveScenarioTab}
							onValueChange={setActiveScenarioTab}
						>
							<TabsList className="w-full justify-start rounded-sm **:data-[slot=tab-indicator]:rounded-sm p-1 bg-gray-200">
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
			</div>

			<div className="flex justify-end gap-2">
				<Button type="submit" disabled={isPending}>
					{isPending ? "Salvando..." : "Salvar"}
				</Button>
			</div>
		</form>
	);
}
