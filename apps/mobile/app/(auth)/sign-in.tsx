import { useMemo, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  type PressableStateCallbackType,
  View,
} from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { AuthButton } from "@/components/auth/auth-button";
import { useAuth } from "@/hooks/use-auth";
import { sendEmailOtp } from "@/lib/auth-service";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/errors";

export default function SignInScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email]);

  async function handleSignIn() {
    if (!normalizedEmail || !password) {
      setErrorMessage("Informe email e senha para continuar.");
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await signIn({
        email: normalizedEmail,
        password,
      });

      router.replace("/(app)");
      return;
    } catch (error) {
      const statusCode = getApiErrorStatus(error);

      if (statusCode === 403) {
        try {
          await sendEmailOtp(normalizedEmail);
          router.push({
            pathname: "/(auth)/verify-otp",
            params: { email: normalizedEmail },
          });
          return;
        } catch (otpError) {
          setErrorMessage(
            getApiErrorMessage(
              otpError,
              "Nao foi possivel enviar o codigo OTP. Tente novamente.",
            ),
          );
          return;
        }
      }

      setErrorMessage(
        getApiErrorMessage(error, "Nao foi possivel fazer login. Tente novamente."),
      );
    } finally {
      setIsSubmitting(false);
      setPassword("");
    }
  }

  function handleGoogleSignIn() {
    Alert.alert(
      "Login Google indisponivel",
      "O backend atual redireciona o OAuth para URL web. Se quiser, posso adaptar o fluxo para deep link mobile.",
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-grow justify-center gap-4 px-6 py-8">
          <View className="mb-1 items-center justify-center">
            <View className="h-14 w-14 items-center justify-center rounded-2xl bg-brand-600">
              <Image
                source={require("../../assets/logo-finax-branco.png")}
                className="size-10"
                resizeMode="contain"
              />
            </View>
          </View>

          <View className="mb-1 gap-1.5">
            <Text className="text-center text-[28px] font-bold leading-8 text-slate-900">
              Bem-vindo de volta
            </Text>
            <Text className="text-center text-sm leading-5 text-slate-500">
              Entre com sua conta para acessar o sistema
            </Text>
          </View>

          <View className="gap-1.5">
            <Text className="text-[13px] font-semibold text-slate-900">E-mail</Text>
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
            />
          </View>

          <View className="gap-1.5">
            <Text className="text-[13px] font-semibold text-slate-900">Senha</Text>
            <TextInput
              className="h-12 rounded-xl border border-slate-300 bg-slate-50 px-3.5 text-[15px] text-slate-900"
              placeholder="********"
              placeholderTextColor="#94a3b8"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="password"
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={() => {
                void handleSignIn();
              }}
            />
          </View>

          {errorMessage ? (
            <Text className="text-[13px] leading-[18px] text-red-600">{errorMessage}</Text>
          ) : null}

          <View className="gap-2.5">
            <AuthButton
              label="Entrar"
              loading={isSubmitting}
              onPress={() => void handleSignIn()}
            />

            <Pressable
              className="h-12 flex-row items-center justify-center gap-2.5 rounded-xl border border-slate-300 bg-white"
              onPress={handleGoogleSignIn}
              style={({ pressed }: PressableStateCallbackType) =>
                pressed ? { opacity: 0.9 } : undefined
              }
            >
              <Image
                source={require("../../assets/google-logo.png")}
                className="h-[18px] w-[18px]"
                resizeMode="contain"
              />
              <Text className="text-[15px] font-semibold text-slate-900">
                Continuar com o Google
              </Text>
            </Pressable>
          </View>

          <View className="mt-1 flex-row items-center justify-center gap-1.5">
            <Text className="text-[13px] text-slate-500">Esqueceu a senha?</Text>
            <Pressable
              onPress={() => {
                router.push({
                  pathname: "/(auth)/password/recover",
                  params: normalizedEmail ? { email: normalizedEmail } : {},
                });
              }}
            >
              <Text className="text-[13px] font-bold text-brand-600">Recuperar</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
