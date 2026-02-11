import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useSession } from '@/hooks/auth/use-session';
import api from '@/lib/axios';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import z from 'zod';

const InviteMemberSchema = z
  .object({
    email: z.email({ error: "Email inválido!" }),
    role: z.string().default("MEMBER"),
  })
  .required();

export type InviteMemberType = z.infer<typeof InviteMemberSchema>;

export function InviteMemberWithEmailAndRole() {
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const { data: session } = useSession()

  const {
    handleSubmit,
    reset,
    control,
  } = useForm<InviteMemberType>({
    resolver: zodResolver(InviteMemberSchema),
    defaultValues: { email: "", role: "MEMBER" },
  });

  const onsSubmit = async (data: InviteMemberType) => {
    setIsLoading(true);

    try {
      const organizationSlug = session?.organization.slug
      await api.post(`/organizations/${organizationSlug}/invites`, data)
      setIsLoading(false);
      reset({ email: "", role: data.role });

      toast.success("Convite enviado com sucesso!")
    } catch (error) {
      setIsLoading(false);
      toast.error((error as any).response.data.message)
    }
  };

  return (
    <form onSubmit={handleSubmit(onsSubmit)} noValidate className='space-y-2 w-md'>
      <div className='flex items-center gap-2'>
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
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="ADMIN">Admin</SelectItem>
                      <SelectItem value="MEMBER">Membro</SelectItem>
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
    </form>
  )
}