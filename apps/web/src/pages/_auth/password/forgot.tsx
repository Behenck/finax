import { createFileRoute, Link } from '@tanstack/react-router'
import { Button } from "@/components/ui/button";
import { useEffect, useState, type FormEvent } from "react";
import { api } from "@/lib/axios";
import { Loader2, CheckCheck, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import z from 'zod';
import { router } from '@/router';

const PasswordForgotSearchSchema = z.object({
  email: z.string().optional(),
});

export const Route = createFileRoute('/_auth/password/forgot')({
  validateSearch: (search) => PasswordForgotSearchSchema.parse(search),
  component: PasswordForgot,
})

function PasswordForgot() {
  const { email } = Route.useSearch();

  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!email) {
      toast.error("Email inválido")
      router.navigate({ to: "/password/recover" })
    }
  }, [email])

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsLoading(true);

    try {
      await api.post("/password/recover", {
        email
      });

      toast.success("Email de redefinição de senha enviado com sucesso!")
    } catch (error) {
      const errorMessage =
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof error.response === "object" &&
        error.response !== null &&
        "data" in error.response &&
        typeof error.response.data === "object" &&
        error.response.data !== null &&
        "message" in error.response.data &&
        typeof error.response.data.message === "string"
          ? error.response.data.message
          : undefined;

      toast.error(errorMessage ?? "Erro ao enviar email. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form
      className="space-y-4 w-full max-w-sm"
      onSubmit={onSubmit}
      noValidate
    >
      <div className="space-y-3 text-center">
        <div className="mx-auto bg-green-600 w-12 h-12 rounded-full flex items-center justify-center">
          <CheckCheck className="mx-auto text-white" />
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">Email enviado!</h1>
        <div>
          <p className="text-sm text-muted-foreground">
            Enviamos as instruções para redefinir sua senha para:
          </p>
          <span className="font-medium text-sm">{email}</span>
        </div>
      </div>

      <div className="space-y-2 text-center text-sm p-4 bg-muted rounded-lg text-muted-foreground mt-10">
        <p>Não recebeu o email?</p>
        <div className="flex flex-col">
          <span>• Verifique sua caixa de spam</span>
          <span>• Aguarde alguns minutos</span>
          <span>• Confirme se o email está correto</span>
        </div>
      </div>

      <Button
        className="w-full hover:opacity-90 cursor-pointer"
        variant="outline"
        disabled={isLoading}
        type="submit"
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Enviando...
          </span>
        ) : (
          "Reenviar email"
        )}
      </Button>
      <Button asChild className="cursor-pointer w-full text-green-600 hover:text-green-700 dark:text-green-300 hover:underline" variant="link">
        <Link to="/sign-in">
          <ArrowLeft />
          Voltar para o login
        </Link>
      </Button>
    </form>
  )
}
