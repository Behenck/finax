import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import type { Invite } from '@/schemas/types/invite'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft, Building2, CheckCheck, Loader2, Mail, UserPlus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { ValidatingInvite } from '../-components/validating-invite'
import { toast } from 'sonner'
import { getInvite } from '@/http/invites/get-invite'
import { router } from '@/router'
import { useSession } from '@/hooks/auth/use-session'
import { CreateMemberForm } from '../-components/create-member-form'

export const Route = createFileRoute('/_auth/invite/$inviteId/accept')({
  component: AcceptInvite,
})

function AcceptInvite() {
  const { inviteId } = Route.useParams()
  const [isLoading, setIsLoading] = useState(true);
  const [invite, setInvite] = useState<Invite | null>(null);
  const { data } = useSession()
  const userInvitedIsAuthenticated = invite?.email === data?.email || invite?.organization.slug === "behenck"

  async function validateInvite(code: string) {
    const token = code.trim();

    if (!token) {
      toast.error("Informe o token do convite.");
      return;
    }

    try {
      setIsLoading(true);
      const invite = await getInvite(code);
      setInvite(invite)
    } catch {
      toast.error("Convite inválido ou expirado!");
      router.navigate({ to: `/invite/${token}`, replace: true })
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (inviteId) validateInvite(inviteId);
  }, [inviteId]);

  return (
    <>
      {!isLoading && invite ? (
        <div className="space-y-6 w-full max-w-md">
          <div className="mx-auto bg-green-600 w-12 h-12 rounded-full flex items-center justify-center">
            <CheckCheck className="text-white" />
          </div>

          <div className="text-center">
            <h1 className="text-3xl font-bold">Convite Válido!</h1>
            <span className="text-muted-foreground text-sm">
              Você foi convidado para se juntar à rede
            </span>
          </div>

          <div className="flex gap-4 items-center bg-muted p-4 rounded-lg">
            <Building2 className="w-10 h-10" />
            <div className="flex flex-col">
              <p className="font-medium">{invite.organization.name}</p>
              <span className="text-sm text-gray-400">
                Convidado por: {invite.author.name}
              </span>
              <span className="text-sm text-green-400 font-medium">
                {/* Bem-vindo(a) ! Defina sua senha para acessar a
                rede. */}
                Bem-vindo(a) Clique em aceitar para acessar a
                rede.
              </span>
            </div>
          </div>

          <form
            // onSubmit={handleSubmit(onsSubmit)}
            noValidate
            className="space-y-3"
          >
            {!userInvitedIsAuthenticated && (
              <>
                <CreateMemberForm invite={invite} />
              </>
            )}
            <div className="space-y-2">
              <Button
                type="submit"
                className="w-full"
              >
                Aceitar Convite
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                asChild
              >
                <Link to='/invite'>
                  <ArrowLeft />
                  Voltar
                </Link>
              </Button>
            </div>
          </form>
        </div>
      ) : (
        <ValidatingInvite />
      )}
    </>
  )
}
