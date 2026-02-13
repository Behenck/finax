import type { CustomerFormData } from "@/schemas/customer-schema"
import type { PostOrganizationsSlugCustomersMutationRequest } from "@/http/generated"

export function mapCustomerFormToRequest(
  data: CustomerFormData
): PostOrganizationsSlugCustomersMutationRequest {

  if (data.personType === "PF") {
    return {
      name: data.name,
      personType: "PF",
      documentType: data.documentType,
      documentNumber: data.documentNumber,
      email: data.email,
      phone: data.phone,

      pf: {
        birthDate: data.birthDate,
        monthlyIncome: data.monthlyIncome,
        profession: data.profession,
        placeOfBirth: data.naturality,
        fatherName: data.fatherName,
        motherName: data.motherName,
      },
    }
  }

  // PJ
  return {
    name: data.corporateName, // 👈 API SEMPRE exige name
    personType: "PJ",
    documentType: data.documentType,
    documentNumber: data.documentNumber,
    email: data.email,
    phone: data.phone,

    pj: {
      businessActivity: data.businessActivity,
      municipalRegistration: data.municipalRegistration,
      stateRegistration: data.stateRegistration,
      legalName: data.corporateReason,
      tradeName: data.fantasyName,
      foundationDate: data.foundationDate,
    },
  }
}
