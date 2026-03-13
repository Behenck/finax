import { deleteOrganizationsSlugSellersSellerid } from "@/http/generated/deleteOrganizationsSlugSellersSellerid";
import { getOrganizationsSlugSellers } from "@/http/generated/getOrganizationsSlugSellers";
import { getOrganizationsSlugSellersSellerid } from "@/http/generated/getOrganizationsSlugSellersSellerid";
import { postOrganizationsSlugSellers } from "@/http/generated/postOrganizationsSlugSellers";
import { putOrganizationsSlugSellersSellerid } from "@/http/generated/putOrganizationsSlugSellersSellerid";
import type { PostOrganizationsSlugSellersMutationRequest } from "@/http/generated/models/PostOrganizationsSlugSellers";
import type { PutOrganizationsSlugSellersSelleridMutationRequest } from "@/http/generated/models/PutOrganizationsSlugSellersSellerid";
import type { Seller, SellerInput } from "@/types/registers";
import { undefinedIfEmpty } from "./utils";

function normalizeSellerPayload(input: SellerInput): SellerInput {
  return {
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    phone: input.phone.trim(),
    companyName: input.companyName.trim(),
    documentType: input.documentType,
    document: input.document.trim(),
    country: input.country.trim(),
    state: input.state.trim(),
    city: undefinedIfEmpty(input.city),
    street: undefinedIfEmpty(input.street),
    zipCode: undefinedIfEmpty(input.zipCode),
    neighborhood: undefinedIfEmpty(input.neighborhood),
    number: undefinedIfEmpty(input.number),
    complement: undefinedIfEmpty(input.complement),
    status: input.status,
  };
}

export async function listSellers(slug: string): Promise<Seller[]> {
  const data = await getOrganizationsSlugSellers({ slug });
  return data.sellers as Seller[];
}

export async function getSeller(slug: string, sellerId: string): Promise<Seller> {
  const data = await getOrganizationsSlugSellersSellerid({ slug, sellerId });
  return data.seller as Seller;
}

export async function createSeller(slug: string, payload: SellerInput): Promise<string> {
  const data = await postOrganizationsSlugSellers({
    slug,
    data: normalizeSellerPayload(payload) as PostOrganizationsSlugSellersMutationRequest,
  });
  return data.sellerId;
}

export async function updateSeller(
  slug: string,
  sellerId: string,
  payload: SellerInput,
): Promise<void> {
  await putOrganizationsSlugSellersSellerid({
    slug,
    sellerId,
    data: normalizeSellerPayload(payload) as PutOrganizationsSlugSellersSelleridMutationRequest,
  });
}

export async function deleteSeller(slug: string, sellerId: string): Promise<void> {
  await deleteOrganizationsSlugSellersSellerid({ slug, sellerId });
}
