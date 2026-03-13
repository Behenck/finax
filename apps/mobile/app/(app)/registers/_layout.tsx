import { Stack } from "expo-router";
import { HeaderProfileAction } from "@/components/navigation/header-profile-action";

export default function RegistersLayout() {
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
      <Stack.Screen name="index" options={{ title: "Cadastros" }} />

      <Stack.Screen name="customers/index" options={{ title: "Clientes" }} />
      <Stack.Screen name="customers/create" options={{ title: "Novo Cliente" }} />
      <Stack.Screen
        name="customers/[customerId]/edit"
        options={{ title: "Editar Cliente" }}
      />

      <Stack.Screen name="sellers/index" options={{ title: "Vendedores" }} />
      <Stack.Screen name="sellers/create" options={{ title: "Novo Vendedor" }} />
      <Stack.Screen
        name="sellers/[sellerId]/edit"
        options={{ title: "Editar Vendedor" }}
      />

      <Stack.Screen name="partners/index" options={{ title: "Parceiros" }} />
      <Stack.Screen name="partners/create" options={{ title: "Novo Parceiro" }} />
      <Stack.Screen
        name="partners/[partnerId]/edit"
        options={{ title: "Editar Parceiro" }}
      />

      <Stack.Screen name="products/index" options={{ title: "Produtos" }} />
      <Stack.Screen name="products/create" options={{ title: "Novo Produto" }} />
      <Stack.Screen name="products/[id]/edit" options={{ title: "Editar Produto" }} />

      <Stack.Screen name="companies/index" options={{ title: "Empresas" }} />
      <Stack.Screen name="cost-centers/index" options={{ title: "Centros de Custo" }} />
      <Stack.Screen name="categories/index" options={{ title: "Categorias" }} />

      <Stack.Screen name="employees/index" options={{ title: "Funcionários" }} />
      <Stack.Screen name="employees/create" options={{ title: "Novo Funcionário" }} />
      <Stack.Screen
        name="employees/[employeeId]/edit"
        options={{ title: "Editar Funcionário" }}
      />
    </Stack>
  );
}
