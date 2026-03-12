import { ActivityIndicator, Text, View } from "react-native";

type LoadingScreenProps = {
  message?: string;
};

export function LoadingScreen({
  message = "Carregando...",
}: LoadingScreenProps) {
  return (
    <View className="flex-1 items-center justify-center gap-3 bg-slate-950 px-6">
      <ActivityIndicator color="#2f9e44" size="large" />
      <Text className="text-center text-sm text-slate-300">{message}</Text>
    </View>
  );
}
