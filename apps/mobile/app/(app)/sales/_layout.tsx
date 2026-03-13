import { Stack } from "expo-router";
import { HeaderProfileAction } from "@/components/navigation/header-profile-action";

export default function SalesLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#ffffff" },
        headerTintColor: "#0f172a",
        headerTitleStyle: {
          fontWeight: "700",
        },
        contentStyle: {
          backgroundColor: "#ffffff",
        },
        headerRight: () => <HeaderProfileAction />,
      }}
    >
      <Stack.Screen name="index" options={{ title: "Vendas" }} />
      <Stack.Screen name="create" options={{ title: "Nova Venda" }} />
      <Stack.Screen name="[saleId]/index" options={{ title: "Detalhes da Venda" }} />
      <Stack.Screen name="[saleId]/edit" options={{ title: "Editar Venda" }} />
    </Stack>
  );
}
