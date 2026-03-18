import { format, parse } from "date-fns";
import { Trash2 } from "lucide-react";
import { useEffect, useMemo } from "react";
import {
	type Control,
	Controller,
	useController,
	type UseFormGetValues,
	type UseFormSetValue,
	useWatch,
} from "react-hook-form";
import { FieldError as FormFieldError } from "@/components/field-error";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarDateInput } from "@/components/ui/calendar-date-input";
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
import type {
	SaleCommissionFormData,
	SaleFormData,
	SaleFormInput,
} from "@/schemas/sale-schema";
import {
	SALE_COMMISSION_DIRECTION_LABEL,
	SALE_COMMISSION_RECIPIENT_TYPE_LABEL,
	SALE_COMMISSION_SOURCE_TYPE_LABEL,
	type SaleCommissionDirection,
	type SaleCommissionRecipientType,
} from "@/schemas/types/sales";
import { formatCurrencyBRL } from "@/utils/format-amount";
import {
	calculateSaleCommissionInstallmentAmounts,
	deriveSaleCommissionDirectionFromRecipientType,
	roundSaleCommissionPercentage,
} from "./sale-commission-helpers";

const OPTIONAL_NONE_VALUE = "__NONE__";

function toDateInputValue(date?: Date) {
	return date ? format(date, "yyyy-MM-dd") : "";
}

function parseDateInputValue(value: string) {
	if (!value) {
		return undefined;
	}

	return parse(value, "yyyy-MM-dd", new Date());
}

const RECIPIENT_OPTIONS: Array<{
	value: SaleCommissionRecipientType;
	label: string;
}> = [
	{ value: "COMPANY", label: SALE_COMMISSION_RECIPIENT_TYPE_LABEL.COMPANY },
	{ value: "UNIT", label: SALE_COMMISSION_RECIPIENT_TYPE_LABEL.UNIT },
	{ value: "SELLER", label: SALE_COMMISSION_RECIPIENT_TYPE_LABEL.SELLER },
	{ value: "PARTNER", label: SALE_COMMISSION_RECIPIENT_TYPE_LABEL.PARTNER },
	{
		value: "SUPERVISOR",
		label: SALE_COMMISSION_RECIPIENT_TYPE_LABEL.SUPERVISOR,
	},
	{ value: "OTHER", label: SALE_COMMISSION_RECIPIENT_TYPE_LABEL.OTHER },
];

const DIRECTION_OPTIONS: Array<{
	value: SaleCommissionDirection;
	label: string;
}> = [
	{ value: "INCOME", label: SALE_COMMISSION_DIRECTION_LABEL.INCOME },
	{ value: "OUTCOME", label: SALE_COMMISSION_DIRECTION_LABEL.OUTCOME },
];

type SelectOption = {
	id: string;
	label: string;
};

interface SaleCommissionCardProps {
	index: number;
	control: Control<SaleFormInput, unknown, SaleFormData>;
	setValue: UseFormSetValue<SaleFormInput>;
	getValues: UseFormGetValues<SaleFormInput>;
	onRemove(index: number): void;
	onInstallmentCountChange(index: number, nextCount: number): void;
	companyOptions: SelectOption[];
	unitOptions: SelectOption[];
	sellerOptions: SelectOption[];
	partnerOptions: SelectOption[];
	supervisorOptions: SelectOption[];
	saleTotalAmountInCents: number;
	baseCommissionOptions: Array<{
		index: number;
		label: string;
	}>;
	effectiveTotalPercentage?: number;
	effectiveInstallmentPercentages?: number[];
}

