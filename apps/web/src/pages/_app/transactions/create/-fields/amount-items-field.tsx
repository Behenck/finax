import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useApp } from "@/context/app-context";
import { useGetOrganizationsSlugCategories } from "@/http/generated";
import type { TransactionFormData } from "@/schemas/transaction-schema";
import { formatCurrencyBRL, parseBRLCurrencyToNumber } from "@/utils/format-amount";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Controller, useFieldArray, useFormContext, useWatch } from "react-hook-form";

interface AmountItemsFieldProps {
  isItems: boolean
}

export function AmountItemsField({ isItems = false }: AmountItemsFieldProps) {
  const { organization } = useApp()
  const [multipleItems, setMultipleItems] = useState(isItems)
  const { data } = useGetOrganizationsSlugCategories({
    slug: organization?.slug ?? "",
  })
  const categories = data?.categories ?? []
  const { setValue, control } = useFormContext<TransactionFormData>()

  const selectedCategoryId = useWatch({
    control,
    name: 'categoryId',
  })
  const selectedCategory = categories.find(
    (category) => category.id === selectedCategoryId,
  )
  const subCategories = selectedCategory?.children ?? []

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  })

  function handleAddItem() {
    append({
      description: '',
      amount: '',
      categoryId: '',
      subCategoryId: '',
    })
  }

  const items = useWatch({
    control,
    name: "items",
  })

  const totalFromItems =
    items?.reduce((total, item) => {
      return total + parseBRLCurrencyToNumber(
        String(item?.amount ?? "")
      )
    }, 0) ?? 0


  useEffect(() => {
    if (!multipleItems) return

    setValue(
      "totalAmount",
      formatCurrencyBRL(totalFromItems),
      {
        shouldDirty: true,
        shouldValidate: true,
      }
    )
  }, [multipleItems, totalFromItems, setValue])
  return (
    <Card className="p-5 rounded-sm gap-3">
      <div className="flex items-center justify-between gap-3">
        <span className="font-semibold text-md">Valores</span>
        <div className="flex items-center space-x-2">
          <Switch id="airplane-mode" className="cursor-pointer" checked={multipleItems} onCheckedChange={setMultipleItems} />
          <Label htmlFor="airplane-mode" className="text-xs">Múltiplos itens</Label>
        </div>
      </div>
      {multipleItems ? (
        <div className="space-y-4">
          {fields.map((item, index) => (
            <div key={item.id} className="flex items-end gap-3">
              {/* Descrição */}
              <FieldGroup>
                <Controller
                  name={`items.${index}.description`}
                  control={control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid} className="gap-2">
                      <FieldLabel className="font-normal">Descrição</FieldLabel>
                      <Input {...field} placeholder="Ex: Hospedagem" />
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />
              </FieldGroup>

              {/* Valor */}
              <FieldGroup>
                <Controller
                  name={`items.${index}.amount`}
                  control={control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid} className="gap-2">
                      <FieldLabel className="font-normal">Valor</FieldLabel>
                      <Input
                        {...field}
                        placeholder="R$ 0,00"
                        onChange={(event) => {
                          const formattedValue = formatCurrencyBRL(event.target.value)
                          field.onChange(formattedValue)
                        }}
                      />
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />
              </FieldGroup>
              <FieldGroup>
                <Controller
                  name={`items.${index}.categoryId`}
                  control={control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid} className="gap-1">
                      <FieldLabel className="font-normal">Categoria</FieldLabel>
                      <Select value={field.value ?? ""} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>

                        <SelectContent>
                          {categories.map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {fieldState.invalid && (
                        <FieldError id="categoryId-error" errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />
              </FieldGroup>
              <FieldGroup>
                <Controller
                  name={`items.${index}.subCategoryId`}
                  control={control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid} className="gap-1">
                      <FieldLabel className="font-normal">Sub Categoria</FieldLabel>
                      <Select value={field.value ?? ""} onValueChange={field.onChange} disabled={!selectedCategoryId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>

                        <SelectContent>
                          {subCategories.map((subCategory) => (
                            <SelectItem key={subCategory.id} value={subCategory.id}>
                              {subCategory.name}
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

              {/* Remover */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => remove(index)}
              >
                <Trash2 className="text-red-500" />
              </Button>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            className="flex items-center gap-2 w-fit rounded-sm"
            onClick={handleAddItem}
          >
            <Plus className="w-4 h-4" />
            Adicionar Item
          </Button>

          {fields.length > 0 && (
            <div className="flex items-end justify-end flex-1 bg-green-50 gap-1 p-3 rounded-sm">
              <span className="text-xs text-gray-500 font-light">Total:</span>
              <span className="font-bold">
                {formatCurrencyBRL(totalFromItems)}
              </span>
            </div>
          )}
        </div>
      ) : (
        <FieldGroup>
          <Controller
            name="totalAmount"
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid} className="gap-2">
                <FieldLabel htmlFor="totalAmount" className="font-normal">Valor *</FieldLabel>
                <div>
                  <Input
                    {...field}
                    id="totalAmount"
                    type="text"
                    autoCapitalize="none"
                    autoCorrect="off"
                    aria-invalid={fieldState.invalid}
                    aria-describedby={
                      fieldState.invalid ? "totalAmount-error" : undefined
                    }
                    placeholder="R$ 0,00"
                    onChange={(event) => {
                      const formattedValue = formatCurrencyBRL(event.target.value)
                      field.onChange(formattedValue)
                    }}
                  />
                </div>
                {fieldState.invalid && (
                  <FieldError id="totalAmount-error" errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
        </FieldGroup>
      )}
    </Card>
  )
}
