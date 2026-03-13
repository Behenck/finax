import { Text, View } from "react-native";
import { AppScreen, Card, PageHeader } from "@/components/app/ui";

export function ComingSoonScreen({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <AppScreen>
      <PageHeader title={title} description={description} />
      <Card>
        <View className="items-center py-8">
          <Text className="mb-1 text-[18px] font-bold text-slate-900">Em breve</Text>
          <Text className="max-w-[260px] text-center text-[14px] leading-5 text-slate-500">
            Esta seção ainda está em desenvolvimento no app mobile.
          </Text>
        </View>
      </Card>
    </AppScreen>
  );
}
