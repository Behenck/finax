import type { Category } from "@/schemas/types/category";
import { getOrganizationsSlugCategories } from "@/http/generated";

export async function getCategories(): Promise<Category[]> {
	const slug = "behenck";
	const { categories } = await getOrganizationsSlugCategories({ slug });

	return categories;
}
