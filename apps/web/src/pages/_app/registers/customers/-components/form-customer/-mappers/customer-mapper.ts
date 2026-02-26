import type { CustomerFormData, CustomerFormInput } from "@/schemas/customer-schema"
import type { GetOrganizationsSlugCustomersCustomerid200, PostOrganizationsSlugCustomersMutationRequest } from "@/http/generated"

type CustomerResponsible =
  | {
      type: "SELLER" | "PARTNER"
      id: string
      name: string
    }
  | null

type CustomerWithResponsible = GetOrganizationsSlugCustomersCustomerid200["customer"] & {
  responsible?: CustomerResponsible
}

type CustomerMutationRequestWithResponsible =
  PostOrganizationsSlugCustomersMutationRequest & {
    responsible?: {
      type: "SELLER" | "PARTNER"
      id: string
    } | null
  }

function mapResponsible(data: CustomerFormData) {
  if (!data.responsibleType || !data.responsibleId) {
    return null
  }

  return {
    type: data.responsibleType,
    id: data.responsibleId,
  } as const
}

export function mapCustomerFormToRequest(
  data: CustomerFormData
): CustomerMutationRequestWithResponsible {

  if (data.personType === "PF") {
    return {
      name: data.name,
      personType: "PF",
      documentType: data.documentType,
      documentNumber: data.documentNumber,
      email: data.email,
      phone: data.phone,
      responsible: mapResponsible(data),

      pf: {
        birthDate: data.birthDate,
        monthlyIncome: data.monthlyIncome,
        profession: data.profession,
        placeOfBirth: data.naturality,
        fatherName: data.fatherName,
        motherName: data.motherName,
        naturality: data.naturality,
      },
    }
  }

  // PJ
  return {
    name: data.name,
    personType: "PJ",
    documentType: data.documentType,
    documentNumber: data.documentNumber,
    email: data.email,
    phone: data.phone,
    responsible: mapResponsible(data),

    pj: {
      businessActivity: data.businessActivity,
      municipalRegistration: data.municipalRegistration,
      stateRegistration: data.stateRegistration,
      legalName: data.legalName,
      tradeName: data.tradeName,
      foundationDate: data.foundationDate,
    },
  }
}

export function buildCustomerDefaultValues(
  customer?: CustomerWithResponsible
): CustomerFormInput {

  if (customer?.personType === "PJ") {
    return {
      personType: "PJ",
      documentType:
        (customer.documentType as "CNPJ" | "IE" | "OTHER") ?? "CNPJ",
      documentNumber: customer.documentNumber ?? "",
      name: customer.name ?? "",
      email: customer.email ?? "",
      phone: customer.phone ?? "",
      tradeName: customer.pj?.tradeName ?? "",
      legalName: customer.pj?.legalName ?? "",
      stateRegistration: customer.pj?.stateRegistration ?? "",
      municipalRegistration: customer.pj?.municipalRegistration ?? "",
      foundationDate: customer.pj?.foundationDate
        ? new Date(customer.pj.foundationDate)
        : undefined,
      businessActivity: customer.pj?.businessActivity ?? "",
      responsibleType: customer.responsible?.type,
      responsibleId: customer.responsible?.id,
    }
  }

  return {
    personType: "PF",
    documentType:
      (customer?.documentType as "CPF" | "RG" | "PASSPORT" | "OTHER") ?? "CPF",
    documentNumber: customer?.documentNumber ?? "",
    name: customer?.name ?? "",
    email: customer?.email ?? "",
    phone: customer?.phone ?? "",
    birthDate: customer?.pf?.birthDate
      ? new Date(customer.pf.birthDate)
      : undefined,
    naturality: customer?.pf?.naturality ?? "",
    motherName: customer?.pf?.motherName ?? "",
    fatherName: customer?.pf?.fatherName ?? "",
    profession: customer?.pf?.profession ?? "",
    monthlyIncome: customer?.pf?.monthlyIncome ?? 0,
    responsibleType: customer?.responsible?.type,
    responsibleId: customer?.responsible?.id,
  }
}
