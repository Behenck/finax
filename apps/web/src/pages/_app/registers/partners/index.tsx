import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/page-header'
import { textFilterParser } from '@/hooks/filters/parsers'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Building2, Plus, Search, Users } from 'lucide-react'
import { ListPartners } from './-components/list-partners'
import { useApp } from '@/context/app-context'
import { useMemo } from 'react'
import { useGetOrganizationsSlugPartners } from '@/http/generated'
import { useQueryState } from 'nuqs'

export const Route = createFileRoute('/_app/registers/partners/')({
  component: PartnersPage,
})

function PartnersPage() {
  const { organization } = useApp()
  const [search, setSearch] = useQueryState("q", textFilterParser)
  const slug = organization?.slug ?? ""
  const { data, isLoading, isError } = useGetOrganizationsSlugPartners(
    { slug },
    { query: { enabled: Boolean(slug) } },
  )

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
  if (!organization) return null
  if (isError) return <span className="text-destructive">Erro ao carregar parceiros</span>

  return (
    <main className="w-full space-y-6">
      <PageHeader
        title="Gerenciar Parceiros"
        description="Gerencie seus parceiros comerciais"
        actions={
          <Link to="/registers/partners/create">
            <Button className="w-full sm:w-auto">
              <Plus />
              Novo Parceiro
            </Button>
          </Link>
        }
      />

      <div className='hidden grid-cols-1 gap-3 md:grid md:grid-cols-2 xl:grid-cols-3'>
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
          className="h-10 w-full pl-10 sm:max-w-md"
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
