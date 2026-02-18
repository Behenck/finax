import { Link } from '@tanstack/react-router'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from '@/components/ui/button'
import { TabCustomerPF } from './tab-customer-pf'
import { TabCustomerPJ } from './tab-customer-pj'
import { zodResolver } from '@hookform/resolvers/zod'
import { customerSchema, type CustomerFormInput } from '@/schemas/customer-schema'
import { FormProvider, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { usePostOrganizationsSlugCustomers, type GetOrganizationsSlugCustomers200 } from '@/http/generated'
import { useApp } from '@/context/app-context'
import { mapCustomerFormToRequest } from './-mappers/customer-mapper'

interface FormCustomerProps {
  customer?: GetOrganizationsSlugCustomers200["customers"][number]
}

export function FormCustomer({ customer }: FormCustomerProps) {
  const { organization } = useApp()
  const { mutateAsync: createCustomer, isPending } =
    usePostOrganizationsSlugCustomers()

  const form = useForm<CustomerFormInput>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      personType: "PF",
      documentType: "CPF",
      email: "",
      phone: "",
    },
  })

  const personType = form.watch("personType")

  async function onSubmit(data: CustomerFormInput) {
    const payload = customerSchema.parse(data)

    try {
      await createCustomer({
        slug: organization!.slug,
        data: mapCustomerFormToRequest(payload),
      })

      toast.success("Cliente cadastrado com sucesso")
      form.reset()
    } catch (err) {
      console.log(err)
      toast.error("Erro ao Cadastrar")
    }
  }

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