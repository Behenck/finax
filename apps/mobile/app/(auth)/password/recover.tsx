import { useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { AuthButton } from "@/components/auth/auth-button";
import { AuthShell } from "@/components/auth/auth-shell";
import { getApiErrorMessage } from "@/lib/errors";
import { requestPasswordRecover } from "@/lib/auth-service";
import { getStringParam } from "@/lib/route-param";

export default function PasswordRecoverScreen() {
  const params = useLocalSearchParams<{ email?: string | string[] }>();
  const initialEmail = useMemo(
    () => getStringParam(params.email)?.trim().toLowerCase() ?? "",
    [params.email],
  );

  const [email, setEmail] = useState(initialEmail);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleRecoverPassword() {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setErrorMessage("Informe o email para receber o link de redefinicao.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await requestPasswordRecover({ email: normalizedEmail });
      router.replace({
        pathname: "/(auth)/password/forgot",
        params: { email: normalizedEmail },
      });
    } catch (error) {
      setErrorMessage(
        getApiErrorMessage(error, "Nao foi possivel enviar o email de recuperacao."),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Esqueci minha senha"
      description="Digite seu email para receber instrucoes de redefinicao"
    >
      <View className="gap-1.5">
        <Text className="text-[13px] font-semibold text-slate-900">Email</Text>
        <TextInput
          className="h-12 rounded-xl border border-slate-300 bg-slate-50 px-3.5 text-[15px] text-slate-900"
          placeholder="seu@email.com"
          placeholderTextColor="#94a3b8"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          autoComplete="email"
          value={email}
          onChangeText={setEmail}
          onSubmitEditing={() => {
            void handleRecoverPassword();
          }}
        />
      </View>

      {errorMessage ? <Text className="text-[13px] text-red-600">{errorMessage}</Text> : null}

      <View className="gap-2.5">
        <AuthButton
          label="Enviar instrucoes"
          loading={isSubmitting}
          onPress={() => void handleRecoverPassword()}
        />
        <AuthButton
          label="Voltar ao login"
          variant="outline"
          onPress={() => router.replace("/(auth)/sign-in")}
        />
      </View>

      <Pressable onPress={() => router.replace("/(auth)/sign-in")}>
        <Text className="mt-0.5 text-center text-[13px] font-semibold text-teal-700">
          Ja lembrou a senha? Fazer login
        </Text>
      </Pressable>
    </AuthShell>
  );
}
