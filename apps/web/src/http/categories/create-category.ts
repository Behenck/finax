import type { CategoryFormData } from '@/schemas/category-schema'
import { postOrganizationsSlugCategories } from '../generated'

export async function createCategory(data: CategoryFormData) {
  const slug = "behenck"
  await postOrganizationsSlugCategories({ slug }, data)
}
