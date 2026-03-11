import { Button } from "@/components/ui/button";
import { useApp } from "@/context/app-context";
import { api, isAxiosError } from "@/lib/axios";
import { LinkIcon } from "lucide-react";
import { toast } from "sonner";

export function InviteMemberLink() {
  const { organization } = useApp()

  async function handleCreateInviteLink() {
    if (!organization?.slug) {
      toast.error("Organização não encontrada.")
      return
    }

    try {
      const { data } = await api.post(`/organizations/${organization.slug}/invites/link`)

      if (data.url) {
        await navigator.clipboard.writeText(data.url);

        toast.success("Link copiado para a área de transferência!")
      }
    } catch (error: unknown) {
      if (isAxiosError(error)) {
        toast.error(error.response?.data?.message ?? "Erro ao gerar link de convite.")
        return
      }

      toast.error("Erro ao gerar link de convite.")
    }
  }

  return (
    <div className='flex flex-col gap-2'>
      <div>
        <h2>Convidar membro</h2>
        <p className='text-sm text-muted-foreground'>convidar membro via link</p>
      </div>
      <Button variant="outline" size="sm" onClick={handleCreateInviteLink}>
        <LinkIcon />
        Convidar via link
      </Button>
    </div>
  )
}
