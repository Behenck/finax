import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useApp } from "@/context/app-context";
import {
  getOrganizationsSlugPartnersQueryKey,
  type GetOrganizationsSlugPartners200,
  useDeleteOrganizationsSlugPartnersPartnerid,
} from "@/http/generated";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface DeletePartnerProps {
  partner: GetOrganizationsSlugPartners200["partners"][number]
}

export function DeletePartner({ partner }: DeletePartnerProps) {
  const queryClient = useQueryClient()
  const { organization } = useApp()
  const [open, setOpen] = useState(false)
  const { mutateAsync: deletePartner, isPending } = useDeleteOrganizationsSlugPartnersPartnerid()

  async function handleDeletePartner() {
    if (!organization) return

    try {
      await deletePartner(
        { slug: organization.slug, partnerId: partner.id },
        {
          onSuccess: async () => {
            await queryClient.invalidateQueries({
              queryKey: getOrganizationsSlugPartnersQueryKey({ slug: organization.slug }),
            })
          },
        },
      )

      toast.success(`Parceiro ${partner.name} excluído com sucesso!`)
      setOpen(false)
    } catch (error) {
      toast.error("Ocorreu um erro ao excluir este parceiro")
    }
  }

  return (
    <>
      <DropdownMenuItem
        className='flex gap-4 items-center cursor-pointer text-red-500 focus:text-red-500'
        onSelect={(event) => {
          event.preventDefault()
          setOpen(true)
        }}
        disabled={isPending}
      >
        <Trash2 className='size-3.5 text-red-500' />
        <span className='text-sm'>Excluir</span>
      </DropdownMenuItem>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o parceiro <strong>{partner.name}</strong>?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => void handleDeletePartner()} disabled={isPending}>
              {isPending ? "Excluindo..." : "Confirmar exclusão"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
