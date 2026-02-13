import { Link } from '@tanstack/react-router'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from '@/components/ui/button'
import { TabCustomerPF } from './tab-customer-pf'
import { TabCustomerPJ } from './tab-customer-pj'
import { zodResolver } from '@hookform/resolvers/zod'
import { customerSchema, type CustomerFormInput } from '@/schemas/customer-schema'
import { FormProvider, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { usePostOrganizationsSlugCustomers } from '@/http/generated'

export function FormCustomer() {
  const form = useForm<CustomerFormInput>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      type: "PF",
      documentType: "CPF",
      email: "",
      phone: "",
    },
  })

  const type = form.watch("type")

  async function onSubmit(data: CustomerFormInput) {
    const parsed = customerSchema.parse(data)

    try {
      const response = await usePostOrganizationsSlugCustomers()
    } catch {
      toast.error("Erro ao Cadastrar")
    }
  }

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <Tabs
          value={type}
          onValueChange={(value) => {
            const newType = value as "PF" | "PJ"
            form.setValue("type", newType)
            if (newType === "PJ") {
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
          <Button variant='outline'>
            <Link to='/registers/customers'>
              Cancelar
            </Link>
          </Button>
          <Button type='submit'>
            Cadastrar Cliente
          </Button>
        </div>
      </form>
    </FormProvider>
  )
}