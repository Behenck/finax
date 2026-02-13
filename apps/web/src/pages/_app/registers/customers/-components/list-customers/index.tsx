import { useApp } from "@/context/app-context";
import { CustomerRow } from "./customer-row";
import { useGetOrganizationsSlugCustomers } from "@/http/generated";

export function ListCustomers() {
  const { organization } = useApp()

  if (!organization) {
    return null
  }

  const { data, isLoading } = useGetOrganizationsSlugCustomers({
    slug: organization!.slug
  })

  if (isLoading) {
    return <span>Carregando...</span>
  }

  return (
    <>
      {
        data?.customers.map((customer) => {
          return (
            <CustomerRow key={customer.id} customer={customer} />
          )
        })
      }
    </>
  )
}