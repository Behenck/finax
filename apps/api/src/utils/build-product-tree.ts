type FlatProduct = {
  id: string
  parentId: string | null
}

export type ProductTreeNode<T extends FlatProduct> = T & {
  children: ProductTreeNode<T>[]
}

export type ProductRoot<T extends FlatProduct> = ProductTreeNode<T> & {
  parentId: null
}

export function buildProductTree<T extends FlatProduct>(
  items: T[]
): ProductRoot<T>[] {
  const nodes = new Map<string, ProductTreeNode<T>>()
  const roots: ProductRoot<T>[] = []

  for (const item of items) {
    nodes.set(item.id, {
      ...item,
      children: [],
    })
  }

  for (const item of items) {
    const node = nodes.get(item.id)
    if (!node) continue

    if (item.parentId === null) {
      roots.push(node as ProductRoot<T>)
      continue
    }

    const parent = nodes.get(item.parentId)

    if (!parent) {
      throw new Error(
        `Product ${item.id} has invalid parent (${item.parentId}).`
      )
    }

    parent.children.push(node)
  }

  return roots
}
