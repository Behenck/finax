import { useEffect } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/hooks/use-auth";

export default function SignOutScreen() {
  const { signOut } = useAuth();

  useEffect(() => {
    let isMounted = true;

    async function runSignOut() {
      await signOut();

      if (isMounted) {
        router.replace("/(auth)/sign-in");
      }
    }

    void runSignOut();

    return () => {
      isMounted = false;
    };
  }, [signOut]);

  return (
    <View className="flex-1 items-center justify-center bg-slate-950">
      <Text className="text-[15px] text-slate-200">Saindo...</Text>
    </View>
  );
}
