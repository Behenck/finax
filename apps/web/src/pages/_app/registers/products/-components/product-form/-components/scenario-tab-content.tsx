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
import type {
	ProductCommissionFormData,
	ProductCommissionScenarioFormData,
	ProductFormData,
} from "@/schemas/product-schema";
import { ArrowRight, CirclePlus, Plus, Trash2 } from "lucide-react";
import { CONDITION_OPTIONS, RECIPIENT_OPTIONS } from "../-utils/constants";
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
		replace: replaceCommissions,
	} = useFieldArray({
		control,
		name: `scenarios.${scenarioIndex}.commissions`,
	});

	const commissionValues = useWatch({
		control,
		name: `scenarios.${scenarioIndex}.commissions`,
	}) as ProductCommissionFormData[] | undefined;

	const baseCommissionOptionsByIndex = useMemo(() => {
		const commissions = commissionValues ?? [];

		return commissions.map((_commission, commissionIndex) =>
			commissions.flatMap((candidateCommission, candidateIndex) => {
				if (candidateIndex === commissionIndex) {
					return [];
				}

				const candidateCalculationBase =
					candidateCommission.calculationBase ?? "SALE_TOTAL";
				if (candidateCalculationBase !== "SALE_TOTAL") {
					return [];
				}

				const recipientLabel =
					RECIPIENT_OPTIONS.find(
						(option) => option.value === candidateCommission.recipientType,
					)?.label ?? "Beneficiário";

				return [
					{
						index: candidateIndex,
						label: `Comissão ${candidateIndex + 1} • ${recipientLabel}`,
					},
				];
			}),
		);
	}, [commissionValues]);

	const commissionGroups = useMemo(() => {
		const commissions = commissionValues ?? [];
		const childrenByParent = new Map<number, number[]>();
		const childIndexes = new Set<number>();

		for (const [commissionIndex, commission] of commissions.entries()) {
			const calculationBase = commission.calculationBase ?? "SALE_TOTAL";
			const baseCommissionIndex = commission.baseCommissionIndex;
			if (
				calculationBase !== "COMMISSION" ||
				baseCommissionIndex === undefined ||
				baseCommissionIndex < 0 ||
				baseCommissionIndex >= commissions.length ||
				baseCommissionIndex === commissionIndex
			) {
				continue;
			}

			const currentChildren = childrenByParent.get(baseCommissionIndex) ?? [];
			currentChildren.push(commissionIndex);
			childrenByParent.set(baseCommissionIndex, currentChildren);
			childIndexes.add(commissionIndex);
		}

		const groups: Array<{
			parentIndex: number;
			childIndexes: number[];
		}> = [];
		const renderedIndexes = new Set<number>();

		for (const [commissionIndex] of commissions.entries()) {
			if (childIndexes.has(commissionIndex)) {
				continue;
			}

			const children = [...(childrenByParent.get(commissionIndex) ?? [])].sort(
				(a, b) => a - b,
			);
			groups.push({
				parentIndex: commissionIndex,
				childIndexes: children,
			});

			renderedIndexes.add(commissionIndex);
			for (const childIndex of children) {
				renderedIndexes.add(childIndex);
			}
		}

		for (const [commissionIndex] of commissions.entries()) {
			if (renderedIndexes.has(commissionIndex)) {
				continue;
			}

			groups.push({
				parentIndex: commissionIndex,
				childIndexes: [],
			});
		}

		return groups;
	}, [commissionValues]);

	const removeCommissionWithDependents = (commissionIndex: number) => {
		const currentCommissions =
			(getValues(`scenarios.${scenarioIndex}.commissions`) as
				| ProductCommissionFormData[]
				| undefined) ?? [];
		if (
			commissionIndex < 0 ||
			commissionIndex >= currentCommissions.length ||
			currentCommissions.length === 0
		) {
			return;
		}

		const indexesToRemove = new Set<number>([commissionIndex]);
		let hasNewDependent = true;

		while (hasNewDependent) {
			hasNewDependent = false;
			for (const [currentIndex, commission] of currentCommissions.entries()) {
				if (indexesToRemove.has(currentIndex)) {
					continue;
				}

				const calculationBase = commission.calculationBase ?? "SALE_TOTAL";
				const baseCommissionIndex = commission.baseCommissionIndex;
				if (
					calculationBase === "COMMISSION" &&
					baseCommissionIndex !== undefined &&
					indexesToRemove.has(baseCommissionIndex)
				) {
					indexesToRemove.add(currentIndex);
					hasNewDependent = true;
				}
			}
		}

		const oldIndexToNewIndex = new Map<number, number>();
		const remainingCommissions: ProductCommissionFormData[] = [];
		for (const [currentIndex, commission] of currentCommissions.entries()) {
			if (indexesToRemove.has(currentIndex)) {
				continue;
			}

			oldIndexToNewIndex.set(currentIndex, remainingCommissions.length);
			remainingCommissions.push(commission);
		}

		const normalizedCommissions = remainingCommissions.map(
			(commission, nextCommissionIndex) => {
				const calculationBase = commission.calculationBase ?? "SALE_TOTAL";
				if (calculationBase !== "COMMISSION") {
					return {
						...commission,
						calculationBase: "SALE_TOTAL" as const,
						baseCommissionIndex: undefined,
					};
				}

				const oldBaseCommissionIndex = commission.baseCommissionIndex;
				if (oldBaseCommissionIndex === undefined) {
					return {
						...commission,
						calculationBase: "SALE_TOTAL" as const,
						baseCommissionIndex: undefined,
					};
				}

				const nextBaseCommissionIndex = oldIndexToNewIndex.get(
					oldBaseCommissionIndex,
				);
				if (
					nextBaseCommissionIndex === undefined ||
					nextBaseCommissionIndex === nextCommissionIndex
				) {
					return {
						...commission,
						calculationBase: "SALE_TOTAL" as const,
						baseCommissionIndex: undefined,
					};
				}

				const baseCommission = remainingCommissions[nextBaseCommissionIndex];
				const baseCalculationBase = baseCommission?.calculationBase ?? "SALE_TOTAL";
				if (baseCalculationBase !== "SALE_TOTAL") {
					return {
						...commission,
						calculationBase: "SALE_TOTAL" as const,
						baseCommissionIndex: undefined,
					};
				}

				return {
					...commission,
					calculationBase: "COMMISSION" as const,
					baseCommissionIndex: nextBaseCommissionIndex,
				};
			},
		);

		replaceCommissions(normalizedCommissions);
	};

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

				{commissionGroups.map((group) => {
					const parentCommissionField = commissionFields[group.parentIndex];
					if (!parentCommissionField) {
						return null;
					}

					return (
						<div key={parentCommissionField.id} className="space-y-3">
							<ScenarioCommissionCard
								control={control}
								errors={errors}
								scenarioIndex={scenarioIndex}
								commissionIndex={group.parentIndex}
								companyOptions={companyOptions}
								unitOptions={unitOptions}
								sellerOptions={sellerOptions}
								supervisorOptions={supervisorOptions}
								removeCommission={removeCommissionWithDependents}
								setValue={setValue}
								getValues={getValues}
								onInstallmentCountChange={onInstallmentCountChange}
								baseCommissionOptions={
									baseCommissionOptionsByIndex[group.parentIndex] ?? []
								}
							/>

							{group.childIndexes.map((childIndex) => {
								const childCommissionField = commissionFields[childIndex];
								if (!childCommissionField) {
									return null;
								}

								return (
									<div
										key={childCommissionField.id}
										className="ml-4 space-y-2 border-l border-dashed border-muted-foreground/40 pl-4"
									>
										<div className="flex items-center gap-2 text-muted-foreground text-xs">
											<ArrowRight className="size-3.5" />
											Vinculada à comissão {group.parentIndex + 1}
										</div>

										<ScenarioCommissionCard
											control={control}
											errors={errors}
											scenarioIndex={scenarioIndex}
											commissionIndex={childIndex}
											companyOptions={companyOptions}
											unitOptions={unitOptions}
											sellerOptions={sellerOptions}
											supervisorOptions={supervisorOptions}
											removeCommission={removeCommissionWithDependents}
											setValue={setValue}
											getValues={getValues}
											onInstallmentCountChange={onInstallmentCountChange}
											baseCommissionOptions={
												baseCommissionOptionsByIndex[childIndex] ?? []
											}
										/>
									</div>
								);
							})}
						</div>
					);
				})}

				<FormFieldError error={errors.scenarios?.[scenarioIndex]?.commissions} />
			</div>
		</div>
	);
}
