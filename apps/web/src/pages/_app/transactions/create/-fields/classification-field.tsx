import { Card } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
                <Select value={field.value ?? ""} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>

                  <SelectContent>
                    {companies.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                <Select value={field.value ?? ""} onValueChange={field.onChange} disabled={!selectedCompanyId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>

                  <SelectContent>
                    {units.map((unit) => (
                      <SelectItem key={unit.id} value={unit.id}>
                        {unit.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
              <Select value={field.value ?? ""} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>

                <SelectContent>
                  {costCenters.map((costCenter) => (
                    <SelectItem key={costCenter.id} value={costCenter.id}>
                      {costCenter.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            name="subCategoryId"
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
      </div>
      {/* Categorias */}
    </Card>
  )
}
