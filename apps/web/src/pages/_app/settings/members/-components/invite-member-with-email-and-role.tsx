import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useApp } from '@/context/app-context';
import { getOrganizationsSlugInvitesQueryKey, getOrganizationsSlugMembersRolePathParamsRoleEnum, usePostOrganizationsSlugInvites } from '@/http/generated';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import z from 'zod';

const InviteMemberSchema = z
  .object({
    email: z.email({ error: "Email inválido!" }),
    role: z.enum(getOrganizationsSlugMembersRolePathParamsRoleEnum).default("MEMBER"),
  })
  .required();

export type InviteMemberType = z.infer<typeof InviteMemberSchema>;

export function InviteMemberWithEmailAndRole() {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { organization } = useApp()
  const queryClient = useQueryClient()
  const { mutateAsync: sendInvite } = usePostOrganizationsSlugInvites()

  const {
    handleSubmit,
    reset,
    control,
  } = useForm<InviteMemberType>({
    resolver: zodResolver(InviteMemberSchema),
    defaultValues: { email: "", role: "MEMBER" },
  });

  const onSubmit = async (data: InviteMemberType) => {
    if (!organization) return

    setIsLoading(true);

    try {
      await sendInvite({
        slug: organization.slug,
        data
      })

      await queryClient.invalidateQueries({
        queryKey: getOrganizationsSlugInvitesQueryKey({
          slug: organization.slug,
        }),
      })

      reset({ email: "", role: data.role });

      toast.success("Convite enviado com sucesso!")
    } catch (error) {
      toast.error((error as any).response.data.message)
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className='w-full space-y-2'>
      <div className='grid gap-2 sm:grid-cols-[minmax(0,1fr)_180px]'>
        <FieldGroup>
          <Controller
            name="email"
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel>Email</FieldLabel>
                <Input
                  {...field}
                  id="email"
                  aria-invalid={fieldState.invalid}
                  placeholder="joao.silva@dominio.com"
                  autoComplete="off"
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
        </FieldGroup>
        <FieldGroup>
          <Controller
            name="role"
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel>Permissão</FieldLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="ADMIN">Admin</SelectItem>
                      <SelectItem value="MEMBER">Membro</SelectItem>
                      <SelectItem value="SUPERVISOR">Supervisor</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
        </FieldGroup>
      </div>

      <Button type='submit' className='w-full'>
        {isLoading ? "Enviando convite..." : "Enviar convite"}
      </Button>

      <p className='text-xs text-muted-foreground'>
        Após o membro aceitar o convite, você pode definir o acesso por empresa e unidade na lista de membros.
      </p>
    </form>
  )
}