export function SaleCommissionCard({
	index,
	control,
	setValue,
	getValues,
	onRemove,
	onInstallmentCountChange,
	companyOptions,
	unitOptions,
	sellerOptions,
	partnerOptions,
	supervisorOptions,
	saleTotalAmountInCents,
	baseCommissionOptions,
	effectiveTotalPercentage,
	effectiveInstallmentPercentages,
}: SaleCommissionCardProps) {
	const commissionPath = `commissions.${index}` as const;
	const recipientType = useWatch({
		control,
		name: `${commissionPath}.recipientType`,
	}) as SaleCommissionRecipientType;
	const sourceType = useWatch({
		control,
		name: `${commissionPath}.sourceType`,
	}) as "PULLED" | "MANUAL";
	const totalPercentage = useWatch({
		control,
		name: `${commissionPath}.totalPercentage`,
	}) as number;
	const calculationBase = useWatch({
		control,
		name: `${commissionPath}.calculationBase`,
	}) as SaleCommissionFormData["calculationBase"];
	const baseCommissionIndex = useWatch({
		control,
		name: `${commissionPath}.baseCommissionIndex`,
	}) as SaleCommissionFormData["baseCommissionIndex"];
	const { fieldState: baseCommissionIndexFieldState } = useController({
		control,
		name: `${commissionPath}.baseCommissionIndex` as const,
	});
	const watchedInstallments = useWatch({
		control,
		name: `${commissionPath}.installments`,
	}) as Array<{ installmentNumber: number; percentage: number }> | undefined;
	const installments = useMemo(
		() => watchedInstallments ?? [],
		[watchedInstallments],
	);
	const installmentsForEstimation = useMemo(
		() =>
			installments.map((installment, installmentIndex) => ({
				...installment,
				percentage:
					effectiveInstallmentPercentages?.[installmentIndex] ??
					installment.percentage,
			})),
		[effectiveInstallmentPercentages, installments],
	);
	const totalPercentageForEstimation =
		effectiveTotalPercentage ?? Number(totalPercentage ?? 0);
	const installmentEstimatedAmounts = useMemo(
		() =>
			calculateSaleCommissionInstallmentAmounts({
				totalAmountInCents: saleTotalAmountInCents,
				totalPercentage: totalPercentageForEstimation,
				installments: installmentsForEstimation,
			}),
		[
			installmentsForEstimation,
			saleTotalAmountInCents,
			totalPercentageForEstimation,
		],
	);
	const estimatedTotalAmount = installmentEstimatedAmounts.reduce(
		(sum, amount) => sum + amount,
		0,
	);
	const normalizedCalculationBase = calculationBase ?? "SALE_TOTAL";
	const linkedCommissionSelectValue =
		normalizedCalculationBase === "COMMISSION" &&
		typeof baseCommissionIndex === "number"
			? `COMMISSION:${baseCommissionIndex}`
			: "SALE_TOTAL";

	useEffect(() => {
		if (installments.length !== 1) {
			return;
		}

		const currentValue = getValues(
			`${commissionPath}.installments.0.percentage` as const,
		);
		if (
			roundSaleCommissionPercentage(Number(currentValue ?? 0)) ===
			roundSaleCommissionPercentage(Number(totalPercentage ?? 0))
		) {
			return;
		}

		setValue(
			`${commissionPath}.installments.0.percentage` as const,
			roundSaleCommissionPercentage(Number(totalPercentage ?? 0)),
			{
				shouldDirty: true,
				shouldValidate: true,
			},
		);
	}, [
		commissionPath,
		getValues,
		installments.length,
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
					: recipientType === "PARTNER"
						? partnerOptions
						: recipientType === "SUPERVISOR"
							? supervisorOptions
							: [];

	return (
		<Card className="space-y-4 p-4">
			<div className="flex items-center justify-between">
				<Badge variant={sourceType === "PULLED" ? "secondary" : "outline"}>
					{SALE_COMMISSION_SOURCE_TYPE_LABEL[sourceType]}
				</Badge>

				<Button
					type="button"
					variant="ghost"
					size="icon"
					onClick={() => onRemove(index)}
				>
					<Trash2 className="size-4 text-destructive" />
				</Button>
			</div>

			<div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[170px_170px_1fr_260px_120px_120px_120px] xl:items-end">
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
											const nextRecipientType =
												value as SaleCommissionRecipientType;
											field.onChange(nextRecipientType);
											setValue(`${commissionPath}.beneficiaryId`, undefined, {
												shouldDirty: true,
												shouldValidate: true,
											});
											setValue(
												`${commissionPath}.beneficiaryLabel`,
												undefined,
												{
													shouldDirty: true,
													shouldValidate: true,
												},
											);
											setValue(
												`${commissionPath}.direction`,
												deriveSaleCommissionDirectionFromRecipientType(
													nextRecipientType,
												),
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
											{RECIPIENT_OPTIONS.map((option) => (
												<SelectItem key={option.value} value={option.value}>
													{option.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									<FormFieldError
										error={
											fieldState.error ?? baseCommissionIndexFieldState.error
										}
									/>
								</>
							)}
						/>
					</Field>
				</FieldGroup>

				<FieldGroup>
					<Field className="gap-1">
						<FieldLabel className="font-normal">Direção</FieldLabel>
						<Controller
							name={`${commissionPath}.direction`}
							control={control}
							render={({ field, fieldState }) => (
								<>
									<Select
										value={field.value}
										onValueChange={(value) =>
											field.onChange(value as SaleCommissionDirection)
										}
									>
										<SelectTrigger>
											<SelectValue placeholder="Selecione" />
										</SelectTrigger>
										<SelectContent>
											{DIRECTION_OPTIONS.map((option) => (
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
						<Controller
							name={`${commissionPath}.calculationBase`}
							control={control}
							render={({ fieldState }) => (
								<>
									<Select
										value={linkedCommissionSelectValue}
										onValueChange={(value) => {
											if (value === "SALE_TOTAL") {
												setValue(
													`${commissionPath}.calculationBase`,
													"SALE_TOTAL",
													{
														shouldDirty: true,
														shouldValidate: true,
													},
												);
												setValue(
													`${commissionPath}.baseCommissionIndex`,
													undefined,
													{
														shouldDirty: true,
														shouldValidate: true,
													},
												);
												return;
											}

											const resolvedBaseCommissionIndex = Number(
												value.replace("COMMISSION:", ""),
											);
											if (!Number.isInteger(resolvedBaseCommissionIndex)) {
												return;
											}

											setValue(
												`${commissionPath}.calculationBase`,
												"COMMISSION",
												{
													shouldDirty: true,
													shouldValidate: true,
												},
											);
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
											value={field.value ?? OPTIONAL_NONE_VALUE}
											onValueChange={(value) =>
												field.onChange(
													value === OPTIONAL_NONE_VALUE ? undefined : value,
												)
											}
										>
											<SelectTrigger>
												<SelectValue placeholder="Selecione" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value={OPTIONAL_NONE_VALUE}>
													Selecione
												</SelectItem>
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
						<FieldLabel className="font-normal">Início *</FieldLabel>
						<Controller
							name={`${commissionPath}.startDate`}
							control={control}
							render={({ field, fieldState }) => (
								<>
									<CalendarDateInput
										value={toDateInputValue(field.value as Date | undefined)}
										onChange={(value) =>
											field.onChange(parseDateInputValue(value))
										}
									/>
									<FormFieldError error={fieldState.error} />
								</>
							)}
						/>
					</Field>
				</FieldGroup>

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
											const parsedValue = Number(event.target.value);
											field.onChange(Number.isFinite(parsedValue) ? parsedValue : 0);
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
							value={installments.length}
							onChange={(event) => {
								const parsedValue = Number(event.target.value);
								if (!Number.isFinite(parsedValue)) {
									return;
								}

								onInstallmentCountChange(
									index,
									Math.max(1, Math.trunc(parsedValue)),
								);
							}}
						/>
					</Field>
				</FieldGroup>
			</div>

			<div className="text-xs text-muted-foreground">
				Total estimado: {formatCurrencyBRL(estimatedTotalAmount / 100)}
			</div>

			{installments.length > 0 ? (
				<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
					{installments.map((installment, installmentIndex) => (
						<div
							key={`${commissionPath}-installment-${installment.installmentNumber}`}
							className="space-y-1"
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
														type="number"
														step="0.0001"
														min={0}
														max={100}
														className="pl-9"
														value={field.value ?? ""}
														onChange={(event) => {
															const parsedValue = Number(event.target.value);
															field.onChange(
																Number.isFinite(parsedValue) ? parsedValue : 0,
															);
														}}
													/>
												</div>
												<FormFieldError error={fieldState.error} />
												<p className="text-muted-foreground text-xs">
													Valor estimado:{" "}
													{formatCurrencyBRL(
														(installmentEstimatedAmounts[installmentIndex] ?? 0) / 100,
													)}
												</p>
											</>
										)}
									/>
								</Field>
							</FieldGroup>
						</div>
					))}
				</div>
			) : null}
		</Card>
	);
}
