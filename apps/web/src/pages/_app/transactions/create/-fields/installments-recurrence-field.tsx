import { Card } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { TransactionFormData } from "@/schemas/transaction-schema";
import { Controller, useWatch, type Control } from "react-hook-form";

interface InstallmentsRecurrenceFieldProps {
  control: Control<TransactionFormData>
}

const InstallmentRecurrenceTypes = [
  { type: "SINGLE", name: "Única vez" },
  { type: "MONTH", name: "Mensal" },
  { type: "YEAR", name: "Anual" },
  { type: "INSTALLMENTS", name: "Parcelado" },
]

export function InstallmentsRecurrenceField({ control }: InstallmentsRecurrenceFieldProps) {
  const selectedType = useWatch({
    control,
    name: 'installmentRecurrenceType',
  })
  return (
    <Card className="p-5 rounded-sm gap-3">
      <span className="font-semibold text-md">Recorrência / Parcelas</span>
      <div className="flex items-center gap-3">
        <FieldGroup className="w-1/2">
          <Controller
            name="installmentRecurrenceType"
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid} className="gap-2">
                <FieldLabel className="font-normal">Tipo</FieldLabel>
                <Select value={field.value ?? ""} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>

                  <SelectContent>
                    {InstallmentRecurrenceTypes?.map((type) => (
                      <SelectItem key={type.type} value={type.type}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {fieldState.invalid && (
                  <FieldError id="subCategoryId-error" errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
        </FieldGroup>
        {selectedType !== "SINGLE" && (
          <FieldGroup className="w-1/2">
            <Controller
              name="installmentRecurrenceQuantity"
              control={control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid} className="gap-2">
                  <FieldLabel className="font-normal">Quantidade</FieldLabel>
                  <Input {...field} type="number" placeholder="1" />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
          </FieldGroup>
        )}
      </div>
    </Card>
  )
}