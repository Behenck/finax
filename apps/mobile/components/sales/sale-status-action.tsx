import { useMemo, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { AppButton } from "@/components/app/ui";
import { SALE_STATUS_LABEL, SALE_STATUS_TRANSITIONS } from "@/lib/sales";
import type { SaleStatus } from "@/lib/sales";

type SaleStatusActionProps = {
  currentStatus: SaleStatus;
  loading?: boolean;
  onConfirm: (status: SaleStatus) => Promise<void> | void;
};

export function SaleStatusAction({
  currentStatus,
  loading = false,
  onConfirm,
}: SaleStatusActionProps) {
  const [open, setOpen] = useState(false);
  const [nextStatus, setNextStatus] = useState<SaleStatus | "">("");

  const transitions = useMemo(
    () => SALE_STATUS_TRANSITIONS[currentStatus],
    [currentStatus],
  );

  const isDisabled = transitions.length === 0 || loading;

  async function handleConfirm() {
    if (!nextStatus) {
      return;
    }

    await onConfirm(nextStatus);
    setOpen(false);
    setNextStatus("");
  }

  return (
    <>
      <AppButton
        label={transitions.length === 0 ? "Sem transição" : "Alterar status"}
        variant="outline"
        disabled={isDisabled}
        loading={loading}
        onPress={() => {
          setNextStatus(transitions[0] ?? "");
          setOpen(true);
        }}
      />

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <View className="flex-1 items-center justify-center bg-black/45 px-4">
          <View className="w-full rounded-2xl bg-white p-4">
            <Text className="mb-1 text-[18px] font-bold text-slate-900">
              Alterar status da venda
            </Text>
            <Text className="mb-3 text-[13px] text-slate-500">
              Status atual: {SALE_STATUS_LABEL[currentStatus]}
            </Text>

            <View className="mb-4 flex-row flex-wrap gap-2">
              {transitions.map((status) => {
                const isActive = status === nextStatus;
                return (
                  <Pressable
                    key={status}
                    className={`rounded-full border px-3 py-1.5 ${
                      isActive ? "border-brand-600 bg-brand-50" : "border-slate-300 bg-white"
                    }`}
                    onPress={() => setNextStatus(status)}
                  >
                    <Text
                      className={`text-[12px] font-medium ${
                        isActive ? "text-brand-700" : "text-slate-700"
                      }`}
                    >
                      {SALE_STATUS_LABEL[status]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View className="flex-row gap-2">
              <View className="flex-1">
                <AppButton
                  label="Cancelar"
                  variant="outline"
                  onPress={() => {
                    setOpen(false);
                    setNextStatus("");
                  }}
                />
              </View>
              <View className="flex-1">
                <AppButton
                  label="Salvar"
                  loading={loading}
                  disabled={!nextStatus}
                  onPress={() => {
                    void handleConfirm();
                  }}
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
