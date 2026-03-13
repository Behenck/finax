import { Text, View } from "react-native";
import { SALE_STATUS_LABEL } from "@/lib/sales";
import type { SaleStatus } from "@/lib/sales";

const STATUS_STYLES: Record<SaleStatus, { container: string; label: string }> = {
  PENDING: {
    container: "bg-yellow-100",
    label: "text-yellow-700",
  },
  APPROVED: {
    container: "bg-blue-100",
    label: "text-blue-700",
  },
  COMPLETED: {
    container: "bg-emerald-100",
    label: "text-emerald-700",
  },
  CANCELED: {
    container: "bg-red-100",
    label: "text-red-700",
  },
};

export function SaleStatusBadge({ status }: { status: SaleStatus }) {
  const style = STATUS_STYLES[status];

  return (
    <View className={`rounded-full px-2.5 py-1 ${style.container}`}>
      <Text className={`text-[11px] font-semibold ${style.label}`}>
        {SALE_STATUS_LABEL[status]}
      </Text>
    </View>
  );
}
