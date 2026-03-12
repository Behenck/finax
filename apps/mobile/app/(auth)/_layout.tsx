import { Redirect, Stack, useSegments } from "expo-router";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { useAuth } from "@/hooks/use-auth";

export default function AuthLayout() {
  const { isBootstrapping, isAuthenticated } = useAuth();
  const segments = useSegments();
  const authScreen = segments[1];

  if (isBootstrapping) {
    return <LoadingScreen message="Validando sessao..." />;
  }

  if (isAuthenticated && authScreen !== "sign-out") {
    return <Redirect href="/(app)" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
