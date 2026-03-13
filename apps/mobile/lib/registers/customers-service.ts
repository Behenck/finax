import { deleteOrganizationsSlugCustomersCustomerid } from "@/http/generated/deleteOrganizationsSlugCustomersCustomerid";
import { getOrganizationsSlugCustomers } from "@/http/generated/getOrganizationsSlugCustomers";
import { getOrganizationsSlugCustomersCustomerid } from "@/http/generated/getOrganizationsSlugCustomersCustomerid";
import {
  postOrganizationsSlugCustomers,
} from "@/http/generated/postOrganizationsSlugCustomers";
import {
  putOrganizationsSlugCustomersCustomerid,
} from "@/http/generated/putOrganizationsSlugCustomersCustomerid";
import type { PostOrganizationsSlugCustomersMutationRequest } from "@/http/generated/models/PostOrganizationsSlugCustomers";
import type { PutOrganizationsSlugCustomersCustomeridMutationRequest } from "@/http/generated/models/PutOrganizationsSlugCustomersCustomerid";
import type { Customer, CustomerInput } from "@/types/registers";
import { numberOrUndefined, undefinedIfEmpty } from "./utils";

function normalizeCustomerPayload(input: CustomerInput): CustomerInput {
  const basePayload: CustomerInput = {
    name: input.name.trim(),
    personType: input.personType,
    documentType: input.documentType,
    documentNumber: input.documentNumber.trim(),
    email: undefinedIfEmpty(input.email),
    phone: undefinedIfEmpty(input.phone),
    responsible: input.responsible ?? null,
  };

  if (input.personType === "PF") {
    basePayload.pf = {
      birthDate: undefinedIfEmpty(input.pf?.birthDate),
      monthlyIncome: numberOrUndefined(input.pf?.monthlyIncome),
      profession: undefinedIfEmpty(input.pf?.profession),
      placeOfBirth: undefinedIfEmpty(input.pf?.placeOfBirth),
      fatherName: undefinedIfEmpty(input.pf?.fatherName),
      motherName: undefinedIfEmpty(input.pf?.motherName),
      naturality: undefinedIfEmpty(input.pf?.naturality),
    };
  }

  if (input.personType === "PJ") {
    basePayload.pj = {
      businessActivity: undefinedIfEmpty(input.pj?.businessActivity),
      municipalRegistration: undefinedIfEmpty(input.pj?.municipalRegistration),
      stateRegistration: undefinedIfEmpty(input.pj?.stateRegistration),
      legalName: undefinedIfEmpty(input.pj?.legalName),
      tradeName: undefinedIfEmpty(input.pj?.tradeName),
      foundationDate: undefinedIfEmpty(input.pj?.foundationDate),
    };
  }

  return basePayload;
}

export async function listCustomers(slug: string): Promise<Customer[]> {
  const data = await getOrganizationsSlugCustomers({ slug });
  return data.customers as Customer[];
}

export async function getCustomer(slug: string, customerId: string): Promise<Customer> {
  const data = await getOrganizationsSlugCustomersCustomerid({ slug, customerId });
  return data.customer as Customer;
}

export async function createCustomer(slug: string, payload: CustomerInput): Promise<string> {
  const data = await postOrganizationsSlugCustomers({
    slug,
    data: normalizeCustomerPayload(payload) as PostOrganizationsSlugCustomersMutationRequest,
  });
  return data.customerId;
}

export async function updateCustomer(
  slug: string,
  customerId: string,
  payload: CustomerInput,
): Promise<void> {
  await putOrganizationsSlugCustomersCustomerid({
    slug,
    customerId,
    data: normalizeCustomerPayload(payload) as PutOrganizationsSlugCustomersCustomeridMutationRequest,
  });
}

export async function deleteCustomer(slug: string, customerId: string): Promise<void> {
  await deleteOrganizationsSlugCustomersCustomerid({ slug, customerId });
}
