import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useApp } from "@/context/app-context";
import { getOrganizationsSlugCustomersQueryKey, useDeleteOrganizationsSlugCustomersCustomerid, type GetOrganizationsSlugCustomers200 } from "@/http/generated";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

interface DeleteCustomerProps {
  customer: GetOrganizationsSlugCustomers200["customers"][number]
}

export function DeleteCustomer({ customer }: DeleteCustomerProps) {
  const queryClient = useQueryClient()
  const { organization } = useApp()
  const { mutateAsync: deleteCustomer } = useDeleteOrganizationsSlugCustomersCustomerid()

  async function handleDeleteCustomer() {
    try {
      await deleteCustomer({ slug: organization!.slug, customerId: customer.id },
        {
          onSuccess: async () => {
            await queryClient.invalidateQueries({
              queryKey: getOrganizationsSlugCustomersQueryKey({
                slug: organization!.slug,
              }),
            })
          },
        }
      )

      toast.success(`Cliente ${customer.name} excluído com sucesso!`)
    } catch (err) {
      toast.error("Ocorreu um erro ao deletar esse cliente")
    }
  }

  return (
    <DropdownMenuItem className='flex gap-4 items-center cursor-pointer' onClick={handleDeleteCustomer}>
      <Trash2 className='size-3.5 text-foreground' />
      <span className='font-light text-sm'>Excluir</span>
    </DropdownMenuItem>
  )
}