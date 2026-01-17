import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Plus, Search } from 'lucide-react'
import { useState } from 'react'

export const Route = createFileRoute('/_app/transactions/')({
  component: RouteComponent,
})

function RouteComponent() {
  const [search, setSearch] = useState('')

  return (
    <main className="w-full space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          Gerenciar Transações
        </h1>

        <Button asChild>
          <Link to="/transactions/create">
            <Plus />
            Nova Transação
          </Link>
        </Button>
      </header>

      <div className='relative'>
        <Search className='absolute left-5 top-1/2 -translate-1/2 size-4 text-gray-500' />
        <Input
          placeholder="Buscar nome ou código..."
          className="max-w-[40%] h-10 pl-10"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <section className="space-y-4">
        
      </section>
    </main>
  )
}
