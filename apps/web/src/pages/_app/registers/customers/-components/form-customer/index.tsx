import { Link } from '@tanstack/react-router'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from '@/components/ui/button'
import { MobileBottomActionBar } from '@/components/mobile-bottom-action-bar'
import { TabCustomerPF } from './tab-customer-pf'
import { TabCustomerPJ } from './tab-customer-pj'
import { FormProvider } from 'react-hook-form'
import { Controller } from 'react-hook-form'
import {
  type GetOrganizationsSlugCustomersCustomerid200,
  useGetOrganizationsSlugPartners,
  useGetOrganizationsSlugSellers,
} from '@/http/generated'
import { useCustomerForm } from './hooks/use-customer-form'
import { useApp } from '@/context/app-context'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FieldError } from '@/components/field-error'

interface FormCustomerProps {
  customer?: GetOrganizationsSlugCustomersCustomerid200["customer"] & {
    responsible?: {
      type: "SELLER" | "PARTNER"
      id: string
      name: string
    } | null
  }
  type?: "CREATE" | "UPDATE"
}

export function FormCustomer({ customer, type = "CREATE" }: FormCustomerProps) {
  const { organization } = useApp()
  const { form, personType, onSubmit } = useCustomerForm({
    customer,
    type,
  })
  const responsibleType = form.watch("responsibleType")

  const { data: sellersData } = useGetOrganizationsSlugSellers(
    { slug: organization?.slug ?? "" },
    { query: { enabled: !!organization?.slug } },
  )

  const { data: partnersData } = useGetOrganizationsSlugPartners(
    { slug: organization?.slug ?? "" },
    { query: { enabled: !!organization?.slug } },
  )

  const responsibleOptions =
    responsibleType === "SELLER"
      ? (sellersData?.sellers ?? []).map((seller) => ({
          id: seller.id,
          name: seller.name,
        }))
      : responsibleType === "PARTNER"
        ? (partnersData?.partners ?? []).map((partner) => ({
            id: partner.id,
            name: partner.name,
          }))
        : []

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="rounded-lg border p-4 space-y-4">
          <h3 className="text-sm font-medium">Responsável do cliente</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FieldGroup>
              <Field className="gap-1">
                <FieldLabel>Tipo</FieldLabel>
                <Controller
                  name="responsibleType"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <>
                      <Select
                        value={field.value ?? "NONE"}
                        onValueChange={(value) => {
                          const nextValue =
                            value === "NONE"
                              ? undefined
                              : (value as "SELLER" | "PARTNER")

                          field.onChange(nextValue)
                          form.setValue("responsibleId", undefined)
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectItem value="NONE">Sem responsável</SelectItem>
                            <SelectItem value="SELLER">Vendedor</SelectItem>
                            <SelectItem value="PARTNER">Parceiro</SelectItem>
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      <FieldError error={fieldState.error} />
                    </>
                  )}
                />
              </Field>
            </FieldGroup>

            <FieldGroup>
              <Field className="gap-1">
                <FieldLabel>Responsável</FieldLabel>
                <Controller
                  name="responsibleId"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <>
                      <Select
                        value={field.value ?? "NONE"}
                        onValueChange={(value) =>
                          field.onChange(value === "NONE" ? undefined : value)
                        }
                        disabled={!responsibleType}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue
                            placeholder={
                              responsibleType
                                ? "Selecione o responsável"
                                : "Selecione o tipo primeiro"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectItem value="NONE">Nenhum</SelectItem>
                            {responsibleOptions.map((option) => (
                              <SelectItem key={option.id} value={option.id}>
                                {option.name}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      <FieldError error={fieldState.error} />
                    </>
                  )}
                />
              </Field>
            </FieldGroup>
          </div>
        </div>

        <Tabs
          value={personType}
          onValueChange={(value) => {
            const newPersonTypeType = value as "PF" | "PJ"
            form.setValue("personType", newPersonTypeType)
            if (newPersonTypeType === "PJ") {
              form.setValue("documentType", "CNPJ")
            } else {
              form.setValue("documentType", "CPF")
            }
          }}
        >
          <TabsList>
            <TabsTrigger value="PF">
              Pessoa Física
            </TabsTrigger>
            <TabsTrigger value="PJ">
              Pessoa Jurídica
            </TabsTrigger>
          </TabsList>

          <TabsContent value='PF' className='mt-4'>
            <TabCustomerPF />
          </TabsContent>
          <TabsContent value='PJ' className='mt-4'>
            <TabCustomerPJ />
          </TabsContent>
        </Tabs>

        <div className='hidden items-center justify-end gap-2 md:flex'>
          <Button type='button' variant="outline" asChild>
            <Link to="/registers/customers">
              Cancelar
            </Link>
          </Button>
          <Button type='submit'>
            {type === "CREATE" ? (
              "Cadastrar Cliente"
            ) : (
              "Atualizar Cliente"
            )}
          </Button>
        </div>
        <MobileBottomActionBar>
          <div className="grid grid-cols-2 gap-2">
            <Button type='button' variant="outline" asChild>
              <Link to="/registers/customers">
                Cancelar
              </Link>
            </Button>
            <Button type='submit'>
              {type === "CREATE" ? (
                "Cadastrar Cliente"
              ) : (
                "Atualizar Cliente"
              )}
            </Button>
          </div>
        </MobileBottomActionBar>
        <div className="h-20 md:hidden" />
      </form>
    </FormProvider>
  )
}
