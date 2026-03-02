import { useMemo } from "react";
import {
	Controller,
	type Control,
	type FieldErrors,
	type UseFormSetValue,
	useWatch,
} from "react-hook-form";
import { FieldError as FormFieldError } from "@/components/field-error";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type { ProductCommissionScenarioFormData, ProductFormData } from "@/schemas/product-schema";
import { Trash2 } from "lucide-react";
import {
	CONDITION_OPTIONS,
	LINKED_CONDITION_LABEL_BY_TYPE,
} from "../-utils/constants";
import type { ConditionType, SelectOption } from "../-utils/types";

interface ScenarioConditionRowProps {
	control: Control<ProductFormData>;
	errors: FieldErrors<ProductFormData>;
	scenarioIndex: number;
	conditionIndex: number;
	removeCondition(index: number): void;
	setValue: UseFormSetValue<ProductFormData>;
	conditionTypesInScenario: ConditionType[];
	companyOptions: SelectOption[];
	partnerOptions: SelectOption[];
	unitOptions: SelectOption[];
	sellerOptions: SelectOption[];
	supervisorOptions: SelectOption[];
}

export function ScenarioConditionRow({
	control,
	errors,
	scenarioIndex,
	conditionIndex,
	removeCondition,
	setValue,
	conditionTypesInScenario,
	companyOptions,
	partnerOptions,
	unitOptions,
	sellerOptions,
	supervisorOptions,
}: ScenarioConditionRowProps) {
	const conditionType = useWatch({
		control,
		name: `scenarios.${scenarioIndex}.conditions.${conditionIndex}.type`,
	}) as ProductCommissionScenarioFormData["conditions"][number]["type"];

	const conditionErrors =
		errors.scenarios?.[scenarioIndex]?.conditions?.[conditionIndex];

	const linkedConditionLabel =
		conditionType === "COMPANY"
			? LINKED_CONDITION_LABEL_BY_TYPE.COMPANY
			: conditionType === "PARTNER"
				? LINKED_CONDITION_LABEL_BY_TYPE.PARTNER
				: conditionType === "UNIT"
					? LINKED_CONDITION_LABEL_BY_TYPE.UNIT
					: conditionType === "SELLER"
						? LINKED_CONDITION_LABEL_BY_TYPE.SELLER
						: undefined;

	const valueOptions = useMemo(() => {
		const linkedConditionOption = linkedConditionLabel
			? {
					id: null,
					label: linkedConditionLabel,
				}
			: null;
		const baseOptions =
			conditionType === "COMPANY"
				? companyOptions
				: conditionType === "PARTNER"
					? partnerOptions
					: conditionType === "UNIT"
						? unitOptions
						: conditionType === "SELLER"
							? sellerOptions
							: supervisorOptions;

		if (!linkedConditionOption) return baseOptions;

		return [
			linkedConditionOption,
			...baseOptions,
		];
	}, [
		companyOptions,
		conditionType,
		linkedConditionLabel,
		partnerOptions,
		sellerOptions,
		supervisorOptions,
		unitOptions,
	]);

	const selectedValueIds = useWatch({
		control,
		name: `scenarios.${scenarioIndex}.conditions.${conditionIndex}.valueIds`,
	}) as Array<string | null> | undefined;

	const selectedOptions = useMemo(
		() => valueOptions.filter((option) => (selectedValueIds ?? []).includes(option.id)),
		[selectedValueIds, valueOptions],
	);

	const triggerLabel = useMemo(() => {
		if (selectedOptions.length === 0) return "Selecione";
		if (selectedOptions.length <= 2) {
			return selectedOptions.map((option) => option.label).join(", ");
		}

		return `${selectedOptions[0]?.label ?? ""}, ${selectedOptions[1]?.label ?? ""} +${selectedOptions.length - 2}`;
	}, [selectedOptions]);

	const conditionTypeOptions = useMemo(
		() =>
			CONDITION_OPTIONS.filter((option) => {
				return (
					option.value === conditionType ||
					!conditionTypesInScenario.includes(option.value)
				);
			}),
		[conditionType, conditionTypesInScenario],
	);

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
										const shouldUseLinkedDefault =
											value === "COMPANY" ||
											value === "PARTNER" ||
											value === "UNIT" ||
											value === "SELLER";

										setValue(
											`scenarios.${scenarioIndex}.conditions.${conditionIndex}.valueIds`,
											shouldUseLinkedDefault ? [null] : [],
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
										{conditionTypeOptions.map((option) => (
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
						name={`scenarios.${scenarioIndex}.conditions.${conditionIndex}.valueIds`}
						control={control}
						render={({ field, fieldState }) => (
							<>
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button
											type="button"
											variant="outline"
											className="w-full justify-start overflow-hidden font-normal"
										>
											<span className="truncate">{triggerLabel}</span>
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent
										align="start"
										className="w-[var(--radix-dropdown-menu-trigger-width)] max-h-64 overflow-y-auto"
									>
										{valueOptions.map((option) => (
											<DropdownMenuCheckboxItem
												key={option.id ?? "linked"}
												checked={(field.value ?? []).includes(option.id)}
												onSelect={(event) => event.preventDefault()}
												onCheckedChange={(checked) => {
													if (option.id === null) {
														field.onChange(checked ? [null] : []);
														return;
													}

													const nextValues = new Set(
														(field.value ?? []).filter(
															(value): value is string => value !== null,
														),
													);

													if (checked) nextValues.add(option.id);
													else nextValues.delete(option.id);

													field.onChange(Array.from(nextValues));
												}}
											>
												{option.label}
											</DropdownMenuCheckboxItem>
										))}
									</DropdownMenuContent>
								</DropdownMenu>
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
