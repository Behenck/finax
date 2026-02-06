import { Card } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useEmployees } from "@/hooks/employees/use-employees";
import type { TransactionFormData } from "@/schemas/transaction-schema";
import { useState } from "react";
import { Controller, type Control } from "react-hook-form";

interface RefundFieldProps {
  control: Control<TransactionFormData>
}

export function RefundField({ control }: RefundFieldProps) {
  const [isRefund, setIsRefund] = useState(false)
  const { data: employees } = useEmployees()

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
                  <Select value={field.value ?? ""} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>

                    <SelectContent>
                      {employees?.map((employee) => (
                        <SelectItem key={employee.id} value={employee.id}>
                          {employee.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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