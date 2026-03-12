import { useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { AuthButton } from "@/components/auth/auth-button";
import { AuthShell } from "@/components/auth/auth-shell";
import { useAuth } from "@/hooks/use-auth";
import { sendEmailOtp } from "@/lib/auth-service";
import { getApiErrorMessage } from "@/lib/errors";
import { getStringParam } from "@/lib/route-param";

export default function VerifyOtpScreen() {
  const params = useLocalSearchParams<{ email?: string | string[] }>();
  const email = useMemo(() => getStringParam(params.email)?.trim().toLowerCase(), [params.email]);

  const { signInWithOtp } = useAuth();

  const [code, setCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function handleVerifyOtp() {
    if (!email) {
      setErrorMessage("Email invalido. Volte para o login.");
      return;
    }

    if (!/^\d{6}$/.test(code)) {
      setErrorMessage("Informe os 6 digitos do codigo.");
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      await signInWithOtp({ email, code });
      router.replace("/(app)");
    } catch (error) {
      setErrorMessage(
        getApiErrorMessage(error, "Codigo invalido ou expirado. Tente novamente."),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResendCode() {
    if (!email) {
      return;
    }

    setIsResending(true);
    setErrorMessage(null);

    try {
      await sendEmailOtp(email);
      setSuccessMessage("Codigo reenviado para o email informado.");
    } catch (error) {
      setErrorMessage(
        getApiErrorMessage(error, "Nao foi possivel reenviar o codigo."),
      );
    } finally {
      setIsResending(false);
    }
  }

  return (
    <AuthShell
      title="Verifique seu email"
      description={
        email
          ? `Enviamos um codigo de 6 digitos para ${email}`
          : "Nao foi possivel identificar o email para verificacao"
      }
    >
      <View className="gap-1.5">
        <Text className="text-[13px] font-semibold text-slate-900">Codigo de verificacao</Text>
        <TextInput
          className="h-12 rounded-xl border border-slate-300 bg-slate-50 px-3.5 text-center text-lg font-bold tracking-[6px] text-slate-900"
          placeholder="000000"
          placeholderTextColor="#94a3b8"
          keyboardType="number-pad"
          maxLength={6}
          value={code}
          onChangeText={(nextValue) => setCode(nextValue.replace(/\D/g, ""))}
          onSubmitEditing={() => {
            void handleVerifyOtp();
          }}
        />
      </View>

      {errorMessage ? <Text className="text-[13px] text-red-600">{errorMessage}</Text> : null}
      {successMessage ? <Text className="text-[13px] text-brand-600">{successMessage}</Text> : null}

      <View className="gap-2.5">
        <AuthButton
          label="Verificar codigo"
          loading={isSubmitting}
          disabled={!email}
          onPress={() => void handleVerifyOtp()}
        />
        <AuthButton
          label="Reenviar codigo"
          variant="outline"
          loading={isResending}
          disabled={!email}
          onPress={() => void handleResendCode()}
        />
        <AuthButton
          label="Voltar"
          variant="ghost"
          onPress={() => router.replace("/(auth)/sign-in")}
        />
      </View>

      <Pressable
        onPress={() => {
          if (!email) {
            return;
          }

          router.push({
            pathname: "/(auth)/password/recover",
            params: { email },
          });
        }}
      >
        <Text className="mt-0.5 text-center text-[13px] font-semibold text-teal-700">
          Prefere redefinir senha? Recuperar acesso
        </Text>
      </Pressable>
    </AuthShell>
  );
}
