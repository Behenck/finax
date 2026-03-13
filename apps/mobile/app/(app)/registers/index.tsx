import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { AppScreen, PageHeader } from "@/components/app/ui";

type RegisterShortcut = {
  title: string;
  description: string;
  href:
    | "/registers/customers"
    | "/registers/sellers"
    | "/registers/partners"
    | "/registers/products"
    | "/registers/companies"
    | "/registers/cost-centers"
    | "/registers/categories"
    | "/registers/employees";
  icon: keyof typeof Ionicons.glyphMap;
};

const REGISTER_SHORTCUTS: RegisterShortcut[] = [
  {
    title: "Clientes",
    description: "Base de clientes PF e PJ.",
    href: "/registers/customers",
    icon: "people-outline",
  },
  {
    title: "Vendedores",
    description: "Cadastro e gestão comercial.",
    href: "/registers/sellers",
    icon: "person-add-outline",
  },
  {
    title: "Parceiros",
    description: "Relacionamento e comissionamento.",
    href: "/registers/partners",
    icon: "person-circle-outline",
  },
  {
    title: "Produtos",
    description: "Catálogo e estrutura em árvore.",
    href: "/registers/products",
    icon: "cube-outline",
  },
  {
    title: "Empresas",
    description: "Empresas e suas unidades.",
    href: "/registers/companies",
    icon: "business-outline",
  },
  {
    title: "Centros de Custo",
    description: "Classificação de custos.",
    href: "/registers/cost-centers",
    icon: "card-outline",
  },
  {
    title: "Categorias",
    description: "Tipos de entrada e saída.",
    href: "/registers/categories",
    icon: "pricetags-outline",
  },
  {
    title: "Funcionários",
    description: "Pessoas por empresa e unidade.",
    href: "/registers/employees",
    icon: "briefcase-outline",
  },
];

export default function RegistersHomeScreen() {
  return (
    <AppScreen>
      <PageHeader
        title="Cadastros"
        description="Acesse rapidamente os módulos de cadastro da sua organização."
      />

      <View className="flex-row flex-wrap justify-between">
        {REGISTER_SHORTCUTS.map((item) => (
          <Pressable
            key={item.href}
            className="mb-3 w-[48.5%] rounded-2xl border border-slate-200 bg-white px-3 py-3.5"
            onPress={() => router.push(item.href)}
            style={({ pressed }) => (pressed ? { opacity: 0.9 } : undefined)}
          >
            <View className="mb-3 h-9 w-9 items-center justify-center rounded-xl bg-brand-50">
              <Ionicons name={item.icon} size={18} color="#15803d" />
            </View>
            <Text className="mb-1 text-[14px] font-semibold text-slate-900">{item.title}</Text>
            <Text className="text-[12px] leading-4 text-slate-500">{item.description}</Text>
          </Pressable>
        ))}
      </View>
    </AppScreen>
  );
}
