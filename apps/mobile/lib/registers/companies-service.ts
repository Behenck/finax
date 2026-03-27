import { deleteOrganizationsSlugCompaniesCompanyid } from "@/http/generated/deleteOrganizationsSlugCompaniesCompanyid";
import { deleteOrganizationsSlugCompaniesCompanyidUnitsUnitid } from "@/http/generated/deleteOrganizationsSlugCompaniesCompanyidUnitsUnitid";
import { getOrganizationsSlugCompanies } from "@/http/generated/getOrganizationsSlugCompanies";
import { getOrganizationsSlugCompaniesCompanyidUnits } from "@/http/generated/getOrganizationsSlugCompaniesCompanyidUnits";
import { postOrganizationsSlugCompanies } from "@/http/generated/postOrganizationsSlugCompanies";
import { postOrganizationsSlugCompaniesCompanyidUnits } from "@/http/generated/postOrganizationsSlugCompaniesCompanyidUnits";
import { putOrganizationsSlugCompaniesCompanyid } from "@/http/generated/putOrganizationsSlugCompaniesCompanyid";
import { putOrganizationsSlugCompaniesCompanyidUnitsUnitid } from "@/http/generated/putOrganizationsSlugCompaniesCompanyidUnitsUnitid";
import type { PostOrganizationsSlugCompaniesMutationRequest } from "@/http/generated/models/PostOrganizationsSlugCompanies";
import type { PostOrganizationsSlugCompaniesCompanyidUnitsMutationRequest } from "@/http/generated/models/PostOrganizationsSlugCompaniesCompanyidUnits";
import type { PutOrganizationsSlugCompaniesCompanyidMutationRequest } from "@/http/generated/models/PutOrganizationsSlugCompaniesCompanyid";
import type { PutOrganizationsSlugCompaniesCompanyidUnitsUnitidMutationRequest } from "@/http/generated/models/PutOrganizationsSlugCompaniesCompanyidUnitsUnitid";
import type { Company, Unit, UnitInput } from "@/types/registers";
import { undefinedIfEmpty } from "./utils";

export async function listCompanies(slug: string): Promise<Company[]> {
  const data = await getOrganizationsSlugCompanies({ slug });
  return data.companies as Company[];
}

export async function createCompany(slug: string, name: string): Promise<string> {
  const data = await postOrganizationsSlugCompanies({
    slug,
    data: {
      name: name.trim(),
    } as PostOrganizationsSlugCompaniesMutationRequest,
  });
  return data.companyId;
}

function normalizeUnitPayload(input: UnitInput): UnitInput {
  return {
    name: input.name.trim(),
    country: undefinedIfEmpty(input.country),
    state: undefinedIfEmpty(input.state),
    city: undefinedIfEmpty(input.city),
    street: undefinedIfEmpty(input.street),
    zipCode: undefinedIfEmpty(input.zipCode),
    neighborhood: undefinedIfEmpty(input.neighborhood),
    number: undefinedIfEmpty(input.number),
    complement: undefinedIfEmpty(input.complement),
  };
}

export async function updateCompany(slug: string, companyId: string, name: string): Promise<void> {
  await putOrganizationsSlugCompaniesCompanyid({
    slug,
    companyId,
    data: {
      name: name.trim(),
    } as PutOrganizationsSlugCompaniesCompanyidMutationRequest,
  });
}

export async function deleteCompany(slug: string, companyId: string): Promise<void> {
  await deleteOrganizationsSlugCompaniesCompanyid({ slug, companyId });
}

export async function listUnits(slug: string, companyId: string): Promise<Unit[]> {
  const data = await getOrganizationsSlugCompaniesCompanyidUnits({ slug, companyId });
  return data.units as Unit[];
}

export async function createUnit(
  slug: string,
  companyId: string,
  payload: UnitInput,
): Promise<string> {
  const data = await postOrganizationsSlugCompaniesCompanyidUnits({
    slug,
    companyId,
    data: normalizeUnitPayload(payload) as PostOrganizationsSlugCompaniesCompanyidUnitsMutationRequest,
  });
  return data.unitId;
}

export async function updateUnit(
  slug: string,
  companyId: string,
  unitId: string,
  payload: UnitInput,
): Promise<void> {
  await putOrganizationsSlugCompaniesCompanyidUnitsUnitid({
    slug,
    companyId,
    unitId,
    data: normalizeUnitPayload(payload) as PutOrganizationsSlugCompaniesCompanyidUnitsUnitidMutationRequest,
  });
}

export async function deleteUnit(slug: string, companyId: string, unitId: string): Promise<void> {
  await deleteOrganizationsSlugCompaniesCompanyidUnitsUnitid({
    slug,
    companyId,
    unitId,
  });
}
