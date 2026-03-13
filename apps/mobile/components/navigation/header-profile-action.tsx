import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Alert, Pressable } from "react-native";
import { useAuth } from "@/hooks/use-auth";

export function HeaderProfileAction() {
  const { signOut } = useAuth();

  function handleOpenMenu() {
    Alert.alert("Perfil", "Escolha uma ação", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Sair",
        style: "destructive",
        onPress: () => {
          void (async () => {
            await signOut();
            router.replace("/(auth)/sign-in");
          })();
        },
      },
    ]);
  }

  return (
    <Pressable
      className="mr-3 h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white"
      onPress={handleOpenMenu}
      accessibilityRole="button"
      accessibilityLabel="Abrir menu do perfil"
    >
      <Ionicons name="person-outline" size={18} color="#0f172a" />
    </Pressable>
  );
}
