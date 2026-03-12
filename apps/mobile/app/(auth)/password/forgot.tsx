import { useMemo, useState } from "react";
import { Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { AuthButton } from "@/components/auth/auth-button";
import { AuthShell } from "@/components/auth/auth-shell";
import { getApiErrorMessage } from "@/lib/errors";
import { requestPasswordRecover } from "@/lib/auth-service";
import { getStringParam } from "@/lib/route-param";

export default function PasswordForgotScreen() {
  const params = useLocalSearchParams<{ email?: string | string[] }>();
  const email = useMemo(
    () => getStringParam(params.email)?.trim().toLowerCase(),
    [params.email],
  );

  const [isResending, setIsResending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function handleResendEmail() {
    if (!email) {
      setErrorMessage("Email invalido. Volte para a tela de recuperacao.");
      return;
    }

    setIsResending(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await requestPasswordRecover({ email });
      setSuccessMessage("Email reenviado com sucesso.");
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, "Falha ao reenviar email."));
    } finally {
      setIsResending(false);
    }
  }

  return (
    <AuthShell
      title="Email enviado"
      description={
        email
          ? `As instrucoes foram enviadas para ${email}`
          : "As instrucoes foram enviadas para o email informado"
      }
    >
      <View className="gap-1 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <Text className="text-sm font-bold text-slate-900">Nao recebeu o email?</Text>
        <Text className="text-[13px] leading-[18px] text-slate-600">
          Verifique a caixa de spam e aguarde alguns minutos.
        </Text>
        <Text className="text-[13px] leading-[18px] text-slate-600">
          Confirme se o email esta correto antes de reenviar.
        </Text>
      </View>

      {errorMessage ? <Text className="text-[13px] text-red-600">{errorMessage}</Text> : null}
      {successMessage ? <Text className="text-[13px] text-brand-600">{successMessage}</Text> : null}

      <View className="gap-2.5">
        <AuthButton
          label="Reenviar email"
          loading={isResending}
          onPress={() => void handleResendEmail()}
        />
        <AuthButton
          label="Voltar ao login"
          variant="outline"
          onPress={() => router.replace("/(auth)/sign-in")}
        />
      </View>
    </AuthShell>
  );
}
