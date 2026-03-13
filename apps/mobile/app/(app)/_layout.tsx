import { Ionicons } from "@expo/vector-icons";
import type { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";
import { Redirect, Tabs } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { HeaderProfileAction } from "@/components/navigation/header-profile-action";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { useAuth } from "@/hooks/use-auth";

function SalesTabButton({
  onPress,
  accessibilityLabel,
  accessibilityState,
  testID,
}: BottomTabBarButtonProps) {
  const isActive = Boolean(accessibilityState?.selected);

  return (
    <View className="items-center" style={{ marginTop: -20, width: 74 }}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        testID={testID}
        className={`h-14 w-14 items-center justify-center rounded-full border-4 border-white ${
          isActive ? "bg-brand-700" : "bg-brand-600"
        }`}
        style={({ pressed }) => (pressed ? { opacity: 0.92 } : undefined)}
      >
        <Ionicons name="cart" size={23} color="#ffffff" />
      </Pressable>
      <Text className={`mt-1 text-[11px] font-semibold ${isActive ? "text-brand-700" : "text-slate-500"}`}>
        Vendas
      </Text>
    </View>
  );
}

export default function PrivateLayout() {
  const { isBootstrapping, isAuthenticated } = useAuth();

  if (isBootstrapping) {
    return <LoadingScreen message="Carregando area protegida..." />;
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: "#ffffff" },
        headerTintColor: "#0f172a",
        headerTitleStyle: {
          fontWeight: "700",
        },
        sceneStyle: {
          backgroundColor: "#ffffff",
        },
        tabBarStyle: {
          backgroundColor: "#ffffff",
          borderTopColor: "#e2e8f0",
          height: 74,
          paddingTop: 8,
          paddingBottom: 10,
          overflow: "visible",
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },
        tabBarActiveTintColor: "#15803d",
        tabBarInactiveTintColor: "#64748b",
        headerRight: () => <HeaderProfileAction />,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          headerShown: false,
          tabBarLabel: "Dashboard",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "grid" : "grid-outline"}
              size={20}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="registers"
        options={{
          title: "Cadastros",
          headerShown: false,
          tabBarLabel: "Cadastros",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "layers" : "layers-outline"}
              size={20}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="sales"
        options={{
          title: "Vendas",
          headerShown: false,
          tabBarLabel: () => null,
          tabBarIcon: () => null,
          tabBarButton: (props) => <SalesTabButton {...props} />,
        }}
      />
      <Tabs.Screen
        name="commissions"
        options={{
          title: "Comissões",
          headerShown: false,
          tabBarLabel: "Comissões",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "wallet" : "wallet-outline"}
              size={20}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Configurações",
          tabBarLabel: "Configurações",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "settings" : "settings-outline"}
              size={20}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          href: null,
          title: "Transações",
        }}
      />
    </Tabs>
  );
}
