import { Redirect, Stack } from "expo-router";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { useAuth } from "@/hooks/use-auth";

export default function PrivateLayout() {
  const { isBootstrapping, isAuthenticated } = useAuth();

  if (isBootstrapping) {
    return <LoadingScreen message="Carregando area protegida..." />;
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
