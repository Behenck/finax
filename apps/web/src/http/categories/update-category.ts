import type { CategoryFormData } from '@/schemas/category-schema'
import { putOrganizationsSlugCategoriesId } from '../generated'

interface UpdateCategoryRequest {
  id: string
  data: CategoryFormData
}

export async function updateCategory({
  id,
  data,
}: UpdateCategoryRequest) {
  const slug = "behenck"

  await putOrganizationsSlugCategoriesId({ id, slug }, data)
}
