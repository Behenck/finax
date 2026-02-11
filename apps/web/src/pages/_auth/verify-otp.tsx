import { createFileRoute, Link, Navigate } from '@tanstack/react-router'
import { Button } from "@/components/ui/button";
import { ArrowLeft, MailWarning } from "lucide-react";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp"
import z from "zod";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { api } from "@/lib/axios";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { toast } from "sonner";
import { router } from '@/router';
import { verifyOTP } from '@/http/auth/verify-otp';
import Cookies from 'js-cookie';
import { useQueryClient } from '@tanstack/react-query';
import { auth } from '@/hooks/auth';

const VerifySchema = z.object({
  code: z.string().regex(/^\d{6}$/, "Informe os 6 dígitos."),
});

type VerifyForm = z.infer<typeof VerifySchema>;

const verifyOTPSearchSchema = z.object({
  email: z.string().optional(),
});

export const Route = createFileRoute('/_auth/verify-otp')({
  validateSearch: (search) => verifyOTPSearchSchema.parse(search),
  component: VerifyOTP,
})

function VerifyOTP() {
  const { email } = Route.useSearch();

  const { data: session, isPending: isSessionPending } = auth.useSession();
  const signInMutation = auth.useSignInOTP();

  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<VerifyForm>({
    resolver: zodResolver(VerifySchema),
    defaultValues: { code: "" },
  });

  async function onSubmit({ code }: VerifyForm) {
    if (!email) return;

    try {
      await signInMutation.mutateAsync({ email, code });

      toast.success("Verificação feita com sucesso!")
    } catch (error) {
      toast.error(
        (error as any)?.response?.data?.message ??
        "Erro ao entrar. Tente novamente.",
      );
    }
  }

  if (!isSessionPending && session) {
    return <Navigate to="/" replace />;
  }

  if (!email) {
    return <Navigate to="/sign-in" replace />;
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-4 w-full max-w-md"
    >
      <div className="mx-auto bg-green-600 w-12 h-12 rounded-full flex items-center justify-center">
        <MailWarning className="text-white" />
      </div>

      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Verifique seu email</h1>
        <div className="flex flex-col">
          <span className="text-muted-foreground text-sm">
            Enviamos um código de 6 dígitos para
          </span>
          <span className="text-sm font-bold">{email}</span>
        </div>
      </div>

      <div className="space-y-3 mt-8">
        <div className="flex flex-col gap-2">
          <FieldGroup>
            <Controller
              control={control}
              name="code"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel>Código de verificação</FieldLabel>
                  <InputOTP
                    {...field}
                    maxLength={6}
                    value={field.value}
                    onChange={field.onChange}
                  >
                    <InputOTPGroup className="gap-3">
                      <InputOTPSlot
                        index={0}
                        className="w-14 h-14 text-xl border rounded-md"
                        aria-invalid={fieldState.invalid}
                      />
                      <InputOTPSlot
                        index={1}
                        className="w-14 h-14 text-xl border rounded-md"
                        aria-invalid={fieldState.invalid}
                      />
                      <InputOTPSlot
                        index={2}
                        className="w-14 h-14 text-xl border rounded-md"
                        aria-invalid={fieldState.invalid}
                      />
                    </InputOTPGroup>

                    <InputOTPSeparator />

                    <InputOTPGroup className="gap-3">
                      <InputOTPSlot
                        index={3}
                        className="w-14 h-14 text-xl border rounded-md"
                        aria-invalid={fieldState.invalid}
                      />
                      <InputOTPSlot
                        index={4}
                        className="w-14 h-14 text-xl border rounded-md"
                        aria-invalid={fieldState.invalid}
                      />
                      <InputOTPSlot
                        index={5}
                        className="w-14 h-14 text-xl border rounded-md"
                        aria-invalid={fieldState.invalid}
                      />
                    </InputOTPGroup>
                  </InputOTP>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
          </FieldGroup>
        </div>

        <div className="space-y-2">
          <Button
            type="submit"
            disabled={isSubmitting || !email}
            className="w-full"
          >
            Verificar código
          </Button>

          <Button variant="outline" className="w-full cursor-pointer" asChild>
            <Link to="/">
              <ArrowLeft />
              Voltar
            </Link>
          </Button>
        </div>
      </div>
    </form>
  )
}
