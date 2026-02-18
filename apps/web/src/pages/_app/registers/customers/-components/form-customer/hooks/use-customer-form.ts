import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { customerSchema, type CustomerFormInput, type CustomerFormOutput } from "@/schemas/customer-schema"
import {
  usePostOrganizationsSlugCustomers,
  usePutOrganizationsSlugCustomersCustomerid,
  type GetOrganizationsSlugCustomersCustomerid200,
} from "@/http/generated"
import { useApp } from "@/context/app-context"
import { toast } from "sonner"
import { router } from "@/router"
import { buildCustomerDefaultValues, mapCustomerFormToRequest } from "../-mappers/customer-mapper"

interface UseCustomerFormProps {
  customer?: GetOrganizationsSlugCustomersCustomerid200["customer"]
  type: "CREATE" | "UPDATE"
}

export function useCustomerForm({ customer, type }: UseCustomerFormProps) {

  const { organization } = useApp()

  const { mutateAsync: createCustomer } =
    usePostOrganizationsSlugCustomers()

  const { mutateAsync: updateCustomer } =
    usePutOrganizationsSlugCustomersCustomerid()

  const form = useForm<CustomerFormInput, any, CustomerFormOutput>({
    resolver: zodResolver(customerSchema),
    defaultValues: buildCustomerDefaultValues(customer),
  })

  const personType = form.watch("personType")

  async function onSubmit(data: CustomerFormOutput) {
    try {
      if (type === "CREATE") {
        const response = await createCustomer({
          slug: organization!.slug,
          data: mapCustomerFormToRequest(data),
        })

        toast.success("Cliente cadastrado com sucesso")

        form.reset()

        router.navigate({
          to: "/registers/customers/update",
          search: { customerId: response.customerId },
        })

        return
      }

      await updateCustomer({
        slug: organization!.slug,
        customerId: customer!.id,
        data: mapCustomerFormToRequest(data),
      })

      toast.success("Cliente atualizado com sucesso")
    } catch (err) {
      console.log(err)
      toast.error("Erro ao salvar cliente")
    }
  }

  return {
    form,
    personType,
    onSubmit,
  }
}
