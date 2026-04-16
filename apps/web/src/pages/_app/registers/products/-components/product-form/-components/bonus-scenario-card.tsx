import { CirclePlus, Trash2 } from "lucide-react";
import { useMemo } from "react";
import {
	Controller,
	type Control,
	type FieldErrors,
	type UseFormGetValues,
	type UseFormRegister,
	type UseFormSetValue,
	useFieldArray,
	useWatch,
} from "react-hook-form";
import { FieldError as FormFieldError } from "@/components/field-error";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { ProductFormData } from "@/schemas/product-schema";
import {
	BONUS_PARTICIPANT_OPTIONS,
	BONUS_PERIOD_FREQUENCY_OPTIONS,
} from "../-utils/constants";
import { distributeInstallments } from "../-utils/helpers";
import type { BonusParticipantType, SelectOption } from "../-utils/types";

interface BonusScenarioCardProps {
	control: Control<ProductFormData>;
	errors: FieldErrors<ProductFormData>;
	register: UseFormRegister<ProductFormData>;
	setValue: UseFormSetValue<ProductFormData>;
	getValues: UseFormGetValues<ProductFormData>;
	scenarioIndex: number;
	companyOptions: SelectOption[];
	partnerOptions: SelectOption[];
	sellerOptions: SelectOption[];
	supervisorOptions: SelectOption[];
	canRemove: boolean;
	onRemoveScenario: (index: number) => void;
}

function getParticipantOptionsByType(params: {
	type: BonusParticipantType;
	companyOptions: SelectOption[];
	partnerOptions: SelectOption[];
	sellerOptions: SelectOption[];
	supervisorOptions: SelectOption[];
}) {
	if (params.type === "COMPANY") {
		return params.companyOptions;
	}
	if (params.type === "PARTNER") {
		return params.partnerOptions;
	}
	if (params.type === "SELLER") {
		return params.sellerOptions;
	}
	return params.supervisorOptions;
}

