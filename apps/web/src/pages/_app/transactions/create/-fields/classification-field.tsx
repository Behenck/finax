import { Card } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useApp } from "@/context/app-context";
import {
  useGetOrganizationsSlugCategories,
  useGetOrganizationsSlugCompanies,
  useGetOrganizationsSlugCostcenters,
} from "@/http/generated";
import type { TransactionFormData } from "@/schemas/transaction-schema";
import { Controller, useWatch, type Control } from "react-hook-form";

interface ClassificationFieldProps {
  control: Control<TransactionFormData>
}

export function ClassificationField({ control }: ClassificationFieldProps) {
  const { organization } = useApp()
  const { data: companiesData } = useGetOrganizationsSlugCompanies({
    slug: organization?.slug ?? "",
  })
  const { data: categoriesData } = useGetOrganizationsSlugCategories({
    slug: organization?.slug ?? "",
  })
  const { data: costCentersData } = useGetOrganizationsSlugCostcenters({
    slug: organization?.slug ?? "",
  })

  const companies = companiesData?.companies ?? []
  const categories = categoriesData?.categories ?? []
  const costCenters = costCentersData?.costCenters ?? []

  const selectedCompanyId = useWatch({
    control,
    name: 'companyId',
  })
  const selectedCompany = companies.find(
    (company) => company.id === selectedCompanyId,
  )
  const units = selectedCompany?.units ?? []

  const selectedCategoryId = useWatch({
    control,
    name: 'categoryId',
  })
  const selectedCategory = categories.find(
    (category) => category.id === selectedCategoryId,
  )
  const subCategories = selectedCategory?.children ?? []

  return (
    <Card className="p-5 rounded-sm gap-3">
      <span className="font-semibold text-md">Classificação</span>
      <div className="flex items-center gap-3">
        {/* Empresa */}
        <FieldGroup>
          <Controller
            name="companyId"
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid} className="gap-1">
                <FieldLabel className="font-normal">Empresa</FieldLabel>
                <SearchableSelect
                  options={companies.map((company) => ({
                    value: company.id,
                    label: company.name,
                  }))}
                  value={field.value ?? undefined}
                  onValueChange={field.onChange}
                  placeholder="Selecione"
                  searchPlaceholder="Buscar empresa..."
                  emptyMessage="Nenhuma empresa encontrada."
                />
                {fieldState.invalid && (
                  <FieldError id="companyId-error" errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
        </FieldGroup>
        <FieldGroup>
          <Controller
            name="unitId"
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid} className="gap-1">
                <FieldLabel className="font-normal">Unidade</FieldLabel>
                <SearchableSelect
                  options={units.map((unit) => ({
                    value: unit.id,
                    label: unit.name,
                  }))}
                  value={field.value ?? undefined}
                  onValueChange={field.onChange}
                  disabled={!selectedCompanyId}
                  placeholder="Selecione"
                  searchPlaceholder="Buscar unidade..."
                  emptyMessage="Nenhuma unidade encontrada."
                />
                {fieldState.invalid && (
                  <FieldError id="unitId-error" errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
        </FieldGroup>
      </div>
      {/* Empresa */}
      {/* Centro de Custo */}
      <FieldGroup>
        <Controller
          name="costCenterId"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid} className="gap-1">
              <FieldLabel className="font-normal">Centro de Custo</FieldLabel>
              <SearchableSelect
                options={costCenters.map((costCenter) => ({
                  value: costCenter.id,
                  label: costCenter.name,
                }))}
                value={field.value ?? undefined}
                onValueChange={field.onChange}
                placeholder="Selecione"
                searchPlaceholder="Buscar centro de custo..."
                emptyMessage="Nenhum centro de custo encontrado."
              />
              {fieldState.invalid && (
                <FieldError id="costCenterId-error" errors={[fieldState.error]} />
              )}
            </Field>
          )}
        />
      </FieldGroup>
      {/* Centro de Custo */}
      {/* Categorias */}
      <div className="flex items-center gap-3">
        <FieldGroup>
          <Controller
            name="categoryId"
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid} className="gap-1">
                <FieldLabel className="font-normal">Categoria</FieldLabel>
                <SearchableSelect
                  options={categories.map((category) => ({
                    value: category.id,
                    label: category.name,
                  }))}
                  value={field.value ?? undefined}
                  onValueChange={field.onChange}
                  placeholder="Selecione"
                  searchPlaceholder="Buscar categoria..."
                  emptyMessage="Nenhuma categoria encontrada."
                />
                {fieldState.invalid && (
                  <FieldError id="categoryId-error" errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
        </FieldGroup>
        <FieldGroup>
          <Controller
            name="subCategoryId"
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid} className="gap-1">
                <FieldLabel className="font-normal">Sub Categoria</FieldLabel>
                <SearchableSelect
                  options={subCategories.map((subCategory) => ({
                    value: subCategory.id,
                    label: subCategory.name,
                  }))}
                  value={field.value ?? undefined}
                  onValueChange={field.onChange}
                  disabled={!selectedCategoryId}
                  placeholder="Selecione"
                  searchPlaceholder="Buscar subcategoria..."
                  emptyMessage="Nenhuma subcategoria encontrada."
                />
                {fieldState.invalid && (
                  <FieldError id="subCategoryId-error" errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
        </FieldGroup>
      </div>
      {/* Categorias */}
    </Card>
  )
}
