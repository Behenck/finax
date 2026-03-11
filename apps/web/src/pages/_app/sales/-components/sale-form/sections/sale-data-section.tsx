import { Controller, type Control } from "react-hook-form";
import { Card } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { CalendarDateInput } from "@/components/ui/calendar-date-input";
import { FieldError } from "@/components/field-error";
import type { SaleFormData, SaleFormInput } from "@/schemas/sale-schema";
import { formatCurrencyBRL } from "@/utils/format-amount";
import { parseDateInputValue, toDateInputValue } from "../date-utils";

interface SaleDataSectionProps {
	control: Control<SaleFormInput, unknown, SaleFormData>;
}

export function SaleDataSection({ control }: SaleDataSectionProps) {
	return (
		<Card className="rounded-sm gap-4 p-5">
			<h2 className="font-semibold text-md">Dados da Venda</h2>

			<div className="grid gap-4 md:grid-cols-2">
				<FieldGroup>
					<Field className="gap-1">
						<FieldLabel>Data da venda *</FieldLabel>
						<Controller
							control={control}
							name="saleDate"
							render={({ field, fieldState }) => (
								<>
									<CalendarDateInput
										value={toDateInputValue(field.value as Date | undefined)}
										onChange={(value) => {
											field.onChange(parseDateInputValue(value));
										}}
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
						<FieldLabel>Valor total *</FieldLabel>
						<Controller
							control={control}
							name="totalAmount"
							render={({ field, fieldState }) => (
								<>
									<Input
										placeholder="R$ 0,00"
										value={field.value ?? ""}
										onChange={(event) =>
											field.onChange(formatCurrencyBRL(event.target.value))
										}
										aria-invalid={fieldState.invalid}
									/>
									<FieldError error={fieldState.error} />
								</>
							)}
						/>
					</Field>
				</FieldGroup>
			</div>
		</Card>
	);
}