export function BonusScenarioCard({
	control,
	errors,
	register,
	setValue,
	getValues,
	scenarioIndex,
	companyOptions,
	partnerOptions,
	sellerOptions,
	supervisorOptions,
	canRemove,
	onRemoveScenario,
}: BonusScenarioCardProps) {
	const scenarioErrors = errors.bonusScenarios?.[scenarioIndex];
	const payoutEnabled = useWatch({
		control,
		name: `bonusScenarios.${scenarioIndex}.payoutEnabled`,
	});
	const payoutInstallments =
		useWatch({
			control,
			name: `bonusScenarios.${scenarioIndex}.payoutInstallments`,
		}) ?? [];

	const {
		fields: participantFields,
		append: appendParticipant,
		remove: removeParticipant,
	} = useFieldArray({
		control,
		name: `bonusScenarios.${scenarioIndex}.participants`,
	});
	const {
		fields: payoutInstallmentFields,
		replace: replacePayoutInstallments,
	} = useFieldArray({
		control,
		name: `bonusScenarios.${scenarioIndex}.payoutInstallments`,
	});
	const participantValues =
		useWatch({
			control,
			name: `bonusScenarios.${scenarioIndex}.participants`,
		}) ?? [];

	const participantTypeWithOptions = useMemo(
		() =>
			BONUS_PARTICIPANT_OPTIONS.filter((option) => {
				const availableOptions = getParticipantOptionsByType({
					type: option.value,
					companyOptions,
					partnerOptions,
					sellerOptions,
					supervisorOptions,
				});
				return availableOptions.length > 0;
			}),
		[companyOptions, partnerOptions, sellerOptions, supervisorOptions],
	);

	const handleAddParticipant = () => {
		const defaultType =
			participantTypeWithOptions[0]?.value ??
			BONUS_PARTICIPANT_OPTIONS[0]?.value ??
			"COMPANY";
		const options = getParticipantOptionsByType({
			type: defaultType,
			companyOptions,
			partnerOptions,
			sellerOptions,
			supervisorOptions,
		});

		appendParticipant({
			type: defaultType,
			valueId: options[0]?.id ?? "",
		});
	};

	const handleParticipantTypeChange = (
		participantIndex: number,
		nextType: BonusParticipantType,
	) => {
		const options = getParticipantOptionsByType({
			type: nextType,
			companyOptions,
			partnerOptions,
			sellerOptions,
			supervisorOptions,
		});
		const currentValueId = getValues(
			`bonusScenarios.${scenarioIndex}.participants.${participantIndex}.valueId`,
		);
		const nextValueId = options.some((option) => option.id === currentValueId)
			? currentValueId
			: (options[0]?.id ?? "");

		setValue(
			`bonusScenarios.${scenarioIndex}.participants.${participantIndex}.type`,
			nextType,
			{
				shouldDirty: true,
				shouldValidate: true,
			},
		);
		setValue(
			`bonusScenarios.${scenarioIndex}.participants.${participantIndex}.valueId`,
			nextValueId,
			{
				shouldDirty: true,
				shouldValidate: true,
			},
		);
	};

	const handlePayoutEnabledChange = (checked: boolean) => {
		setValue(`bonusScenarios.${scenarioIndex}.payoutEnabled`, checked, {
			shouldDirty: true,
			shouldValidate: true,
		});

		if (!checked) {
			setValue(`bonusScenarios.${scenarioIndex}.payoutTotalPercentage`, undefined, {
				shouldDirty: true,
				shouldValidate: true,
			});
			setValue(`bonusScenarios.${scenarioIndex}.payoutDueDay`, undefined, {
				shouldDirty: true,
				shouldValidate: true,
			});
			replacePayoutInstallments([]);
			return;
		}

		const currentTotalPercentage = getValues(
			`bonusScenarios.${scenarioIndex}.payoutTotalPercentage`,
		);
		const resolvedTotalPercentage =
			currentTotalPercentage === undefined || Number.isNaN(currentTotalPercentage)
				? 1
				: currentTotalPercentage;
		setValue(
			`bonusScenarios.${scenarioIndex}.payoutTotalPercentage`,
			resolvedTotalPercentage,
			{
				shouldDirty: true,
				shouldValidate: true,
			},
		);

		const currentDueDay = getValues(`bonusScenarios.${scenarioIndex}.payoutDueDay`);
		setValue(
			`bonusScenarios.${scenarioIndex}.payoutDueDay`,
			currentDueDay ?? 1,
			{
				shouldDirty: true,
				shouldValidate: true,
			},
		);

		if (payoutInstallments.length === 0) {
			replacePayoutInstallments(distributeInstallments(resolvedTotalPercentage, 1));
		}
	};

	const handleInstallmentsCountChange = (nextCount: number) => {
		const totalPercentage =
			getValues(`bonusScenarios.${scenarioIndex}.payoutTotalPercentage`) ?? 1;
		replacePayoutInstallments(distributeInstallments(totalPercentage, nextCount));
	};

	return (
		<Card className="space-y-4 p-4">
			<div className="grid gap-3 md:grid-cols-[1.2fr_220px_220px_auto]">
				<Field className="gap-1">
					<FieldLabel>Nome da meta</FieldLabel>
					<Input
						placeholder="Ex.: Meta mensal parceiros"
						{...register(`bonusScenarios.${scenarioIndex}.name` as const)}
					/>
					<FormFieldError error={scenarioErrors?.name} />
				</Field>

				<Field className="gap-1">
					<FieldLabel>Meta (R$)</FieldLabel>
					<Input
						type="number"
						min={1}
						step={1}
						{...register(`bonusScenarios.${scenarioIndex}.targetAmount` as const, {
							valueAsNumber: true,
						})}
					/>
					<FormFieldError error={scenarioErrors?.targetAmount} />
				</Field>

				<Field className="gap-1">
					<FieldLabel>Frequência</FieldLabel>
					<Controller
						control={control}
						name={`bonusScenarios.${scenarioIndex}.periodFrequency`}
						render={({ field }) => (
							<Select
								value={field.value}
								onValueChange={(value) =>
									field.onChange(value as ProductFormData["bonusScenarios"][number]["periodFrequency"])
								}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{BONUS_PERIOD_FREQUENCY_OPTIONS.map((option) => (
										<SelectItem key={option.value} value={option.value}>
											{option.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						)}
					/>
					<FormFieldError error={scenarioErrors?.periodFrequency} />
				</Field>

				<div className="flex items-end justify-end">
					<Button
						type="button"
						variant="ghost"
						className="text-red-500 hover:text-red-600"
						onClick={() => onRemoveScenario(scenarioIndex)}
						disabled={!canRemove}
					>
						<Trash2 className="size-4" />
						Remover
					</Button>
				</div>
			</div>

			<div className="space-y-3">
				<div className="flex items-center justify-between">
					<div>
						<p className="text-sm font-medium">Participantes</p>
						<p className="text-xs text-muted-foreground">
							Quem bater a meta entra na apuração da bonificação.
						</p>
					</div>
					<Button type="button" variant="outline" onClick={handleAddParticipant}>
						<CirclePlus className="size-4" />
						Adicionar participante
					</Button>
				</div>

				{participantFields.length === 0 ? (
					<p className="text-sm text-muted-foreground">
						Nenhum participante selecionado.
					</p>
				) : (
					<div className="space-y-2">
						{participantFields.map((participantField, participantIndex) => {
							const participantType =
								(participantValues[participantIndex]?.type as BonusParticipantType) ??
								"COMPANY";
							const participantOptions = getParticipantOptionsByType({
								type: participantType,
								companyOptions,
								partnerOptions,
								sellerOptions,
								supervisorOptions,
							});

							return (
								<div
									key={participantField.id}
									className="grid gap-2 rounded-md border p-3 md:grid-cols-[220px_1fr_auto]"
								>
									<Field className="gap-1">
										<FieldLabel>Tipo</FieldLabel>
										<Controller
											control={control}
											name={`bonusScenarios.${scenarioIndex}.participants.${participantIndex}.type`}
											render={({ field }) => (
												<Select
													value={field.value}
													onValueChange={(value) =>
														handleParticipantTypeChange(
															participantIndex,
															value as BonusParticipantType,
														)
													}
												>
													<SelectTrigger>
														<SelectValue />
													</SelectTrigger>
													<SelectContent>
														{BONUS_PARTICIPANT_OPTIONS.map((option) => (
															<SelectItem key={option.value} value={option.value}>
																{option.label}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
											)}
										/>
										<FormFieldError
											error={
												scenarioErrors?.participants?.[participantIndex]?.type
											}
										/>
									</Field>

									<Field className="gap-1">
										<FieldLabel>Participante</FieldLabel>
										<Controller
											control={control}
											name={`bonusScenarios.${scenarioIndex}.participants.${participantIndex}.valueId`}
											render={({ field }) => (
												<Select value={field.value} onValueChange={field.onChange}>
													<SelectTrigger>
														<SelectValue placeholder="Selecione" />
													</SelectTrigger>
													<SelectContent>
														{participantOptions.map((option) => (
															<SelectItem key={option.id} value={option.id}>
																{option.label}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
											)}
										/>
										<FormFieldError
											error={
												scenarioErrors?.participants?.[participantIndex]?.valueId
											}
										/>
									</Field>

									<div className="flex items-end justify-end">
										<Button
											type="button"
											variant="outline"
											size="icon"
											onClick={() => removeParticipant(participantIndex)}
											aria-label="Remover participante"
										>
											<Trash2 className="size-4" />
										</Button>
									</div>
								</div>
							);
						})}
					</div>
				)}

				<FormFieldError error={scenarioErrors?.participants} />
			</div>

			<div className="space-y-3 rounded-md border p-3">
				<div className="flex items-center justify-between">
					<div>
						<p className="text-sm font-medium">Bonificação financeira</p>
						<p className="text-xs text-muted-foreground">
							Quando ativa, gera parcelas de comissão para quem bateu a meta.
						</p>
					</div>
					<Switch
						checked={Boolean(payoutEnabled)}
						onCheckedChange={(checked) =>
							handlePayoutEnabledChange(Boolean(checked))
						}
					/>
				</div>

				{payoutEnabled ? (
					<div className="space-y-3">
						<div className="grid gap-3 md:grid-cols-3">
							<Field className="gap-1">
								<FieldLabel>% total</FieldLabel>
								<Input
									type="number"
									min={0.0001}
									max={100}
									step={0.0001}
									{...register(
										`bonusScenarios.${scenarioIndex}.payoutTotalPercentage` as const,
										{
											setValueAs: (value) =>
												value === "" || value === null || value === undefined
													? undefined
													: Number(value),
										},
									)}
								/>
								<FormFieldError error={scenarioErrors?.payoutTotalPercentage} />
							</Field>

							<Field className="gap-1">
								<FieldLabel>Parcelas</FieldLabel>
								<Input
									type="number"
									min={1}
									step={1}
									value={Math.max(1, payoutInstallmentFields.length)}
									onChange={(event) =>
										handleInstallmentsCountChange(
											Math.max(1, Number(event.target.value || 1)),
										)
									}
								/>
							</Field>

							<Field className="gap-1">
								<FieldLabel>Dia fixo</FieldLabel>
								<Input
									type="number"
									min={1}
									max={31}
									step={1}
									{...register(`bonusScenarios.${scenarioIndex}.payoutDueDay` as const, {
										setValueAs: (value) =>
											value === "" || value === null || value === undefined
												? undefined
												: Number(value),
									})}
								/>
								<FormFieldError error={scenarioErrors?.payoutDueDay} />
							</Field>
						</div>

						<div className="space-y-2">
							<p className="text-sm font-medium">Parcelas da bonificação</p>
							{payoutInstallmentFields.map((installmentField, installmentIndex) => (
								<div
									key={installmentField.id}
									className="grid gap-2 md:grid-cols-[180px_1fr]"
								>
									<Field className="gap-1">
										<FieldLabel>Parcela</FieldLabel>
										<Input
											readOnly
											value={`Parcela ${installmentIndex + 1}`}
											className="bg-muted"
										/>
									</Field>
									<Field className="gap-1">
										<FieldLabel>Percentual (%)</FieldLabel>
										<Input
											type="number"
											min={0}
											max={100}
											step={0.0001}
											{...register(
												`bonusScenarios.${scenarioIndex}.payoutInstallments.${installmentIndex}.percentage` as const,
												{
													valueAsNumber: true,
												},
											)}
										/>
									</Field>
								</div>
							))}
							<FormFieldError error={scenarioErrors?.payoutInstallments} />
						</div>
					</div>
				) : (
					<p className="text-xs text-muted-foreground">
						Meta sem bonificação: o sistema registra apenas o atingimento.
					</p>
				)}
			</div>
		</Card>
	);
}
