import { useMemo, useState } from "react";
import { Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { AuthButton } from "@/components/auth/auth-button";
import { AuthShell } from "@/components/auth/auth-shell";
import { getApiErrorMessage } from "@/lib/errors";
import { getStringParam } from "@/lib/route-param";
import { resetPassword } from "@/lib/auth-service";

export default function PasswordResetScreen() {
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const tokenFromRoute = useMemo(() => getStringParam(params.token) ?? "", [params.token]);

  const [code, setCode] = useState(tokenFromRoute);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function handleResetPassword() {
    if (!code.trim()) {
      setErrorMessage("Informe o token de recuperacao.");
      return;
    }

    if (password.length < 6) {
      setErrorMessage("A senha deve ter no minimo 6 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("As senhas nao conferem.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await resetPassword({
        code: code.trim(),
        password,
      });

      setSuccessMessage("Senha redefinida com sucesso.");
      setTimeout(() => {
        router.replace("/(auth)/sign-in");
      }, 700);
    } catch (error) {
      setErrorMessage(
        getApiErrorMessage(error, "Nao foi possivel redefinir sua senha."),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Redefinir senha"
      description="Informe o token recebido por email e escolha uma nova senha"
    >
      <View className="gap-1.5">
        <Text className="text-[13px] font-semibold text-slate-900">Token</Text>
        <TextInput
          className="h-12 rounded-xl border border-slate-300 bg-slate-50 px-3.5 text-[15px] text-slate-900"
          placeholder="Cole o token"
          placeholderTextColor="#94a3b8"
          autoCapitalize="none"
          autoCorrect={false}
          value={code}
          onChangeText={setCode}
        />
      </View>

      <View className="gap-1.5">
        <Text className="text-[13px] font-semibold text-slate-900">Nova senha</Text>
        <TextInput
          className="h-12 rounded-xl border border-slate-300 bg-slate-50 px-3.5 text-[15px] text-slate-900"
          placeholder="Minimo de 6 caracteres"
          placeholderTextColor="#94a3b8"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
      </View>

      <View className="gap-1.5">
        <Text className="text-[13px] font-semibold text-slate-900">Confirmar senha</Text>
        <TextInput
          className="h-12 rounded-xl border border-slate-300 bg-slate-50 px-3.5 text-[15px] text-slate-900"
          placeholder="Repita a nova senha"
          placeholderTextColor="#94a3b8"
          secureTextEntry
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          onSubmitEditing={() => {
            void handleResetPassword();
          }}
        />
      </View>

      {errorMessage ? <Text className="text-[13px] text-red-600">{errorMessage}</Text> : null}
      {successMessage ? <Text className="text-[13px] text-brand-600">{successMessage}</Text> : null}

      <View className="gap-2.5">
        <AuthButton
          label="Redefinir senha"
          loading={isSubmitting}
          onPress={() => void handleResetPassword()}
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
