import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import type { SaleStatus } from "@/lib/sales";
import { SaleInstallmentsPanel } from "@/components/sales/sale-installments-panel";

type SaleInstallmentsModalProps = {
  open: boolean;
  onClose: () => void;
  saleId: string;
  saleStatus: SaleStatus;
};

export function SaleInstallmentsModal({
  open,
  onClose,
  saleId,
  saleStatus,
}: SaleInstallmentsModalProps) {
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-black/45">
        <View className="mt-auto max-h-[88%] rounded-t-3xl bg-white px-4 pb-6 pt-4">
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-[18px] font-bold text-slate-900">Parcelas de comissão</Text>
            <Pressable onPress={onClose}>
              <Text className="text-[14px] font-medium text-brand-700">Fechar</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ paddingBottom: 8 }}>
            <SaleInstallmentsPanel saleId={saleId} saleStatus={saleStatus} enabled={open} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
