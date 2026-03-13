import { deleteOrganizationsSlugPartnersPartnerid } from "@/http/generated/deleteOrganizationsSlugPartnersPartnerid";
import { getOrganizationsSlugPartners } from "@/http/generated/getOrganizationsSlugPartners";
import { getOrganizationsSlugPartnersPartnerid } from "@/http/generated/getOrganizationsSlugPartnersPartnerid";
import { postOrganizationsSlugPartners } from "@/http/generated/postOrganizationsSlugPartners";
import { putOrganizationsSlugPartnersPartnerid } from "@/http/generated/putOrganizationsSlugPartnersPartnerid";
import type { PostOrganizationsSlugPartnersMutationRequest } from "@/http/generated/models/PostOrganizationsSlugPartners";
import type { PutOrganizationsSlugPartnersPartneridMutationRequest } from "@/http/generated/models/PutOrganizationsSlugPartnersPartnerid";
import type { Partner, PartnerInput } from "@/types/registers";
import { undefinedIfEmpty } from "./utils";

function normalizePartnerPayload(input: PartnerInput): PartnerInput {
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
    supervisorId: undefinedIfEmpty(input.supervisorId),
  };
}

export async function listPartners(slug: string): Promise<Partner[]> {
  const data = await getOrganizationsSlugPartners({ slug });
  return data.partners as Partner[];
}

export async function getPartner(slug: string, partnerId: string): Promise<Partner> {
  const data = await getOrganizationsSlugPartnersPartnerid({ slug, partnerId });
  return data.partner as Partner;
}

export async function createPartner(slug: string, payload: PartnerInput): Promise<string> {
  const data = await postOrganizationsSlugPartners({
    slug,
    data: normalizePartnerPayload(payload) as PostOrganizationsSlugPartnersMutationRequest,
  });
  return data.partnerId;
}

export async function updatePartner(
  slug: string,
  partnerId: string,
  payload: PartnerInput,
): Promise<void> {
  await putOrganizationsSlugPartnersPartnerid({
    slug,
    partnerId,
    data: normalizePartnerPayload(payload) as PutOrganizationsSlugPartnersPartneridMutationRequest,
  });
}

export async function deletePartner(slug: string, partnerId: string): Promise<void> {
  await deleteOrganizationsSlugPartnersPartnerid({ slug, partnerId });
}
