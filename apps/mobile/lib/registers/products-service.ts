import { deleteOrganizationsSlugProductsId } from "@/http/generated/deleteOrganizationsSlugProductsId";
import { getOrganizationsSlugProducts } from "@/http/generated/getOrganizationsSlugProducts";
import { getOrganizationsSlugProductsId } from "@/http/generated/getOrganizationsSlugProductsId";
import { postOrganizationsSlugProducts } from "@/http/generated/postOrganizationsSlugProducts";
import { putOrganizationsSlugProductsId } from "@/http/generated/putOrganizationsSlugProductsId";
import type { PostOrganizationsSlugProductsMutationRequest } from "@/http/generated/models/PostOrganizationsSlugProducts";
import type { PutOrganizationsSlugProductsIdMutationRequest } from "@/http/generated/models/PutOrganizationsSlugProductsId";
import type { Product, ProductInput, ProductNode } from "@/types/registers";

function normalizeProductPayload(input: ProductInput): ProductInput {
  return {
    name: input.name.trim(),
    description: input.description?.trim() || null,
    parentId: input.parentId ?? null,
    isActive: input.isActive ?? true,
    sortOrder: Number.isFinite(input.sortOrder) ? input.sortOrder : 0,
  };
}

export async function listProducts(slug: string): Promise<ProductNode[]> {
  const data = await getOrganizationsSlugProducts({ slug });
  return data.products as ProductNode[];
}

export async function getProduct(slug: string, productId: string): Promise<Product> {
  const data = await getOrganizationsSlugProductsId({ slug, id: productId });
  return data.product as Product;
}

export async function createProduct(slug: string, payload: ProductInput): Promise<string> {
  const data = await postOrganizationsSlugProducts({
    slug,
    data: normalizeProductPayload(payload) as PostOrganizationsSlugProductsMutationRequest,
  });
  return data.productId;
}

export async function updateProduct(
  slug: string,
  productId: string,
  payload: ProductInput,
): Promise<void> {
  await putOrganizationsSlugProductsId({
    slug,
    id: productId,
    data: normalizeProductPayload(payload) as PutOrganizationsSlugProductsIdMutationRequest,
  });
}

export async function deleteProduct(slug: string, productId: string): Promise<void> {
  await deleteOrganizationsSlugProductsId({ slug, id: productId });
}
