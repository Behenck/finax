import { useMemo } from "react";
import {
	Controller,
	type Control,
	type FieldErrors,
	type UseFormGetValues,
	type UseFormSetValue,
	useFieldArray,
	useWatch,
} from "react-hook-form";
import { FieldError as FormFieldError } from "@/components/field-error";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { ProductCommissionScenarioFormData, ProductFormData } from "@/schemas/product-schema";
import { CirclePlus, Plus, Trash2 } from "lucide-react";
import { CONDITION_OPTIONS } from "../-utils/constants";
import { createDefaultCommission } from "../-utils/helpers";
import type { SelectOption } from "../-utils/types";
import { ScenarioCommissionCard } from "./scenario-commission-card";
import { ScenarioConditionRow } from "./scenario-condition-row";

interface ScenarioTabContentProps {
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
}

export function ScenarioTabContent({
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
}: ScenarioTabContentProps) {
	const { fields: conditionFields, append: appendCondition, remove: removeCondition } =
		useFieldArray({
			control,
			name: `scenarios.${scenarioIndex}.conditions`,
		});

	const conditionValues = useWatch({
		control,
		name: `scenarios.${scenarioIndex}.conditions`,
	}) as ProductCommissionScenarioFormData["conditions"] | undefined;

	const conditionTypesInScenario = useMemo(
		() => (conditionValues ?? []).map((condition) => condition.type),
		[conditionValues],
	);

	const availableConditionTypeOptions = useMemo(
		() =>
			CONDITION_OPTIONS.filter(
				(option) => !conditionTypesInScenario.includes(option.value),
			),
		[conditionTypesInScenario],
	);

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
								conditionTypesInScenario={conditionTypesInScenario}
								companyOptions={companyOptions}
								partnerOptions={partnerOptions}
								unitOptions={unitOptions}
								sellerOptions={sellerOptions}
								supervisorOptions={supervisorOptions}
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
					disabled={availableConditionTypeOptions.length === 0}
					onClick={() => {
						const defaultType = availableConditionTypeOptions[0]?.value ?? "COMPANY";
						const shouldUseLinkedDefault =
							defaultType === "COMPANY" ||
							defaultType === "PARTNER" ||
							defaultType === "UNIT" ||
							defaultType === "SELLER";

						appendCondition({
							type: defaultType,
							valueIds: shouldUseLinkedDefault ? [null] : [],
						});
					}}
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
