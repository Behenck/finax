import { Trash2 } from "lucide-react";
import { format, parse } from "date-fns";
import { useEffect, useMemo } from "react";
import {
	type Control,
	Controller,
	type UseFormGetValues,
	type UseFormSetValue,
	useWatch,
} from "react-hook-form";
import { FieldError as FormFieldError } from "@/components/field-error";
import { Badge } from "@/components/ui/badge";
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
import type { SaleFormData, SaleFormInput } from "@/schemas/sale-schema";
import {
	SALE_COMMISSION_RECIPIENT_TYPE_LABEL,
	SALE_COMMISSION_SOURCE_TYPE_LABEL,
	type SaleCommissionRecipientType,
} from "@/schemas/types/sales";
import { formatCurrencyBRL } from "@/utils/format-amount";
import {
	calculateSaleCommissionInstallmentAmounts,
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
	const watchedInstallments = useWatch({
		control,
		name: `${commissionPath}.installments`,
	}) as Array<{ installmentNumber: number; percentage: number }> | undefined;
	const installments = useMemo(
		() => watchedInstallments ?? [],
		[watchedInstallments],
	);
	const installmentEstimatedAmounts = useMemo(
		() =>
			calculateSaleCommissionInstallmentAmounts({
				totalAmountInCents: saleTotalAmountInCents,
				totalPercentage: Number(totalPercentage ?? 0),
				installments,
			}),
		[installments, saleTotalAmountInCents, totalPercentage],
	);
	const estimatedTotalAmount = installmentEstimatedAmounts.reduce(
		(sum, amount) => sum + amount,
		0,
	);

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

				<div className="grid gap-2 md:grid-cols-[180px_1fr_150px_120px_120px] md:items-end">
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
											field.onChange(value as SaleCommissionRecipientType);
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
										<Input
											type="date"
											value={toDateInputValue(field.value as Date | undefined)}
											onChange={(event) =>
												field.onChange(parseDateInputValue(event.target.value))
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
											field.onChange(
												Number.isFinite(parsedValue) ? parsedValue : 0,
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
														(installmentEstimatedAmounts[installmentIndex] ??
															0) / 100,
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
