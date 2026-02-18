import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Plus, Search, ShieldUser, User, UserCheck, Users } from 'lucide-react'
import { ListCustomers } from './-components/list-customers'
import { useApp } from '@/context/app-context'
import { useMemo, useState } from 'react'
import { useGetOrganizationsSlugCustomers } from '@/http/generated'

export const Route = createFileRoute('/_app/registers/customers/')({
  component: CustomersPage,
})

function CustomersPage() {
  const { organization } = useApp()
  const [search, setSearch] = useState("")

  if (!organization) return null

  const { data, isLoading, isError } = useGetOrganizationsSlugCustomers({
    slug: organization.slug
  })

  const customers = data?.customers ?? []

  const filteredCustomers = useMemo(() => {
    if (!search.trim()) return customers

    const query = search.toLowerCase()

    return customers.filter((customer) => {
      return (
        customer.name?.toLowerCase().includes(query) ||
        customer.email?.toLowerCase().includes(query) ||
        customer.phone?.includes(query)
      )
    })
  }, [customers, search])

  const stats = useMemo(() => {
    const total = customers.length

    const active = customers.filter(client => client.status === "ACTIVE").length
    const pf = customers.filter(client => client.personType === "PF").length
    const pj = customers.filter(client => client.personType === "PJ").length

    return { total, active, pf, pj }
  }, [customers])


  if (isLoading) return <span>Carregando...</span>
  if (isError) return <span className="text-destructive">Erro ao carregar clientes</span>

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
          <span className='font-bold text-2xl'>{stats.total}</span>
        </Card>
        <Card className='p-6 gap-2 w-full'>
          <div className='flex items-center justify-between'>
            <span className='font-medium'>Clientes Ativos</span>
            <UserCheck className='w-5 h-5' />
          </div>
          <span className='font-bold text-2xl'>{stats.active}</span>
        </Card>
        <Card className='p-6 gap-2 w-full'>
          <div className='flex items-center justify-between'>
            <span className='font-medium'>Pessoa Física</span>
            <User className='w-5 h-5' />
          </div>
          <span className='font-bold text-2xl'>{stats.pf}</span>
        </Card>
        <Card className='p-6 gap-2 w-full'>
          <div className='flex items-center justify-between'>
            <span className='font-medium'>Pessoa Jurídica</span>
            <ShieldUser className='w-5 h-5' />
          </div>
          <span className='font-bold text-2xl'>{stats.pj}</span>
        </Card>
      </div>

      <div className="relative">
        <Search className="absolute left-5 top-1/2 -translate-1/2 size-4 text-gray-500" />
        <Input
          placeholder="Buscar por nome..."
          className="max-w-[40%] h-10 pl-10"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <section className="space-y-2">
        <ListCustomers customers={filteredCustomers} />
      </section>
    </main>
  )
}
