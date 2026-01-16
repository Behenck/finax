// utils/build-category-tree.ts

type FlatCategory = {
  id: string
  parentId: string | null
}

export type CategoryChild<T> = T & {
  parentId: string
}

export type CategoryRoot<T> = T & {
  parentId: null
  children: CategoryChild<T>[]
}

/**
 * Monta uma árvore de categorias com APENAS 2 níveis:
 * - Raiz (parentId = null)
 * - Filhos (parentId = raiz.id)
 *
 * Netos NÃO são permitidos.
 */
export function buildCategoryTree<T extends FlatCategory>(
  items: T[]
): CategoryRoot<T>[] {
  const roots = new Map<string, CategoryRoot<T>>()
  const children = new Map<string, CategoryChild<T>>()

  for (const item of items) {
    if (item.parentId === null) {
      roots.set(item.id, {
        ...item,
        parentId: null,
        children: [],
      })
    } else {
      children.set(item.id, {
        ...item,
        parentId: item.parentId,
      })
    }
  }

  for (const child of children.values()) {
    const parent = roots.get(child.parentId)

    if (!parent) {
      throw new Error(
        `Categoria filha ${child.id} possui parent inválido ou é neto (não permitido).`
      )
    }

    parent.children.push(child)
  }

  return Array.from(roots.values())
}
