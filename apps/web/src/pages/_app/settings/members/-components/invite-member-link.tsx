import { Button } from "@/components/ui/button";
import api from "@/lib/axios";
import { LinkIcon } from "lucide-react";
import { toast } from "sonner";

export function InviteMemberLink() {
  async function handleCreateInviteLink() {
    try {
      const organizationSlug = "behenck"
      const { data } = await api.post(`/organizations/${organizationSlug}/invites/link`)

      if (data.url) {
        await navigator.clipboard.writeText(data.url);

        toast.success("Link copiado para a área de transferência!")
      }
    } catch (error) {
      toast.error((error as any).response.data.message)
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