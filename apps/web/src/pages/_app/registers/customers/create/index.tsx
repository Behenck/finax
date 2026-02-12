import { createFileRoute, Link } from '@tanstack/react-router'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from '@/components/ui/button'
import { useState } from 'react'
import { TabCustomerPF } from './-components/tab-customer-pf'
import { TabCustomerPJ } from './-components/tab-customer-pj'

export const Route = createFileRoute(
  '/_app/registers/customers/create/',
)({
  component: CreateCustomer,
})

function CreateCustomer() {
  const [date, setDate] = useState<Date>()

  return (
    <main className="w-full space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Cadastrar Cliente</h1>
          <span className='text-xs text-muted-foreground'>Preencha os dados para cadastrar um novo cliente.</span>
        </div>
      </header>

      <form className="space-y-4">
        <Tabs defaultValue="preview">
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
    </main>
  )
}
