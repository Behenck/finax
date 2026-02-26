type FlatProduct = {
  id: string
  parentId: string | null
}

export type ProductChild<T> = T & {
  parentId: string
}

export type ProductRoot<T> = T & {
  parentId: null
  children: ProductChild<T>[]
}

export function buildProductTree<T extends FlatProduct>(
  items: T[]
): ProductRoot<T>[] {
  const roots = new Map<string, ProductRoot<T>>()
  const children = new Map<string, ProductChild<T>>()

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
        `Product child ${child.id} has invalid parent or exceeds supported depth.`
      )
    }

    parent.children.push(child)
  }

  return Array.from(roots.values())
}

