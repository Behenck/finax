import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { AppButton } from "@/components/app/ui";
import { useOrganizationSlug } from "@/hooks/use-organization-slug";
import { getApiErrorMessage } from "@/lib/errors";
import {
  SALE_COMMISSION_DIRECTION_LABEL,
  SALE_COMMISSION_INSTALLMENT_STATUS_LABEL,
  SALE_COMMISSION_RECIPIENT_TYPE_LABEL,
  SALE_COMMISSION_SOURCE_TYPE_LABEL,
  commissionsQueryKeys,
  deleteSaleInstallment,
  formatCurrencyBRLFromCents,
  formatCurrencyInput,
  formatDateBR,
  listSaleInstallments,
  parseCurrencyToCents,
  patchSaleInstallment,
  patchSaleInstallmentStatus,
  salesQueryKeys,
  type SaleInstallment,
  type SaleStatus,
} from "@/lib/sales";

type InstallmentStatusAction = {
  installment: SaleInstallment;
  status: "PAID" | "CANCELED";
  paymentDate: string;
  amount: string;
};

type InstallmentEditState = {
  installment: SaleInstallment;
  percentage: string;
  amount: string;
  status: "PENDING" | "PAID" | "CANCELED";
  expectedPaymentDate: string;
  paymentDate: string;
};

type SaleInstallmentsPanelProps = {
  saleId: string;
  saleStatus: SaleStatus;
  enabled?: boolean;
};

function canUpdateInstallments(saleStatus: SaleStatus): boolean {
  return saleStatus === "APPROVED" || saleStatus === "COMPLETED";
}

