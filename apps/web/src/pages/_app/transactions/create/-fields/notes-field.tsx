import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useEmployees } from "@/hooks/employees/use-employees";
import type { TransactionFormData } from "@/schemas/transaction-schema";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Controller, useFieldArray, useWatch, type Control } from "react-hook-form";

interface NotesFieldProps {
  control: Control<TransactionFormData>
}

export function NotesField({ control }: NotesFieldProps) {
  return (
    <Card className="p-5 rounded-sm gap-3">
      <div className="flex items-center justify-between gap-3">
        <span className="font-semibold text-md">Observações</span>
      </div>
      <FieldGroup>
        <Controller
          name="notes"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid} className="gap-2">
              <Textarea
                {...field}
                id="notes"
                className="h-26"
                autoCapitalize="none"
                autoCorrect="off"
                aria-invalid={fieldState.invalid}
                aria-describedby={
                  fieldState.invalid ? "notes-error" : undefined
                }
                placeholder="Adicione observações sobre esta transação"
              />
              {fieldState.invalid && (
                <FieldError id="notes-error" errors={[fieldState.error]} />
              )}
            </Field>
          )}
        />
      </FieldGroup>
    </Card>
  )
}