import { useEffect } from "react";
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
import { Card } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type { ProductCommissionFormData, ProductFormData } from "@/schemas/product-schema";
import { CalendarDays, Percent, Trash2 } from "lucide-react";
import { RECIPIENT_OPTIONS } from "../-utils/constants";
import { roundPercentage } from "../-utils/helpers";
import type { SelectOption } from "../-utils/types";

interface ScenarioCommissionCardProps {
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
	baseCommissionOptions: Array<{
		index: number;
		label: string;
	}>;
}

export function ScenarioCommissionCard({
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
	baseCommissionOptions,
}: ScenarioCommissionCardProps) {
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
	const calculationBase = useWatch({
		control,
		name: `${commissionPath}.calculationBase`,
	}) as ProductCommissionFormData["calculationBase"];
	const baseCommissionIndex = useWatch({
		control,
		name: `${commissionPath}.baseCommissionIndex`,
	}) as ProductCommissionFormData["baseCommissionIndex"];
	const useAdvancedDateSchedule = useWatch({
		control,
		name: `${commissionPath}.useAdvancedDateSchedule`,
	}) as ProductCommissionFormData["useAdvancedDateSchedule"];

	const commissionErrors =
		errors.scenarios?.[scenarioIndex]?.commissions?.[commissionIndex];
	const normalizedCalculationBase = calculationBase ?? "SALE_TOTAL";
	const linkedCommissionSelectValue =
		normalizedCalculationBase === "COMMISSION" &&
		typeof baseCommissionIndex === "number"
			? `COMMISSION:${baseCommissionIndex}`
			: "SALE_TOTAL";

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
					: recipientType === "SUPERVISOR"
						? supervisorOptions
						: [];
	const autoLinkedBeneficiaryValue = "__AUTO_LINKED_BENEFICIARY__";
	const isAutoLinkedRecipient =
		recipientType === "COMPANY" ||
		recipientType === "SELLER" ||
		recipientType === "SUPERVISOR" ||
		recipientType === "PARTNER";
	const autoLinkedBeneficiaryLabel =
		recipientType === "COMPANY"
			? "Empresa vinculada"
			: recipientType === "SELLER"
			? "Vendedor vinculado"
			: recipientType === "SUPERVISOR"
				? "Supervisor vinculado"
				: recipientType === "PARTNER"
					? "Parceiro vinculado"
				: "";

	return (
		<Card className="space-y-4 p-4">
			<div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[170px_180px_minmax(300px,1fr)_120px_120px_120px_auto] xl:items-end">
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

				<FieldGroup>
					<Field className="gap-1">
						<FieldLabel className="font-normal">Base de cálculo</FieldLabel>
						<Select
							value={linkedCommissionSelectValue}
							onValueChange={(value) => {
								if (value === "SALE_TOTAL") {
									setValue(`${commissionPath}.calculationBase`, "SALE_TOTAL", {
										shouldDirty: true,
										shouldValidate: true,
									});
									setValue(`${commissionPath}.baseCommissionIndex`, undefined, {
										shouldDirty: true,
										shouldValidate: true,
									});
									return;
								}

								const resolvedBaseCommissionIndex = Number(
									value.replace("COMMISSION:", ""),
								);
								if (!Number.isInteger(resolvedBaseCommissionIndex)) {
									return;
								}

								setValue(`${commissionPath}.calculationBase`, "COMMISSION", {
									shouldDirty: true,
									shouldValidate: true,
								});
								setValue(
									`${commissionPath}.baseCommissionIndex`,
									resolvedBaseCommissionIndex,
									{
										shouldDirty: true,
										shouldValidate: true,
									},
								);
							}}
						>
							<SelectTrigger>
								<SelectValue placeholder="Selecione" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="SALE_TOTAL">Valor da venda</SelectItem>
								{baseCommissionOptions.map((option) => (
									<SelectItem
										key={`${commissionPath}-base-${option.index}`}
										value={`COMMISSION:${option.index}`}
									>
										{option.label}
									</SelectItem>
								))}
								{normalizedCalculationBase === "COMMISSION" &&
								typeof baseCommissionIndex === "number" &&
								!baseCommissionOptions.some(
									(option) => option.index === baseCommissionIndex,
								) ? (
									<SelectItem value={`COMMISSION:${baseCommissionIndex}`}>
										Comissão {baseCommissionIndex + 1}
									</SelectItem>
								) : null}
							</SelectContent>
						</Select>
						<FormFieldError
							error={
								commissionErrors?.calculationBase ??
								commissionErrors?.baseCommissionIndex
							}
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
											value={
												field.value ??
												(isAutoLinkedRecipient ? autoLinkedBeneficiaryValue : "")
											}
											onValueChange={(value) => {
												field.onChange(
													value === "" ||
														value === autoLinkedBeneficiaryValue
														? undefined
														: value,
												);
											}}
										>
											<SelectTrigger>
												<SelectValue
													placeholder={
														isAutoLinkedRecipient
															? autoLinkedBeneficiaryLabel
															: "Selecione"
													}
												/>
											</SelectTrigger>
											<SelectContent>
												{isAutoLinkedRecipient && (
													<SelectItem value={autoLinkedBeneficiaryValue}>
														{autoLinkedBeneficiaryLabel}
													</SelectItem>
												)}
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
						<FieldLabel className="font-normal">Dia de pagamento</FieldLabel>
						<Controller
							name={`${commissionPath}.dueDay`}
							control={control}
							render={({ field, fieldState }) => (
								<>
									<Input
										type="number"
										min={1}
										max={31}
										step={1}
										value={field.value ?? ""}
										placeholder="Opcional"
										onChange={(event) => {
											const value = event.target.value;
											if (!value) {
												field.onChange(undefined);
												return;
											}

											const parsedValue = Number(value);
											field.onChange(
												Number.isFinite(parsedValue)
													? Math.trunc(parsedValue)
													: undefined,
											);
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

			<div className="flex flex-col gap-2 rounded-lg border border-dashed border-border/70 bg-muted/20 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
				<div className="space-y-1">
					<p className="font-medium text-sm">Data avançada</p>
					<p className="text-muted-foreground text-xs">
						Quando ativada, cada parcela pode avançar meses a partir da última
						parcela com data. Use <span className="font-medium">0</span> para
						criar a parcela sem previsão.
					</p>
				</div>
				<Controller
					name={`${commissionPath}.useAdvancedDateSchedule`}
					control={control}
					render={({ field }) => (
						<Switch
							checked={field.value}
							onCheckedChange={(checked) => {
								field.onChange(checked);
								const currentInstallments =
									getValues(`${commissionPath}.installments`) ?? [];
								const nextInstallments = currentInstallments.map(
									(installment, installmentIndex) => ({
										...installment,
										monthsToAdvance: checked
											? installmentIndex === 0
												? 0
												: installment.monthsToAdvance
											: installmentIndex === 0
												? 0
												: 1,
									}),
								);
								setValue(`${commissionPath}.installments`, nextInstallments, {
									shouldDirty: true,
									shouldValidate: true,
								});
							}}
						/>
					)}
				/>
			</div>

			{installmentFields.length > 1 && (
				<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
					{installmentFields.map((installmentField, installmentIndex) => (
						<div key={installmentField.id} className="space-y-1">
							<div
								className={`grid gap-2 ${
									useAdvancedDateSchedule && installmentIndex > 0
										? "grid-cols-[minmax(0,1fr)_88px] items-start"
										: "grid-cols-1"
								}`}
							>
								<FieldGroup>
									<Field className="gap-1">
										<Controller
											name={`${commissionPath}.installments.${installmentIndex}.percentage`}
											control={control}
											render={({ field, fieldState }) => (
												<>
													<div className="relative">
														<span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-medium">
															P{installmentIndex + 1}
														</span>
														<Input
															value={field.value ?? ""}
															type="number"
															step="0.0001"
															min={0}
															max={100}
															aria-label={`Parcela ${installmentIndex + 1} (%)`}
															className={`text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${
																useAdvancedDateSchedule
																	? "pl-9 pr-8"
																	: "pl-10 pr-10"
															}`}
															onChange={(event) => {
																const value = Number(event.target.value);
																field.onChange(Number.isFinite(value) ? value : 0);
															}}
														/>
														<Percent className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
													</div>
													<FormFieldError error={fieldState.error} />
												</>
											)}
										/>
									</Field>
								</FieldGroup>

								{useAdvancedDateSchedule && installmentIndex > 0 ? (
									<FieldGroup>
										<Field className="gap-1">
											<Controller
												name={`${commissionPath}.installments.${installmentIndex}.monthsToAdvance`}
												control={control}
												render={({ field, fieldState }) => (
													<>
														<div className="relative">
															<CalendarDays className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
															<Input
																value={field.value ?? ""}
																type="number"
																step={1}
																min={0}
																aria-label={`Parcela ${installmentIndex + 1} (meses)`}
																placeholder="1"
																className="pl-8 pr-2 text-center text-sm [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
																onChange={(event) => {
																	const value = event.target.value;
																	if (!value) {
																		field.onChange(1);
																		return;
																	}

																	const parsedValue = Number(value);
																	field.onChange(
																		Number.isFinite(parsedValue)
																			? Math.max(0, Math.trunc(parsedValue))
																			: 1,
																	);
																}}
															/>
														</div>
														<FormFieldError error={fieldState.error} />
													</>
												)}
											/>
										</Field>
									</FieldGroup>
								) : null}
							</div>
						</div>
					))}
				</div>
			)}

			{commissionErrors?.installments && (
				<span className="text-destructive text-xs">
					{(commissionErrors.installments as { message?: string }).message}
				</span>
			)}
		</Card>
	);
}
