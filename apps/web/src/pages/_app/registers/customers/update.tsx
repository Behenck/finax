import { createFileRoute } from '@tanstack/react-router'
import { FormCustomer } from './-components/form-customer'
import { Card } from '@/components/ui/card'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { CustomerSalesList } from './-components/customer-sales-list'
import z from 'zod';
import { useGetOrganizationsSlugCustomersCustomerid } from '@/http/generated';
import { useApp } from '@/context/app-context';
import { useAbility } from '@/permissions/access';

const updateCustomerSearchSchema = z.object({
  customerId: z.uuid(),
});

export const Route = createFileRoute('/_app/registers/customers/update')({
  validateSearch: (search) => updateCustomerSearchSchema.parse(search),
  component: UpdateCustomer,
})

export function UpdateCustomer() {
  const ability = useAbility()
  const { customerId } = Route.useSearch();
  const { organization } = useApp()
  const canManageDelinquencies = ability.can("access", "sales.update")

  const { data } = useGetOrganizationsSlugCustomersCustomerid({
    slug: organization!.slug,
    customerId
  })

  if (!data?.customer) {
    return <span>Carregando...</span>
  }

  const { customer } = data
  const delinquentSalesCount = customer.sales.filter(
    (sale) => sale.delinquencySummary.hasOpen,
  ).length
  const openDelinquenciesCount = customer.sales.reduce(
    (total, sale) => total + sale.delinquencySummary.openCount,
    0,
  )

  return (
    <main className="w-full space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Editar Cliente</h1>
          <span className='text-xs text-muted-foreground'>Preencha os dados para atualizar o cliente.</span>
        </div>
      </header>

      <Tabs defaultValue="dados" className="space-y-4">
        <TabsList>
          <TabsTrigger value="dados">Dados</TabsTrigger>
          <TabsTrigger value="vendas">Vendas</TabsTrigger>
        </TabsList>

        <TabsContent value="dados" className="space-y-4">
          <FormCustomer type='UPDATE' customer={customer} />
        </TabsContent>

        <TabsContent value="vendas" className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <Card className="p-5 space-y-1">
              <p className="text-sm text-muted-foreground">Total de vendas</p>
              <p className="text-2xl font-semibold">{customer.sales.length}</p>
            </Card>
            <Card className="p-5 space-y-1">
              <p className="text-sm text-muted-foreground">Vendas inadimplentes</p>
              <p className="text-2xl font-semibold">{delinquentSalesCount}</p>
            </Card>
            <Card className="p-5 space-y-1">
              <p className="text-sm text-muted-foreground">Ocorrências em aberto</p>
              <p className="text-2xl font-semibold">{openDelinquenciesCount}</p>
            </Card>
          </div>

          <div className="space-y-1">
            <h2 className="font-semibold">Vendas do cliente</h2>
            <p className="text-sm text-muted-foreground">
              As vendas com inadimplência aparecem destacadas para facilitar a
              identificação de possível risco de estorno.
            </p>
          </div>

          <CustomerSalesList
            sales={customer.sales}
            customerId={customer.id}
            canManageDelinquencies={canManageDelinquencies}
          />
        </TabsContent>
      </Tabs>
    </main>
  )
}
