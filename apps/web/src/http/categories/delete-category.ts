import { deleteOrganizationsSlugCategoriesId } from "../generated";

export async function deleteCategory(id: string) {
	const slug = "behenck";
	await deleteOrganizationsSlugCategoriesId({ slug, id });
}
