import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { Invite } from "@/schemas/types/invite";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import z from "zod";

const CreateMemberSchema = z
  .object({
    name: z.string().min(3, { error: "Mínimo 3 caracteres!" }).optional(),
    lastName: z.string().min(3, { error: "Mínimo 3 caracteres!" }).optional(),
    email: z
      .email()
      .optional(),
    password: z
      .string()
      .min(6, { error: "A senha deve ter no mínimo 6 caracteres!" }).optional(),
    confirmPassword: z
      .string()
      .min(6, { error: "A confirmação de senha deve ter no mínimo 6 caracteres." }).optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "As senhas não conferem.",
  });

export type CreateMemberType = z.infer<typeof CreateMemberSchema>;

interface CreateMemberFormProps {
  invite: Invite
}

export function CreateMemberForm({ invite }: CreateMemberFormProps) {
  const {
    handleSubmit,
    resetField,
    control,
    watch,
    setValue,
    unregister,
  } = useForm<CreateMemberType>({
    resolver: zodResolver(CreateMemberSchema),
    defaultValues: {
      name: "",
      lastName: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const name = watch("name")
  const shouldAskEmail = invite?.type === "LINK";

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <FieldGroup>
          <Controller
            name="name"
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid} className="gap-1">
                <FieldLabel>Nome</FieldLabel>
                <Input
                  {...field}
                  id="name"
                  aria-invalid={fieldState.invalid}
                  placeholder="Seu nome"
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
            name="lastName"
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid} className="gap-1">
                <FieldLabel>Sobrenome</FieldLabel>
                <Input
                  {...field}
                  id="lastName"
                  aria-invalid={fieldState.invalid}
                  placeholder="Seu sobrenome"
                  autoComplete="off"
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
        </FieldGroup>
      </div>
      {shouldAskEmail && (
        <FieldGroup>
          <Controller
            name="email"
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid} className="gap-1">
                <FieldLabel>Email</FieldLabel>
                <Input
                  {...field}
                  id="email"
                  aria-invalid={fieldState.invalid}
                  placeholder="joao.silva@dominio.com"
                  autoComplete="off"
                />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
        </FieldGroup>
      )}
      <FieldGroup>
        <Controller
          name="password"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid} className="gap-1">
              <FieldLabel>Senha</FieldLabel>
              <Input
                {...field}
                id="password"
                aria-invalid={fieldState.invalid}
                placeholder="Mínimo 6 caracteres"
                type="password"
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
          name="confirmPassword"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid} className="gap-1">
              <FieldLabel>Confirmar Senha</FieldLabel>
              <Input
                {...field}
                id="confirmPassword"
                aria-invalid={fieldState.invalid}
                placeholder="Confirme sua senha"
                type="password"
                autoComplete="off"
              />
              {fieldState.invalid && (
                <FieldError errors={[fieldState.error]} />
              )}
            </Field>
          )}
        />
      </FieldGroup>
    </div>
  )
}