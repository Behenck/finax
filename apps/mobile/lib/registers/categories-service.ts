import { deleteOrganizationsSlugCategoriesId } from "@/http/generated/deleteOrganizationsSlugCategoriesId";
import { getOrganizationsSlugCategories } from "@/http/generated/getOrganizationsSlugCategories";
import { postOrganizationsSlugCategories } from "@/http/generated/postOrganizationsSlugCategories";
import { putOrganizationsSlugCategoriesId } from "@/http/generated/putOrganizationsSlugCategoriesId";
import type { PostOrganizationsSlugCategoriesMutationRequest } from "@/http/generated/models/PostOrganizationsSlugCategories";
import type { PutOrganizationsSlugCategoriesIdMutationRequest } from "@/http/generated/models/PutOrganizationsSlugCategoriesId";
import type { Category, CategoryInput } from "@/types/registers";
import { undefinedIfEmpty } from "./utils";

function normalizeCategoryPayload(input: CategoryInput): CategoryInput {
  return {
    name: input.name.trim(),
    code: undefinedIfEmpty(input.code),
    type: input.type,
    icon: input.icon.trim(),
    color: input.color.trim(),
    parentId: undefinedIfEmpty(input.parentId),
  };
}

export async function listCategories(slug: string): Promise<Category[]> {
  const data = await getOrganizationsSlugCategories({ slug });
  return data.categories as Category[];
}

export async function createCategory(slug: string, payload: CategoryInput): Promise<string> {
  const data = await postOrganizationsSlugCategories({
    slug,
    data: normalizeCategoryPayload(payload) as PostOrganizationsSlugCategoriesMutationRequest,
  });
  return data.categoryId;
}

export async function updateCategory(
  slug: string,
  categoryId: string,
  payload: CategoryInput,
): Promise<void> {
  await putOrganizationsSlugCategoriesId({
    slug,
    id: categoryId,
    data: {
      name: payload.name.trim(),
      code: undefinedIfEmpty(payload.code),
      type: payload.type,
      icon: payload.icon.trim(),
      color: payload.color.trim(),
    } as PutOrganizationsSlugCategoriesIdMutationRequest,
  });
}

export async function deleteCategory(slug: string, categoryId: string): Promise<void> {
  await deleteOrganizationsSlugCategoriesId({ slug, id: categoryId });
}
