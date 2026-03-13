import { Ionicons } from "@expo/vector-icons";
import type { DrawerContentComponentProps } from "@react-navigation/drawer";
import { router, usePathname } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { DrawerContentScrollView } from "@react-navigation/drawer";
import { useAuth } from "@/hooks/use-auth";

type NavItem = {
  label: string;
  href: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const mainItems: NavItem[] = [
  { label: "Dashboard", href: "/", icon: "grid-outline" },
  { label: "Vendas", href: "/sales", icon: "cart-outline" },
  { label: "Comissões", href: "/commissions", icon: "wallet-outline" },
  { label: "Transações", href: "/transactions", icon: "swap-horizontal-outline" },
  { label: "Configurações", href: "/settings", icon: "settings-outline" },
];

const registerItems: NavItem[] = [
  { label: "Clientes", href: "/registers/customers", icon: "people-outline" },
  { label: "Vendedores", href: "/registers/sellers", icon: "person-add-outline" },
  { label: "Parceiros", href: "/registers/partners", icon: "person-circle-outline" },
  { label: "Produtos", href: "/registers/products", icon: "cube-outline" },
  { label: "Empresas", href: "/registers/companies", icon: "business-outline" },
  { label: "Centros de Custo", href: "/registers/cost-centers", icon: "card-outline" },
  { label: "Categorias", href: "/registers/categories", icon: "pricetags-outline" },
  { label: "Funcionários", href: "/registers/employees", icon: "briefcase-outline" },
];

function isItemActive(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function DrawerItem({
  label,
  icon,
  isActive,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  isActive: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      className={`mb-1.5 flex-row items-center rounded-xl px-3 py-2.5 ${
        isActive ? "bg-brand-50" : "bg-transparent"
      }`}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Ir para ${label}`}
      style={({ pressed }) => (pressed ? { opacity: 0.88 } : undefined)}
    >
      <Ionicons
        name={icon}
        size={18}
        color={isActive ? "#15803d" : "#334155"}
        style={{ marginRight: 10 }}
      />
      <Text
        className={`text-[14px] font-medium ${
          isActive ? "text-brand-700" : "text-slate-700"
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function AppDrawerContent(props: DrawerContentComponentProps) {
  const pathname = usePathname();
  const { session, signOut } = useAuth();
  const [isRegistersOpen, setIsRegistersOpen] = useState(pathname.startsWith("/registers"));

  useEffect(() => {
    if (pathname.startsWith("/registers")) {
      setIsRegistersOpen(true);
    }
  }, [pathname]);

  const isRegistersActive = useMemo(
    () => registerItems.some((item) => isItemActive(pathname, item.href)),
    [pathname],
  );

  function navigateTo(href: string) {
    props.navigation.closeDrawer();

    if (pathname !== href) {
      router.push(href as never);
    }
  }

  function handleSignOut() {
    props.navigation.closeDrawer();
    void (async () => {
      await signOut();
      router.replace("/(auth)/sign-in");
    })();
  }

  return (
    <DrawerContentScrollView
      {...props}
      contentContainerStyle={{ paddingBottom: 20, flexGrow: 1 }}
    >
      <View className="flex-1 px-3 pt-2">
        <View className="mb-5 rounded-2xl bg-slate-900 p-4">
          <View className="mb-2 flex-row items-center">
            <View className="mr-2.5 h-9 w-9 items-center justify-center rounded-xl bg-brand-600">
              <Image
                source={require("../../assets/logo-finax-branco.png")}
                className="h-6 w-6"
                resizeMode="contain"
              />
            </View>
            <View className="flex-1">
              <Text className="text-[14px] font-bold text-white">Finax</Text>
              <Text className="text-[11px] text-slate-300">
                {session?.organization.name ?? "Organização"}
              </Text>
            </View>
          </View>
        </View>

        <View className="mb-2">
          {mainItems.slice(0, 4).map((item) => (
            <DrawerItem
              key={item.href}
              label={item.label}
              icon={item.icon}
              isActive={isItemActive(pathname, item.href)}
              onPress={() => navigateTo(item.href)}
            />
          ))}
        </View>

        <Pressable
          className={`mb-1.5 flex-row items-center rounded-xl px-3 py-2.5 ${
            isRegistersActive ? "bg-brand-50" : "bg-transparent"
          }`}
          onPress={() => setIsRegistersOpen((state) => !state)}
          accessibilityRole="button"
          accessibilityLabel="Expandir cadastros"
          style={({ pressed }) => (pressed ? { opacity: 0.9 } : undefined)}
        >
          <Ionicons
            name="layers-outline"
            size={18}
            color={isRegistersActive ? "#15803d" : "#334155"}
            style={{ marginRight: 10 }}
          />
          <Text
            className={`flex-1 text-[14px] font-medium ${
              isRegistersActive ? "text-brand-700" : "text-slate-700"
            }`}
          >
            Cadastros
          </Text>
          <Ionicons
            name={isRegistersOpen ? "chevron-up-outline" : "chevron-down-outline"}
            size={16}
            color="#64748b"
          />
        </Pressable>

        {isRegistersOpen ? (
          <View className="mb-2 ml-3 border-l border-slate-200 pl-2">
            {registerItems.map((item) => (
              <DrawerItem
                key={item.href}
                label={item.label}
                icon={item.icon}
                isActive={isItemActive(pathname, item.href)}
                onPress={() => navigateTo(item.href)}
              />
            ))}
          </View>
        ) : null}

        <View className="mb-2">
          <DrawerItem
            label={mainItems[4].label}
            icon={mainItems[4].icon}
            isActive={isItemActive(pathname, mainItems[4].href)}
            onPress={() => navigateTo(mainItems[4].href)}
          />
        </View>

        <View className="mt-auto rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <Text className="text-[12px] font-semibold text-slate-900">
            {session?.user.name?.trim() || "Usuário"}
          </Text>
          <Text className="mb-2 text-[12px] text-slate-500">{session?.user.email}</Text>
          <Pressable
            className="h-10 items-center justify-center rounded-xl border border-red-600 bg-red-600"
            onPress={handleSignOut}
            style={({ pressed }) => (pressed ? { opacity: 0.9 } : undefined)}
          >
            <Text className="text-[14px] font-semibold text-white">Sair</Text>
          </Pressable>
        </View>
      </View>
    </DrawerContentScrollView>
  );
}
