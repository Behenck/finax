import { createFileRoute } from '@tanstack/react-router'
import { FormCustomer } from './-components/form-customer'
import z from 'zod';
import { useGetOrganizationsSlugCustomersCustomerid } from '@/http/generated';
import { useApp } from '@/context/app-context';

const updateCustomerSearchSchema = z.object({
  customerId: z.uuid(),
});

export const Route = createFileRoute('/_app/registers/customers/update')({
  validateSearch: (search) => updateCustomerSearchSchema.parse(search),
  component: UpdateCustomer,
})

function UpdateCustomer() {
  const { customerId } = Route.useSearch();
  const { organization } = useApp()

  const { data } = useGetOrganizationsSlugCustomersCustomerid({
    slug: organization!.slug,
    customerId
  })

  return (
    <main className="w-full space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Editar Cliente</h1>
          <span className='text-xs text-muted-foreground'>Preencha os dados para cadastrar um novo cliente.</span>
        </div>
      </header>

      <FormCustomer customer={data?.customer} />
    </main>
  )
}
