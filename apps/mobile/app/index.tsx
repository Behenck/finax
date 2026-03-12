import { Redirect } from "expo-router";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { useAuth } from "@/hooks/use-auth";

export default function IndexRoute() {
  const { isBootstrapping, isAuthenticated } = useAuth();

  if (isBootstrapping) {
    return <LoadingScreen message="Preparando sessao..." />;
  }

  if (isAuthenticated) {
    return <Redirect href="/(app)" />;
  }

  return <Redirect href="/(auth)/sign-in" />;
}
