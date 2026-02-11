import { Button } from '@/components/ui/button'
import type { Invite } from '@/schemas/types/invite'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft, Building2, CheckCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ValidatingInvite } from '../-components/validating-invite'
import { toast } from 'sonner'
import { getInvite } from '@/http/invites/get-invite'
import { router } from '@/router'
import { useSession } from '@/hooks/auth/use-session'
import { CreateMemberForm, CreateMemberSchema, type CreateMemberType } from '../-components/create-member-form'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { acceptInvite } from '@/http/invites/accept-invite'

export const Route = createFileRoute('/_auth/invite/$inviteId/accept')({
  component: AcceptInvite,
})

function AcceptInvite() {
  const { inviteId } = Route.useParams()
  const [isLoading, setIsLoading] = useState(true);
  const [invite, setInvite] = useState<Invite | null>(null);
  const { data } = useSession()
  const org = "behenck"

  const userInvitedInOrganization =
    invite?.organization.slug === org && !!data

  const userInvitedIsAuthenticated =
    invite?.email === data?.email

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

  const form = useForm<CreateMemberType>({
    resolver: zodResolver(CreateMemberSchema),
    shouldUnregister: true,
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const { handleSubmit, control, setValue } = form

  async function onSubmit(data: CreateMemberType) {
    try {
      const { confirmPassword, firstName, lastName, ...result } = data
      const payload = {
        name: `${firstName} ${lastName}`,
        ...result
      }

      await acceptInvite({
        inviteId: invite!.id,
        data: payload
      })

      toast.success("Convite aceito com sucesso!")
      router.navigate({ to: `/sign-in?email=${payload.email}` })

    } catch (err: any) {
      toast.error("Erro ao aceitar convite.")
    }
  }

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
                Convidado por: {invite.author?.name}
              </span>
              <span className="text-sm text-green-400 font-medium">
                {userInvitedInOrganization ? (
                  <span>Você já faz parte dessa organização!</span>
                ) : (
                  <span>Bem-vindo(a) Clique em aceitar para acessar a
                    rede.</span>
                )}
              </span>
            </div>
          </div>

          {userInvitedInOrganization ? (
            <div>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                asChild
              >
                <Link to='/'>
                  <ArrowLeft />
                  Voltar
                </Link>
              </Button>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit(onSubmit)}
              noValidate
              className="space-y-3"
            >
              {!userInvitedIsAuthenticated && (
                <>
                  <CreateMemberForm invite={invite} control={control} setValue={setValue} />
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
          )}
        </div >
      ) : (
        <ValidatingInvite />
      )
      }
    </>
  )
}
