import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Building2, Plus, Search, Users } from 'lucide-react'
import { ListPartners } from './-components/list-partners'
import { useApp } from '@/context/app-context'
import { useMemo, useState } from 'react'
import { useGetOrganizationsSlugPartners } from '@/http/generated'

export const Route = createFileRoute('/_app/registers/partners/')({
  component: PartnersPage,
})

function PartnersPage() {
  const { organization } = useApp()
  const [search, setSearch] = useState("")

  if (!organization) return null

  const { data, isLoading, isError } = useGetOrganizationsSlugPartners({
    slug: organization.slug
  })

  const partners = data?.partners ?? []

  const filteredPartners = useMemo(() => {
    if (!search.trim()) return partners

    const query = search.toLowerCase()

    return partners.filter((customer) => {
      return (
        customer.name?.toLowerCase().includes(query) ||
        customer.email?.toLowerCase().includes(query) ||
        customer.phone?.includes(query)
      )
    })
  }, [partners, search])

  const stats = useMemo(() => {
    const total = partners.length

    const active = partners.filter(partner => partner.status === "ACTIVE").length
    const sales = 0
    const commissions = 0

    return { total, active, sales, commissions }
  }, [partners])


  if (isLoading) return <span>Carregando...</span>
  if (isError) return <span className="text-destructive">Erro ao carregar parceiros</span>

  return (
    <main className="w-full space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Gerenciar Parceiros</h1>
          <span className='text-sm text-muted-foreground'>Gerencie seus parceiros comerciais</span>
        </div>

        <Link to="/registers/partners/create">
          <Button>
            <Plus />
            Novo Parceiro
          </Button>
        </Link>
      </header>

      <div className='flex items-center w-full gap-4'>
        <Card className='p-6 gap-2 w-full'>
          <div className='flex items-center justify-between'>
            <span className='font-medium'>Total de Parceiros</span>
            <Users className='w-5 h-5' />
          </div>
          <div className='flex flex-col'>
            <span className='font-bold text-2xl'>{stats.total}</span>
            <span className='text-xs'>{stats.active} ativos</span>
          </div>
        </Card>
        <Card className='p-6 gap-2 w-full'>
          <div className='flex items-center justify-between'>
            <span className='font-medium'>Vendas por parceiros</span>
            <Building2 className='w-5 h-5' />
          </div>
          <div className='flex flex-col'>
            <span className='font-bold text-2xl'>{stats.sales}</span>
            <span className='text-xs'>vendas realizadas</span>
          </div>
        </Card>
        <Card className='p-6 gap-2 w-full'>
          <div className='flex items-center justify-between'>
            <span className='font-medium'>Comissões Geradas</span>
            <Building2 className='w-5 h-5 text-green-600' />
          </div>
          <div className='flex flex-col'>
            <span className='font-bold text-2xl text-green-600'>{stats.commissions}</span>
            <span className='text-xs'>Total em comissões</span>
          </div>
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
        <ListPartners partners={filteredPartners} />
      </section>
    </main>
  )
}
