type RawCategory = {
  id: string
  name: string
  icon: string
  color: string
  parent?: {
    id: string
    name: string
    icon: string
    color: string
  } | null
}

export function normalizeCategory(category: RawCategory) {
  if (category.parent) {
    return {
      id: category.parent.id,
      name: category.parent.name,
      icon: category.parent.icon,
      color: category.parent.color,
      children: {
        id: category.id,
        name: category.name,
        icon: category.icon,
        color: category.color,
      },
    }
  }

  return {
    id: category.id,
    name: category.name,
    icon: category.icon,
    color: category.color,
    children: null,
  }
}
