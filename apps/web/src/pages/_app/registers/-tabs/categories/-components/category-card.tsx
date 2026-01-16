import { useState } from 'react'
import { ChevronRight, ChevronUp, Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from '@/components/ui/dialog'

import { CategoryForm } from './category-form'
import { CategoryRow } from './category-row'
import { UpdateCategory } from './update-category'

import type { Category } from '@/schemas/types/category'
import { getLucideIcon } from '@/components/lucide-icon'
import { useDeleteCategory } from '@/hooks/categories/use-delete-category'

interface CategoryCardProps {
  category: Category
}

type DeleteTarget = { id: string; name: string }

export function CategoryCard({ category }: CategoryCardProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isCreateOpen, setIsCreateOpen] = useState(false)

  const { mutateAsync: handleDeleteCategory, isPending } = useDeleteCategory()

  const Icon = getLucideIcon(category.icon)
  const children = category.children ?? []
  const hasChildren = children.length > 0

  async function onDelete(category: DeleteTarget) {
    const confirmed = window.confirm(`Deseja realmente excluir a categoria ${category.name} ?`)
    if (!confirmed) return
    await handleDeleteCategory(category.id)
  }

  return (
    <Card className="px-6 py-4 rounded-lg">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="flex items-center justify-between">
          <CollapsibleTrigger className="flex items-center gap-4 cursor-pointer">
            {hasChildren ? (
              isOpen ? (
                <ChevronUp className="size-5" />
              ) : (
                <ChevronRight className="size-5" />
              )
            ) : (
              <div className="size-5" />
            )}

            <div className="flex items-center gap-3">
              <div
                className="p-2 rounded-xl"
                style={{
                  backgroundColor: `${category.color}20`,
                  color: category.color,
                }}
              >
                <Icon className="size-4" />
              </div>

              <div className='flex flex-col text-left'>
                <span className="font-medium ">{category.name}</span>
                <span className='text-gray-500 text-xs'>{category.code}</span>
              </div>
            </div>
          </CollapsibleTrigger>

          <div className="flex items-center gap-1">
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Plus />
                </Button>
              </DialogTrigger>

              <DialogContent>
                <CategoryForm
                  mode="create"
                  parentId={category.id}
                  parentColor={category.color}
                  onSuccess={() => setIsCreateOpen(false)}
                />
              </DialogContent>
            </Dialog>

            <UpdateCategory category={category} />

            <Button
              variant="ghost"
              size="icon"
              disabled={isPending}
              onClick={() => onDelete(category)}
            >
              <Trash2 className='text-red-600' />
            </Button>
          </div>
        </div>

        {hasChildren && (
          <CollapsibleContent className="mt-2 space-y-2">
            {category.children?.map(child => (
              <div key={child.id} className="ml-8 mr-2">
                <CategoryRow
                  category={child}
                  isLoading={isPending}
                  onDelete={onDelete}
                />
              </div>
            ))}
          </CollapsibleContent>
        )}
      </Collapsible>
    </Card>
  )
}
