import { Card } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { formatTitleCase } from "@/utils/format-title-case";
import { Controller, type Control } from "react-hook-form";
import { DateInput } from "../-components/date-input";
import type { TransactionFormData } from "@/schemas/transaction-schema";
import { Button } from "@/components/ui/button";
import { isSameDay, startOfDay, subDays } from "date-fns";

interface BasicInformationFieldProps {
  control: Control<TransactionFormData>
}

export function BasicInformationField({ control }: BasicInformationFieldProps) {
  const today = startOfDay(new Date())
  const yesterday = subDays(today, 1)
  return (
    <Card className="p-5 rounded-sm gap-5">
      <span className="font-semibold text-md">Informações Básicas</span>
      <FieldGroup>
        <Controller
          name="description"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid} className="gap-2">
              <FieldLabel htmlFor="description" className="font-normal">Descrição *</FieldLabel>
              <div>
                <Input
                  {...field}
                  id="description"
                  type="text"
                  autoCapitalize="none"
                  autoCorrect="off"
                  aria-invalid={fieldState.invalid}
                  aria-describedby={
                    fieldState.invalid ? "description-error" : undefined
                  }
                  placeholder="Ex: Aluguel do escritório"
                  onChange={(event) => {
                    const formattedValue = formatTitleCase(event.target.value);
                    field.onChange(formattedValue);
                  }}
                />
              </div>
              {fieldState.invalid && (
                <FieldError id="description-error" errors={[fieldState.error]} />
              )}
            </Field>
          )}
        />
      </FieldGroup>
      <div className="flex items-center gap-3">
        <FieldGroup>
          <Controller
            name="dueDate"
            control={control}
            render={({ field, fieldState }) => {
              const isTodaySelected = isSameDay(field.value, today)
              const isYesterdaySelected = isSameDay(field.value, yesterday)
              return (
                <Field data-invalid={fieldState.invalid} className="gap-2">
                  <FieldLabel htmlFor="dueDate" className="font-normal">
                    Data de Vencimento *
                  </FieldLabel>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant={isYesterdaySelected ? "default" : "outline"}
                      onClick={() => field.onChange(yesterday)}
                    >
                      Ontem
                    </Button>

                    <Button
                      type="button"
                      variant={isTodaySelected ? "default" : "outline"}
                      onClick={() => field.onChange(today)}
                    >
                      Hoje
                    </Button>

                    <DateInput
                      value={field.value}
                      onChange={field.onChange}
                      invalid={fieldState.invalid}
                    />
                  </div>
                  {fieldState.invalid && (
                    <FieldError id="dueDate-error" errors={[fieldState.error]} />
                  )}
                </Field>
              )
            }}
          />
        </FieldGroup>
        <FieldGroup>
          <Controller
            name="expectedPaymentDate"
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid} className="gap-2">
                <FieldLabel htmlFor="expectedPaymentDate" className="font-normal">
                  Previsão de Pagamento *
                </FieldLabel>

                <DateInput
                  value={field.value}
                  onChange={field.onChange}
                  invalid={fieldState.invalid}
                />

                {fieldState.invalid && (
                  <FieldError id="expectedPaymentDate-error" errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
        </FieldGroup>
      </div>
    </Card>
  )
}