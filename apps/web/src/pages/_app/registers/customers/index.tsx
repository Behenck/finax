import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Plus, Search, ShieldUser, User, UserCheck, Users } from 'lucide-react'
import { ListCustomers } from './-components/list-customers'

export const Route = createFileRoute('/_app/registers/customers/')({
  component: CustomersPage,
})

function CustomersPage() {
  return (
    <main className="w-full space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Gerenciar Clientes</h1>

        <Link to="/registers/customers/create">
          <Button>
            <Plus />
            Novo Cliente
          </Button>
        </Link>
      </header>

      <div className='flex items-center w-full gap-4'>
        <Card className='p-6 gap-2 w-full'>
          <div className='flex items-center justify-between'>
            <span className='font-medium'>Total de Clientes</span>
            <Users className='w-5 h-5' />
          </div>
          <span className='font-bold text-2xl'>12</span>
        </Card>
        <Card className='p-6 gap-2 w-full'>
          <div className='flex items-center justify-between'>
            <span className='font-medium'>Clientes Ativos</span>
            <UserCheck className='w-5 h-5' />
          </div>
          <span className='font-bold text-2xl'>10</span>
        </Card>
        <Card className='p-6 gap-2 w-full'>
          <div className='flex items-center justify-between'>
            <span className='font-medium'>Pessoa Física</span>
            <User className='w-5 h-5' />
          </div>
          <span className='font-bold text-2xl'>8</span>
        </Card>
        <Card className='p-6 gap-2 w-full'>
          <div className='flex items-center justify-between'>
            <span className='font-medium'>Pessoa Jurídica</span>
            <ShieldUser className='w-5 h-5' />
          </div>
          <span className='font-bold text-2xl'>2</span>
        </Card>
      </div>

      <div className="relative">
        <Search className="absolute left-5 top-1/2 -translate-1/2 size-4 text-gray-500" />
        <Input
          placeholder="Buscar por nome..."
          className="max-w-[40%] h-10 pl-10"
        // value={search}
        // onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <section className="space-y-2">
        <ListCustomers />
      </section>
    </main>
  )
}
