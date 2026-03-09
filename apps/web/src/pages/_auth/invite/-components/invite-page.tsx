import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getInvitesInviteid } from '@/http/generated';
import { router } from '@/router';
import { Mail } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface InvitePageProps {
  inviteId?: string
}

export function InvitePage({ inviteId }: InvitePageProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [inviteCode, setInviteCode] = useState(inviteId ?? "");

  async function validateInvite(code: string) {
    const token = code.trim();

    if (!token) {
      toast.error("Informe o token do convite.");
      return;
    }

    try {
      setIsLoading(true);

      const invite = await getInvitesInviteid({ inviteId: token });

      if (!invite) {
        toast.error("Convite inválido ou expirado!");
        return;
      }

      router.navigate({ to: `/invite/${token}/accept`, replace: true })
    } catch {
      toast.error("Convite inválido ou expirado!");
    } finally {
      setIsLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    validateInvite(inviteCode);
  }

  useEffect(() => {
    if (inviteId) validateInvite(inviteId);
  }, [inviteId]);

  return (
    <div className="space-y-14 w-full max-w-md">
      <div className='space-y-4'>
        <div className="mx-auto bg-green-600 w-12 h-12 rounded-full flex items-center justify-center">
          <Mail className="text-white" />
        </div>

        <div className="text-center">
          <h1 className="text-3xl font-bold">Validar Convite</h1>
          <span className="text-gray-400 text-sm">
            Digite o token de convite que você recebeu
          </span>
        </div>
      </div>

      <form
        className="space-y-3 mt-8"
        onSubmit={handleSubmit}
      >
        <div className="space-y-2 w-full">
          <Label>Token de Convite</Label>
          <Input
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            placeholder="abc123xyz..."
            disabled={isLoading}
          />
        </div>

        <Button
          className="w-full"
          type="submit"
          disabled={isLoading}
        >
          {isLoading ? "Validando..." : "Validar Convite"}
        </Button>
      </form>
    </div>
  )
}
