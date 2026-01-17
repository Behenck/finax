import { createFileRoute } from '@tanstack/react-router'
import { CreateCategory } from './-components/create-category'
import { useCategories } from '@/hooks/categories/use-category'
import { useMemo, useState } from 'react'
import { CategoryColumn } from './-components/category-column'
import { Input } from '@/components/ui/input'
import { isNotNull } from '@/utils/is-not-null'
import { Search } from 'lucide-react'

export const Route = createFileRoute('/_app/registers/categories/')({
  component: Categories,
})

function Categories() {
  const { data: categories, isError, isLoading } = useCategories()
  const [search, setSearch] = useState('')

  const safeCategories = categories ?? []

  const filteredCategories = useMemo(() => {
    if (!search.trim()) return safeCategories

    const query = search.toLowerCase()

    return safeCategories
      .map(category => {
        const categoryMatch =
          category.name.toLowerCase().includes(query) ||
          category.code?.toLowerCase().includes(query)

        const filteredChildren =
          category.children?.filter(child =>
            child.name.toLowerCase().includes(query) ||
            child.code?.toLowerCase().includes(query)
          ) ?? []

        if (categoryMatch) {
          return category
        }

        if (filteredChildren.length > 0) {
          return {
            ...category,
            children: filteredChildren,
          }
        }

        return null
      })
      .filter(isNotNull)
  }, [safeCategories, search])

  const { income, outcome } = useMemo(() => {
    return {
      income: filteredCategories.filter(category => category?.type === 'INCOME'),
      outcome: filteredCategories.filter(category => category?.type === 'OUTCOME'),
    }
  }, [filteredCategories])

  if (isLoading) return <h1>Carregando...</h1>

  if (isError) {
    return <p className="text-destructive">Erro ao carregar categorias.</p>
  }

  return (
    <main className="w-full space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          Gerenciar Categorias
        </h1>

        <CreateCategory />
      </header>

      <div className='relative'>
        <Search className='absolute left-5 top-1/2 -translate-1/2 size-4 text-gray-500' />
        <Input
          placeholder="Buscar por nome ou código..."
          className="max-w-[40%] h-10 pl-10"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <section className="flex gap-6">
        <CategoryColumn title="Despesas" categories={outcome} />
        <CategoryColumn title="Receitas" categories={income} />
      </section>
    </main>
  )
}


