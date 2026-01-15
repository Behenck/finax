import type { TransactionType } from "generated/prisma/enums"

type CategoryBase = {
  id: string
  name: string
  type: TransactionType
  color: string
  icon: string
  parentId: string | null
}

type CategoryTree = CategoryBase & {
  children: CategoryTree[]
}

export function buildCategoryTree(
  flatCategories: CategoryBase[],
): CategoryTree[] {
  const categoryById = new Map<string, CategoryTree>()

  flatCategories.forEach((category) => {
    categoryById.set(category.id, {
      ...category,
      children: [],
    })
  })

  return flatCategories.reduce<CategoryTree[]>(
    (rootCategories, category) => {
      const currentCategory = categoryById.get(category.id)!

      if (!category.parentId) {
        rootCategories.push(currentCategory)
        return rootCategories
      }

      const parentCategory = categoryById.get(category.parentId)

      if (parentCategory) {
        parentCategory.children.push(currentCategory)
      }

      return rootCategories
    },
    [],
  )
}
