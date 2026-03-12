import type { PropsWithChildren } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

type AuthShellProps = PropsWithChildren<{
  title: string;
  description: string;
}>;

function FeatureItem({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View className="flex-row items-center gap-2.5">
      <View className="h-7 w-7 items-center justify-center rounded-[10px] bg-emerald-400/20">
        <Ionicons name={icon} size={16} color="#34d399" />
      </View>
      <Text className="text-[13px] font-medium text-slate-300">{text}</Text>
    </View>
  );
}

export function AuthShell({ title, description, children }: AuthShellProps) {
  return (
    <SafeAreaView className="flex-1 bg-slate-950">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          className="flex-1"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="flex-grow gap-3.5 px-5 pb-5">
            <View className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 p-5">
              <View className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-emerald-400/20" />
              <Text className="text-xs font-bold tracking-[3px] text-emerald-300">FINAX</Text>
              <Text className="mt-2 text-[26px] font-bold leading-8 text-slate-50">
                Controle financeiro inteligente
              </Text>
              <Text className="mt-2 text-sm leading-5 text-slate-400">
                Gerencie receitas, despesas e fluxo de caixa com dados centralizados.
              </Text>

              <View className="mt-3 gap-2.5">
                <FeatureItem icon="shield-checkmark-outline" text="Dados seguros e protegidos" />
                <FeatureItem icon="flash-outline" text="Relatorios prontos para decisao" />
              </View>
            </View>

            <View className="rounded-3xl border border-slate-800 bg-white px-[18px] py-[22px]">
              <Text className="text-2xl font-bold leading-[30px] text-slate-900">{title}</Text>
              <Text className="mt-1 text-sm leading-5 text-slate-500">{description}</Text>
              <View className="mt-2.5 gap-3.5">{children}</View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
