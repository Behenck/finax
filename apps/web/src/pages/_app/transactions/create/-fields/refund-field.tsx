import { Card } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Switch } from "@/components/ui/switch";
import { useApp } from "@/context/app-context";
import { useGetOrganizationsSlugEmployees } from "@/http/generated";
import type { TransactionFormData } from "@/schemas/transaction-schema";
import { useState } from "react";
import { Controller, type Control } from "react-hook-form";

interface RefundFieldProps {
  control: Control<TransactionFormData>
}

export function RefundField({ control }: RefundFieldProps) {
  const { organization } = useApp()
  const [isRefund, setIsRefund] = useState(false)
  const { data } = useGetOrganizationsSlugEmployees({
    slug: organization?.slug ?? "",
  })

  const employees = data?.employees ?? []

  return (
    <Card className="p-5 rounded-sm gap-3">
      <div className="flex items-center justify-between gap-3">
        <span className="font-semibold text-md">Reembolso</span>
        <div className="flex items-center space-x-2">
          <Switch id="airplane-mode" className="cursor-pointer" checked={isRefund} onCheckedChange={setIsRefund} />
          <Label htmlFor="airplane-mode" className="text-xs">Esta despesa tem reembolso</Label>
        </div>
      </div>
      {isRefund && (
        <div className="space-y-4">
          <FieldGroup>
            <Controller
              name="employeeIdRefunded"
              control={control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid} className="gap-2">
                  <FieldLabel className="font-normal">Funcionário para reembolso</FieldLabel>
                  <SearchableSelect
                    options={employees.map((employee) => ({
                      value: employee.id,
                      label: employee.name,
                    }))}
                    value={field.value ?? undefined}
                    onValueChange={field.onChange}
                    placeholder="Selecione"
                    searchPlaceholder="Buscar funcionário..."
                    emptyMessage="Nenhum funcionário encontrado."
                  />
                  {fieldState.invalid && (
                    <FieldError id="userIdReimbursement-error" errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
          </FieldGroup>
        </div>
      )}
    </Card>
  )
}
