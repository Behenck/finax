import type { Category } from '@/schemas/types/category'
import { CategoryCard } from './category-card'

interface CategoryColumnProps {
  title: string
  categories: Category[]
}

export function CategoryColumn({
  title,
  categories,
}: CategoryColumnProps) {
  return (
    <section className="flex-1 space-y-2">
      <h2 className="text-muted-foreground font-medium">
        {title}
      </h2>

      {categories.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nenhuma categoria cadastrada.
        </p>
      )}

      {categories.map(category => (
        <CategoryCard
          key={category.id}
          category={category}
        />
      ))}
    </section>
  )
}
