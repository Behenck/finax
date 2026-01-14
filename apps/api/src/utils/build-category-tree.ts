type FlatCategory = {
  id: string
  name: string
  parentId: string | null
  color: string | null
  icon: string | null
}

type CategoryTree = FlatCategory & {
  children: CategoryTree[]
}

export function buildCategoryTree(
  flatCategories: FlatCategory[],
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
