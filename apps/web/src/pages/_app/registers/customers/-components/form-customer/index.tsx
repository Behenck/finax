import { Link } from '@tanstack/react-router'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from '@/components/ui/button'
import { TabCustomerPF } from './tab-customer-pf'
import { TabCustomerPJ } from './tab-customer-pj'
import { FormProvider } from 'react-hook-form'
import { type GetOrganizationsSlugCustomersCustomerid200 } from '@/http/generated'
import { useCustomerForm } from './hooks/use-customer-form'

interface FormCustomerProps {
  customer?: GetOrganizationsSlugCustomersCustomerid200["customer"]
  type?: "CREATE" | "UPDATE"
}

export function FormCustomer({ customer, type = "CREATE" }: FormCustomerProps) {
  const { form, personType, onSubmit } = useCustomerForm({
    customer,
    type,
  })

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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

        <div className='flex items-center gap-2 justify-end'>
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
      </form>
    </FormProvider>
  )
}