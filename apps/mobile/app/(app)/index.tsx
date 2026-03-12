import { router } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AuthButton } from "@/components/auth/auth-button";
import { useAuth } from "@/hooks/use-auth";

export default function HomeScreen() {
  const { session, signOut } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    if (isSigningOut) {
      return;
    }

    setIsSigningOut(true);
    try {
      await signOut();
      router.replace("/(auth)/sign-in");
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-950">
      <View className="flex-1 px-5 py-5">
        <Text className="self-start rounded-full bg-emerald-300/15 px-2.5 py-1.5 text-[11px] font-bold tracking-[1px] text-emerald-300">
          AREA LOGADA
        </Text>

        <Text className="mt-4 text-3xl font-bold leading-9 text-slate-50">
          Bem-vindo ao Finax Mobile
        </Text>
        <Text className="mt-1.5 text-[15px] text-slate-400">
          {session?.user.name?.trim() || session?.user.email || "Usuario"}
        </Text>

        <View className="mt-7 gap-2.5 rounded-[18px] border border-slate-800 bg-slate-900 p-4">
          <Text className="text-base font-bold text-slate-50">Conta autenticada</Text>
          <Text className="text-sm text-slate-300">Email: {session?.user.email}</Text>
          <Text className="text-sm text-slate-300">
            Organizacao: {session?.organization.name}
          </Text>
          <Text className="text-sm text-slate-300">Perfil: {session?.organization.role}</Text>
        </View>

        <View className="mt-auto">
          <AuthButton
            label="Sair"
            variant="outline"
            loading={isSigningOut}
            onPress={() => void handleSignOut()}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