export function SaleInstallmentsPanel({
  saleId,
  saleStatus,
  enabled = true,
}: SaleInstallmentsPanelProps) {
  const slug = useOrganizationSlug();
  const queryClient = useQueryClient();
  const [statusAction, setStatusAction] = useState<InstallmentStatusAction | null>(null);
  const [editingInstallment, setEditingInstallment] = useState<InstallmentEditState | null>(null);
  const [installmentToDelete, setInstallmentToDelete] = useState<SaleInstallment | null>(null);

  const installmentsQuery = useQuery({
    queryKey: salesQueryKeys.installments(slug, saleId),
    queryFn: () => listSaleInstallments(slug, saleId),
    enabled: enabled && Boolean(saleId),
  });

  const patchStatusMutation = useMutation({
    mutationFn: async (payload: {
      installmentId: string;
      status: "PAID" | "CANCELED";
      paymentDate?: string;
      amount?: number;
    }) => {
      await patchSaleInstallmentStatus(slug, saleId, payload.installmentId, {
        status: payload.status,
        paymentDate: payload.paymentDate,
        amount: payload.amount,
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: salesQueryKeys.installments(slug, saleId) }),
        queryClient.invalidateQueries({ queryKey: salesQueryKeys.detail(slug, saleId) }),
        queryClient.invalidateQueries({ queryKey: salesQueryKeys.list(slug) }),
        queryClient.invalidateQueries({ queryKey: commissionsQueryKeys.root }),
      ]);
    },
  });

  const patchInstallmentMutation = useMutation({
    mutationFn: async (payload: {
      installmentId: string;
      percentage: number;
      amount: number;
      status: "PENDING" | "PAID" | "CANCELED";
      expectedPaymentDate: string;
      paymentDate: string | null;
    }) => {
      await patchSaleInstallment(slug, saleId, payload.installmentId, {
        percentage: payload.percentage,
        amount: payload.amount,
        status: payload.status,
        expectedPaymentDate: payload.expectedPaymentDate,
        paymentDate: payload.paymentDate,
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: salesQueryKeys.installments(slug, saleId) }),
        queryClient.invalidateQueries({ queryKey: salesQueryKeys.detail(slug, saleId) }),
        queryClient.invalidateQueries({ queryKey: salesQueryKeys.list(slug) }),
        queryClient.invalidateQueries({ queryKey: commissionsQueryKeys.root }),
      ]);
    },
  });

  const deleteInstallmentMutation = useMutation({
    mutationFn: async (installmentId: string) => {
      await deleteSaleInstallment(slug, saleId, installmentId);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: salesQueryKeys.installments(slug, saleId) }),
        queryClient.invalidateQueries({ queryKey: salesQueryKeys.detail(slug, saleId) }),
        queryClient.invalidateQueries({ queryKey: salesQueryKeys.list(slug) }),
        queryClient.invalidateQueries({ queryKey: commissionsQueryKeys.root }),
      ]);
    },
  });

  const canEdit = canUpdateInstallments(saleStatus);
  const installments = useMemo(() => installmentsQuery.data ?? [], [installmentsQuery.data]);

  const summary = useMemo(
    () => ({
      total: installments.length,
      paid: installments.filter((installment) => installment.status === "PAID").length,
      pending: installments.filter((installment) => installment.status === "PENDING").length,
      canceled: installments.filter((installment) => installment.status === "CANCELED").length,
    }),
    [installments],
  );

  const groupedInstallments = useMemo(() => {
    const map = new Map<
      string,
      { key: string; label: string; installments: SaleInstallment[] }
    >();

    for (const installment of installments) {
      const key = installment.beneficiaryKey;
      const label =
        installment.beneficiaryLabel ??
        SALE_COMMISSION_RECIPIENT_TYPE_LABEL[installment.recipientType];
      const currentGroup = map.get(key);
      if (!currentGroup) {
        map.set(key, { key, label, installments: [installment] });
      } else {
        currentGroup.installments.push(installment);
      }
    }

    return Array.from(map.values());
  }, [installments]);

  async function handleConfirmStatusAction() {
    if (!statusAction) {
      return;
    }

    try {
      await patchStatusMutation.mutateAsync({
        installmentId: statusAction.installment.id,
        status: statusAction.status,
        paymentDate: statusAction.status === "PAID" ? statusAction.paymentDate : undefined,
        amount: parseCurrencyToCents(statusAction.amount),
      });
      setStatusAction(null);
    } catch (error) {
      setStatusAction((previous) => previous);
      alert(getApiErrorMessage(error, "Não foi possível atualizar a parcela."));
    }
  }

  async function handleConfirmInstallmentEdit() {
    if (!editingInstallment) {
      return;
    }

    const parsedPercentage = Number(editingInstallment.percentage.replace(",", "."));
    if (!Number.isFinite(parsedPercentage)) {
      alert("Informe um percentual válido.");
      return;
    }

    if (!editingInstallment.expectedPaymentDate) {
      alert("Informe a previsão de pagamento.");
      return;
    }

    try {
      await patchInstallmentMutation.mutateAsync({
        installmentId: editingInstallment.installment.id,
        percentage: parsedPercentage,
        amount: parseCurrencyToCents(editingInstallment.amount),
        status: editingInstallment.status,
        expectedPaymentDate: editingInstallment.expectedPaymentDate,
        paymentDate:
          editingInstallment.status === "PAID"
            ? editingInstallment.paymentDate || null
            : null,
      });
      setEditingInstallment(null);
    } catch (error) {
      alert(getApiErrorMessage(error, "Não foi possível editar a parcela."));
    }
  }

  async function handleConfirmInstallmentDelete() {
    if (!installmentToDelete) {
      return;
    }

    try {
      await deleteInstallmentMutation.mutateAsync(installmentToDelete.id);
      setInstallmentToDelete(null);
    } catch (error) {
      alert(getApiErrorMessage(error, "Não foi possível excluir a parcela."));
    }
  }

  if (installmentsQuery.isLoading) {
    return <Text className="py-4 text-[14px] text-slate-500">Carregando parcelas...</Text>;
  }

  if (installmentsQuery.isError) {
    return (
      <View className="gap-2">
        <Text className="text-[14px] text-red-600">Erro ao carregar parcelas.</Text>
        <AppButton
          label="Tentar novamente"
          variant="outline"
          onPress={() => {
            void installmentsQuery.refetch();
          }}
        />
      </View>
    );
  }

  if (installments.length === 0) {
    return (
      <View className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6">
        <Text className="text-center text-[14px] text-slate-500">
          Esta venda não possui parcelas de comissão.
        </Text>
      </View>
    );
  }

  return (
    <View className="gap-3">
      <View className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
        <Text className="text-[13px] text-slate-600">
          Resumo: {summary.paid}/{summary.total} pagas, {summary.pending} pendentes e{" "}
          {summary.canceled} canceladas.
        </Text>
      </View>

      {groupedInstallments.map((group) => (
        <View key={group.key} className="rounded-2xl border border-slate-200 bg-white p-3">
          <Text className="mb-2 text-[14px] font-semibold text-slate-900">{group.label}</Text>

          {group.installments.map((installment) => (
            <View key={installment.id} className="mb-2 rounded-xl border border-slate-200 p-3">
              <View className="mb-2 flex-row items-center justify-between">
                <Text className="text-[13px] font-semibold text-slate-900">
                  Parcela #{installment.installmentNumber}
                </Text>
                <Text className="text-[13px] font-semibold text-slate-900">
                  {formatCurrencyBRLFromCents(installment.amount)}
                </Text>
              </View>

              <Text className="text-[12px] text-slate-600">
                {SALE_COMMISSION_INSTALLMENT_STATUS_LABEL[installment.status]} •{" "}
                {SALE_COMMISSION_SOURCE_TYPE_LABEL[installment.sourceType]} •{" "}
                {SALE_COMMISSION_DIRECTION_LABEL[installment.direction]}
              </Text>
              <Text className="text-[12px] text-slate-600">
                Previsão: {formatDateBR(installment.expectedPaymentDate)} • Pagamento:{" "}
                {formatDateBR(installment.paymentDate)}
              </Text>
              <Text className="mb-3 text-[12px] text-slate-600">
                Percentual: {installment.percentage}%
              </Text>

              <View className="flex-row flex-wrap gap-2">
                <View className="min-w-[47%] flex-1">
                  <AppButton
                    label="Pagar"
                    variant="outline"
                    disabled={!canEdit || installment.status !== "PENDING"}
                    onPress={() =>
                      setStatusAction({
                        installment,
                        status: "PAID",
                        paymentDate: installment.paymentDate?.slice(0, 10) ?? "",
                        amount: formatCurrencyBRLFromCents(installment.amount),
                      })
                    }
                  />
                </View>
                <View className="min-w-[47%] flex-1">
                  <AppButton
                    label="Cancelar"
                    variant="outline"
                    disabled={!canEdit || installment.status === "CANCELED"}
                    onPress={() =>
                      setStatusAction({
                        installment,
                        status: "CANCELED",
                        paymentDate: "",
                        amount: formatCurrencyBRLFromCents(installment.amount),
                      })
                    }
                  />
                </View>
                <View className="min-w-[47%] flex-1">
                  <AppButton
                    label="Editar"
                    variant="outline"
                    disabled={!canEdit}
                    onPress={() =>
                      setEditingInstallment({
                        installment,
                        percentage: String(installment.percentage),
                        amount: formatCurrencyBRLFromCents(installment.amount),
                        status: installment.status,
                        expectedPaymentDate: installment.expectedPaymentDate.slice(0, 10),
                        paymentDate: installment.paymentDate?.slice(0, 10) ?? "",
                      })
                    }
                  />
                </View>
                <View className="min-w-[47%] flex-1">
                  <AppButton
                    label="Excluir"
                    variant="danger"
                    disabled={!canEdit}
                    onPress={() => setInstallmentToDelete(installment)}
                  />
                </View>
              </View>
            </View>
          ))}
        </View>
      ))}

      <Modal
        visible={Boolean(statusAction)}
        transparent
        animationType="fade"
        onRequestClose={() => setStatusAction(null)}
      >
        <View className="flex-1 items-center justify-center bg-black/45 px-4">
          <View className="w-full rounded-2xl bg-white p-4">
            <Text className="mb-1 text-[18px] font-bold text-slate-900">
              {statusAction?.status === "PAID" ? "Confirmar pagamento" : "Cancelar parcela"}
            </Text>
            <Text className="mb-3 text-[13px] text-slate-500">
              Ajuste os dados antes de confirmar.
            </Text>

            <View className="mb-3 gap-1.5">
              <Text className="text-[13px] font-semibold text-slate-900">Valor</Text>
              <TextInput
                className="h-11 rounded-xl border border-slate-300 bg-slate-50 px-3.5 text-[15px] text-slate-900"
                value={statusAction?.amount ?? ""}
                onChangeText={(value) =>
                  setStatusAction((current) =>
                    current
                      ? {
                          ...current,
                          amount: formatCurrencyInput(value),
                        }
                      : current,
                  )
                }
                placeholder="R$ 0,00"
              />
            </View>

            {statusAction?.status === "PAID" ? (
              <View className="mb-4 gap-1.5">
                <Text className="text-[13px] font-semibold text-slate-900">Data do pagamento</Text>
                <TextInput
                  className="h-11 rounded-xl border border-slate-300 bg-slate-50 px-3.5 text-[15px] text-slate-900"
                  value={statusAction?.paymentDate ?? ""}
                  onChangeText={(value) =>
                    setStatusAction((current) =>
                      current
                        ? {
                            ...current,
                            paymentDate: value,
                          }
                        : current,
                    )
                  }
                  placeholder="YYYY-MM-DD"
                  autoCapitalize="none"
                />
              </View>
            ) : null}

            <View className="flex-row gap-2">
              <View className="flex-1">
                <AppButton label="Cancelar" variant="outline" onPress={() => setStatusAction(null)} />
              </View>
              <View className="flex-1">
                <AppButton
                  label="Confirmar"
                  loading={patchStatusMutation.isPending}
                  onPress={() => {
                    void handleConfirmStatusAction();
                  }}
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={Boolean(editingInstallment)}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingInstallment(null)}
      >
        <View className="flex-1 items-center justify-center bg-black/45 px-4">
          <ScrollView className="w-full" contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}>
            <View className="rounded-2xl bg-white p-4">
              <Text className="mb-1 text-[18px] font-bold text-slate-900">Editar parcela</Text>
              <Text className="mb-3 text-[13px] text-slate-500">
                Atualize percentual, valor e datas.
              </Text>

              <View className="mb-3 gap-1.5">
                <Text className="text-[13px] font-semibold text-slate-900">Percentual (%)</Text>
                <TextInput
                  className="h-11 rounded-xl border border-slate-300 bg-slate-50 px-3.5 text-[15px] text-slate-900"
                  value={editingInstallment?.percentage ?? ""}
                  onChangeText={(value) =>
                    setEditingInstallment((current) =>
                      current ? { ...current, percentage: value } : current,
                    )
                  }
                  keyboardType="decimal-pad"
                />
              </View>

              <View className="mb-3 gap-1.5">
                <Text className="text-[13px] font-semibold text-slate-900">Valor</Text>
                <TextInput
                  className="h-11 rounded-xl border border-slate-300 bg-slate-50 px-3.5 text-[15px] text-slate-900"
                  value={editingInstallment?.amount ?? ""}
                  onChangeText={(value) =>
                    setEditingInstallment((current) =>
                      current
                        ? {
                            ...current,
                            amount: formatCurrencyInput(value),
                          }
                        : current,
                    )
                  }
                  placeholder="R$ 0,00"
                />
              </View>

              <View className="mb-3 gap-1.5">
                <Text className="text-[13px] font-semibold text-slate-900">Status</Text>
                <View className="flex-row flex-wrap gap-2">
                  {(["PENDING", "PAID", "CANCELED"] as const).map((status) => {
                    const isActive = editingInstallment?.status === status;
                    return (
                      <Pressable
                        key={status}
                        className={`rounded-full border px-3 py-1.5 ${
                          isActive ? "border-brand-600 bg-brand-50" : "border-slate-300 bg-white"
                        }`}
                        onPress={() =>
                          setEditingInstallment((current) =>
                            current ? { ...current, status } : current,
                          )
                        }
                      >
                        <Text
                          className={`text-[12px] font-medium ${
                            isActive ? "text-brand-700" : "text-slate-700"
                          }`}
                        >
                          {SALE_COMMISSION_INSTALLMENT_STATUS_LABEL[status]}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View className="mb-3 gap-1.5">
                <Text className="text-[13px] font-semibold text-slate-900">Previsão de pagamento</Text>
                <TextInput
                  className="h-11 rounded-xl border border-slate-300 bg-slate-50 px-3.5 text-[15px] text-slate-900"
                  value={editingInstallment?.expectedPaymentDate ?? ""}
                  onChangeText={(value) =>
                    setEditingInstallment((current) =>
                      current ? { ...current, expectedPaymentDate: value } : current,
                    )
                  }
                  placeholder="YYYY-MM-DD"
                  autoCapitalize="none"
                />
              </View>

              {editingInstallment?.status === "PAID" ? (
                <View className="mb-4 gap-1.5">
                  <Text className="text-[13px] font-semibold text-slate-900">Data de pagamento</Text>
                  <TextInput
                    className="h-11 rounded-xl border border-slate-300 bg-slate-50 px-3.5 text-[15px] text-slate-900"
                    value={editingInstallment?.paymentDate ?? ""}
                    onChangeText={(value) =>
                      setEditingInstallment((current) =>
                        current ? { ...current, paymentDate: value } : current,
                      )
                    }
                    placeholder="YYYY-MM-DD"
                    autoCapitalize="none"
                  />
                </View>
              ) : null}

              <View className="flex-row gap-2">
                <View className="flex-1">
                  <AppButton
                    label="Cancelar"
                    variant="outline"
                    onPress={() => setEditingInstallment(null)}
                  />
                </View>
                <View className="flex-1">
                  <AppButton
                    label="Salvar"
                    loading={patchInstallmentMutation.isPending}
                    onPress={() => {
                      void handleConfirmInstallmentEdit();
                    }}
                  />
                </View>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      <Modal
        visible={Boolean(installmentToDelete)}
        transparent
        animationType="fade"
        onRequestClose={() => setInstallmentToDelete(null)}
      >
        <View className="flex-1 items-center justify-center bg-black/45 px-4">
          <View className="w-full rounded-2xl bg-white p-4">
            <Text className="mb-1 text-[18px] font-bold text-slate-900">Excluir parcela</Text>
            <Text className="mb-4 text-[13px] text-slate-500">
              Esta ação não pode ser desfeita.
            </Text>

            <View className="flex-row gap-2">
              <View className="flex-1">
                <AppButton
                  label="Cancelar"
                  variant="outline"
                  onPress={() => setInstallmentToDelete(null)}
                />
              </View>
              <View className="flex-1">
                <AppButton
                  label="Excluir"
                  variant="danger"
                  loading={deleteInstallmentMutation.isPending}
                  onPress={() => {
                    void handleConfirmInstallmentDelete();
                  }}
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
