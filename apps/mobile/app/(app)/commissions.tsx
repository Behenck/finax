import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { OptionPicker } from "@/components/app/option-picker";
import { AppButton, AppScreen, Card, EmptyState, PageHeader, SearchField } from "@/components/app/ui";
import { useOrganizationSlug } from "@/hooks/use-organization-slug";
import { getApiErrorMessage } from "@/lib/errors";
import { listProducts } from "@/lib/registers";
import {
  SALE_COMMISSION_DIRECTION_LABEL,
  SALE_COMMISSION_INSTALLMENT_STATUS_LABEL,
  SALE_COMMISSION_RECIPIENT_TYPE_LABEL,
  SALE_COMMISSION_SOURCE_TYPE_LABEL,
  buildProductPathMap,
  commissionsQueryKeys,
  deleteSaleInstallment,
  formatCurrencyBRLFromCents,
  formatCurrencyInput,
  formatDateBR,
  listCommissionsInstallments,
  parseCurrencyToCents,
  patchSaleInstallment,
  patchSaleInstallmentStatus,
  salesQueryKeys,
  toDateInputValue,
  type CommissionInstallment,
  type CommissionsFilters,
  type SaleStatus,
} from "@/lib/sales";

type SelectedInstallment = {
  id: string;
  saleId: string;
  amount: number;
};

type PayActionState = {
  installment: CommissionInstallment;
  paymentDate: string;
  amount: string;
};

type EditInstallmentState = {
  installment: CommissionInstallment;
  percentage: string;
  amount: string;
  status: "PENDING" | "PAID" | "CANCELED";
  expectedPaymentDate: string;
  paymentDate: string;
};

function getTodayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function getCurrentMonthDateRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  return { from, to };
}

function canUpdateInstallments(saleStatus: SaleStatus): boolean {
  return saleStatus === "APPROVED" || saleStatus === "COMPLETED";
}

function canPayInstallment(installment: CommissionInstallment): boolean {
  return installment.status === "PENDING" && canUpdateInstallments(installment.saleStatus);
}

const STATUS_FILTER_OPTIONS: CommissionsFilters["status"][] = [
  "ALL",
  "PENDING",
  "PAID",
  "CANCELED",
];

const DIRECTION_FILTER_OPTIONS: { label: string; value: "INCOME" | "OUTCOME" }[] = [
  { label: "A receber", value: "INCOME" },
  { label: "A pagar", value: "OUTCOME" },
];

export default function CommissionsScreen() {
  const slug = useOrganizationSlug();
  const queryClient = useQueryClient();
  const monthRange = useMemo(() => getCurrentMonthDateRange(), []);
  const [filters, setFilters] = useState<CommissionsFilters>({
    page: 1,
    pageSize: 20,
    q: "",
    status: "ALL",
    direction: "OUTCOME",
    productId: undefined,
    expectedFrom: monthRange.from,
    expectedTo: monthRange.to,
  });
  const [selectedInstallments, setSelectedInstallments] = useState<Map<string, SelectedInstallment>>(
    () => new Map(),
  );
  const [payAction, setPayAction] = useState<PayActionState | null>(null);
  const [editAction, setEditAction] = useState<EditInstallmentState | null>(null);
  const [installmentToDelete, setInstallmentToDelete] = useState<CommissionInstallment | null>(null);
  const [bulkPaymentModalOpen, setBulkPaymentModalOpen] = useState(false);
  const [bulkPaymentDate, setBulkPaymentDate] = useState(getTodayIsoDate());
  const [isBulkPaying, setIsBulkPaying] = useState(false);
  const [isBulkUndoing, setIsBulkUndoing] = useState(false);

  const productsQuery = useQuery({
    queryKey: ["sales", "products-filter", slug],
    queryFn: () => listProducts(slug),
  });

  const commissionsQuery = useQuery({
    queryKey: commissionsQueryKeys.list(slug, filters),
    queryFn: () =>
      listCommissionsInstallments(slug, {
        page: filters.page,
        pageSize: filters.pageSize,
        q: filters.q,
        productId: filters.productId || undefined,
        direction: filters.direction,
        status: filters.status,
        expectedFrom: filters.expectedFrom || undefined,
        expectedTo: filters.expectedTo || undefined,
      }),
  });

  const updateInstallmentStatusMutation = useMutation({
    mutationFn: ({
      installment,
      status,
      paymentDate,
      amount,
    }: {
      installment: CommissionInstallment;
      status: "PAID" | "CANCELED";
      paymentDate?: string;
      amount?: number;
    }) =>
      patchSaleInstallmentStatus(slug, installment.saleId, installment.id, {
        status,
        paymentDate,
        amount,
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: commissionsQueryKeys.root }),
        queryClient.invalidateQueries({ queryKey: salesQueryKeys.root }),
      ]);
    },
  });

  const updateInstallmentMutation = useMutation({
    mutationFn: ({
      installment,
      percentage,
      amount,
      status,
      expectedPaymentDate,
      paymentDate,
    }: {
      installment: CommissionInstallment;
      percentage: number;
      amount: number;
      status: "PENDING" | "PAID" | "CANCELED";
      expectedPaymentDate: string;
      paymentDate: string | null;
    }) =>
      patchSaleInstallment(slug, installment.saleId, installment.id, {
        percentage,
        amount,
        status,
        expectedPaymentDate,
        paymentDate,
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: commissionsQueryKeys.root }),
        queryClient.invalidateQueries({ queryKey: salesQueryKeys.root }),
      ]);
    },
  });

  const deleteInstallmentMutation = useMutation({
    mutationFn: (installment: CommissionInstallment) =>
      deleteSaleInstallment(slug, installment.saleId, installment.id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: commissionsQueryKeys.root }),
        queryClient.invalidateQueries({ queryKey: salesQueryKeys.root }),
      ]);
    },
  });

  const productPathById = useMemo(
    () => buildProductPathMap(productsQuery.data ?? []),
    [productsQuery.data],
  );

  const selectedCount = selectedInstallments.size;
  const selectedValues = useMemo(
    () => Array.from(selectedInstallments.values()),
    [selectedInstallments],
  );

  const items = commissionsQuery.data?.items ?? [];
  const pagination = commissionsQuery.data?.pagination;
  const summaryByDirection = commissionsQuery.data?.summaryByDirection;

  function toggleInstallmentSelection(installment: CommissionInstallment) {
    setSelectedInstallments((current) => {
      const next = new Map(current);

      if (next.has(installment.id)) {
        next.delete(installment.id);
      } else {
        next.set(installment.id, {
          id: installment.id,
          saleId: installment.saleId,
          amount: installment.amount,
        });
      }

      return next;
    });
  }

  async function handleConfirmPayAction() {
    if (!payAction) {
      return;
    }

    try {
      await updateInstallmentStatusMutation.mutateAsync({
        installment: payAction.installment,
        status: "PAID",
        paymentDate: payAction.paymentDate,
        amount: parseCurrencyToCents(payAction.amount),
      });
      setPayAction(null);
    } catch (error) {
      alert(getApiErrorMessage(error, "Não foi possível pagar a parcela."));
    }
  }

  async function handleUndoPayment(installment: CommissionInstallment) {
    try {
      await updateInstallmentMutation.mutateAsync({
        installment,
        percentage: installment.percentage,
        amount: installment.amount,
        status: "PENDING",
        expectedPaymentDate: toDateInputValue(installment.expectedPaymentDate),
        paymentDate: null,
      });
    } catch (error) {
      alert(getApiErrorMessage(error, "Não foi possível desfazer o pagamento."));
    }
  }

  async function handleConfirmInstallmentEdit() {
    if (!editAction) {
      return;
    }

    const percentage = Number(editAction.percentage.replace(",", "."));
    if (!Number.isFinite(percentage)) {
      alert("Informe um percentual válido.");
      return;
    }

    if (!editAction.expectedPaymentDate) {
      alert("Informe a previsão de pagamento.");
      return;
    }

    try {
      await updateInstallmentMutation.mutateAsync({
        installment: editAction.installment,
        percentage,
        amount: parseCurrencyToCents(editAction.amount),
        status: editAction.status,
        expectedPaymentDate: editAction.expectedPaymentDate,
        paymentDate: editAction.status === "PAID" ? editAction.paymentDate || null : null,
      });
      setEditAction(null);
    } catch (error) {
      alert(getApiErrorMessage(error, "Não foi possível atualizar a parcela."));
    }
  }

  async function handleConfirmDelete() {
    if (!installmentToDelete) {
      return;
    }

    try {
      await deleteInstallmentMutation.mutateAsync(installmentToDelete);
      setInstallmentToDelete(null);
    } catch (error) {
      alert(getApiErrorMessage(error, "Não foi possível excluir a parcela."));
    }
  }

  async function handleBulkPay(paymentDate: string) {
    if (selectedValues.length === 0) {
      return;
    }

    setIsBulkPaying(true);

    try {
      await Promise.all(
        selectedValues.map((selected) => {
          const installment = items.find((item) => item.id === selected.id);
          if (!installment) {
            return Promise.resolve();
          }

          return patchSaleInstallmentStatus(slug, installment.saleId, installment.id, {
            status: "PAID",
            paymentDate,
            amount: installment.amount,
          });
        }),
      );

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: commissionsQueryKeys.root }),
        queryClient.invalidateQueries({ queryKey: salesQueryKeys.root }),
      ]);
      setSelectedInstallments(new Map());
      setBulkPaymentModalOpen(false);
    } catch (error) {
      alert(getApiErrorMessage(error, "Não foi possível pagar as parcelas selecionadas."));
    } finally {
      setIsBulkPaying(false);
    }
  }

  async function handleBulkUndoPayments() {
    if (selectedValues.length === 0) {
      return;
    }

    setIsBulkUndoing(true);

    try {
      await Promise.all(
        selectedValues.map((selected) => {
          const installment = items.find((item) => item.id === selected.id);
          if (!installment) {
            return Promise.resolve();
          }

          return patchSaleInstallment(slug, installment.saleId, installment.id, {
            percentage: installment.percentage,
            amount: installment.amount,
            status: "PENDING",
            expectedPaymentDate: toDateInputValue(installment.expectedPaymentDate),
            paymentDate: null,
          });
        }),
      );

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: commissionsQueryKeys.root }),
        queryClient.invalidateQueries({ queryKey: salesQueryKeys.root }),
      ]);
      setSelectedInstallments(new Map());
    } catch (error) {
      alert(getApiErrorMessage(error, "Não foi possível desfazer os pagamentos selecionados."));
    } finally {
      setIsBulkUndoing(false);
    }
  }

  return (
    <AppScreen>
      <PageHeader
        title="Comissões"
        description="Acompanhe parcelas a pagar e a receber com ações operacionais."
      />

      <Card>
        <SearchField
          value={filters.q}
          onChangeText={(value) =>
            setFilters((current) => ({
              ...current,
              q: value,
              page: 1,
            }))
          }
          placeholder="Buscar por cliente, produto ou beneficiário..."
        />

        <View className="mb-3">
          <Text className="mb-1 text-[13px] font-semibold text-slate-900">Direção</Text>
          <View className="flex-row gap-2">
            {DIRECTION_FILTER_OPTIONS.map((direction) => {
              const isActive = filters.direction === direction.value;
              return (
                <Pressable
                  key={direction.value}
                  className={`flex-1 rounded-full border px-3 py-2 ${
                    isActive ? "border-brand-600 bg-brand-50" : "border-slate-300 bg-white"
                  }`}
                  onPress={() =>
                    setFilters((current) => ({
                      ...current,
                      direction: direction.value,
                      page: 1,
                    }))
                  }
                >
                  <Text
                    className={`text-center text-[12px] font-semibold ${
                      isActive ? "text-brand-700" : "text-slate-700"
                    }`}
                  >
                    {direction.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View className="mb-3">
          <Text className="mb-1 text-[13px] font-semibold text-slate-900">Status</Text>
          <View className="flex-row flex-wrap gap-2">
            {STATUS_FILTER_OPTIONS.map((status) => {
              const isActive = filters.status === status;
              return (
                <Pressable
                  key={status}
                  className={`rounded-full border px-3 py-1.5 ${
                    isActive ? "border-brand-600 bg-brand-50" : "border-slate-300 bg-white"
                  }`}
                  onPress={() =>
                    setFilters((current) => ({
                      ...current,
                      status,
                      page: 1,
                    }))
                  }
                >
                  <Text
                    className={`text-[12px] font-medium ${
                      isActive ? "text-brand-700" : "text-slate-700"
                    }`}
                  >
                    {status === "ALL" ? "Todos" : SALE_COMMISSION_INSTALLMENT_STATUS_LABEL[status]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <OptionPicker
          label="Produto"
          placeholder="Todos os produtos"
          options={Array.from(productPathById.entries()).map(([id, label]) => ({ value: id, label }))}
          value={filters.productId}
          onChange={(value) =>
            setFilters((current) => ({
              ...current,
              productId: value,
              page: 1,
            }))
          }
          allowClear
        />

        <View className="mb-3 flex-row gap-2">
          <View className="flex-1 gap-1.5">
            <Text className="text-[13px] font-semibold text-slate-900">Previsão inicial</Text>
            <TextInput
              className="h-11 rounded-xl border border-slate-300 bg-slate-50 px-3.5 text-[15px] text-slate-900"
              value={filters.expectedFrom ?? ""}
              onChangeText={(value) =>
                setFilters((current) => ({
                  ...current,
                  expectedFrom: value,
                  page: 1,
                }))
              }
              placeholder="YYYY-MM-DD"
              autoCapitalize="none"
            />
          </View>
          <View className="flex-1 gap-1.5">
            <Text className="text-[13px] font-semibold text-slate-900">Previsão final</Text>
            <TextInput
              className="h-11 rounded-xl border border-slate-300 bg-slate-50 px-3.5 text-[15px] text-slate-900"
              value={filters.expectedTo ?? ""}
              onChangeText={(value) =>
                setFilters((current) => ({
                  ...current,
                  expectedTo: value,
                  page: 1,
                }))
              }
              placeholder="YYYY-MM-DD"
              autoCapitalize="none"
            />
          </View>
        </View>

        <View className="flex-row gap-2">
          <View className="flex-1">
            <AppButton
              label="Limpar filtros"
              variant="outline"
              onPress={() =>
                setFilters({
                  page: 1,
                  pageSize: filters.pageSize,
                  q: "",
                  status: "ALL",
                  direction: filters.direction,
                  productId: undefined,
                  expectedFrom: monthRange.from,
                  expectedTo: monthRange.to,
                })
              }
            />
          </View>
          <View className="flex-1">
            <AppButton
              label="Atualizar"
              variant="outline"
              onPress={() => {
                void commissionsQuery.refetch();
              }}
            />
          </View>
        </View>
      </Card>

      <View className="mb-3 flex-row flex-wrap gap-2">
        <View className="min-w-[47%] flex-1 rounded-2xl border border-slate-200 bg-white p-3">
          <Text className="text-[12px] text-slate-500">A receber</Text>
          <Text className="text-[18px] font-semibold text-slate-900">
            {formatCurrencyBRLFromCents(summaryByDirection?.INCOME.total.amount ?? 0)}
          </Text>
          <Text className="text-[12px] text-slate-500">
            Pendentes: {formatCurrencyBRLFromCents(summaryByDirection?.INCOME.pending.amount ?? 0)}
          </Text>
        </View>
        <View className="min-w-[47%] flex-1 rounded-2xl border border-slate-200 bg-white p-3">
          <Text className="text-[12px] text-slate-500">A pagar</Text>
          <Text className="text-[18px] font-semibold text-slate-900">
            {formatCurrencyBRLFromCents(summaryByDirection?.OUTCOME.total.amount ?? 0)}
          </Text>
          <Text className="text-[12px] text-slate-500">
            Pendentes: {formatCurrencyBRLFromCents(summaryByDirection?.OUTCOME.pending.amount ?? 0)}
          </Text>
        </View>
      </View>

      {selectedCount > 0 ? (
        <Card>
          <Text className="mb-2 text-[14px] font-semibold text-slate-900">
            {selectedCount} parcela(s) selecionada(s)
          </Text>
          <View className="flex-row flex-wrap gap-2">
            <View className="min-w-[47%] flex-1">
              <AppButton
                label="Pagar hoje"
                onPress={() => {
                  void handleBulkPay(getTodayIsoDate());
                }}
                loading={isBulkPaying}
              />
            </View>
            <View className="min-w-[47%] flex-1">
              <AppButton
                label="Pagar com data"
                variant="outline"
                onPress={() => setBulkPaymentModalOpen(true)}
              />
            </View>
            <View className="min-w-[47%] flex-1">
              <AppButton
                label="Desfazer pagamentos"
                variant="outline"
                onPress={() => {
                  void handleBulkUndoPayments();
                }}
                loading={isBulkUndoing}
              />
            </View>
            <View className="min-w-[47%] flex-1">
              <AppButton
                label="Limpar seleção"
                variant="outline"
                onPress={() => setSelectedInstallments(new Map())}
              />
            </View>
          </View>
        </Card>
      ) : null}

      {commissionsQuery.isLoading ? (
        <Text className="py-8 text-center text-[14px] text-slate-500">
          Carregando comissões...
        </Text>
      ) : null}

      {commissionsQuery.isError ? (
        <View className="gap-2">
          <EmptyState message="Não foi possível carregar as parcelas de comissão." />
          <AppButton
            label="Tentar novamente"
            variant="outline"
            onPress={() => {
              void commissionsQuery.refetch();
            }}
          />
        </View>
      ) : null}

      {!commissionsQuery.isLoading && !commissionsQuery.isError && items.length === 0 ? (
        <EmptyState message="Nenhuma parcela encontrada para os filtros atuais." />
      ) : null}

      {items.map((installment) => {
        const isSelected = selectedInstallments.has(installment.id);
        const canUpdate = canUpdateInstallments(installment.saleStatus);

        return (
          <Card key={installment.id}>
            <Pressable
              className="mb-2 flex-row items-start justify-between gap-3"
              onPress={() => toggleInstallmentSelection(installment)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isSelected }}
            >
              <View className="flex-1">
                <View className="mb-1 flex-row items-center gap-2">
                  <View
                    className={`h-4 w-4 rounded border ${
                      isSelected ? "border-brand-700 bg-brand-600" : "border-slate-400 bg-white"
                    }`}
                  />
                  <Text className="flex-1 text-[16px] font-semibold text-slate-900">
                    {installment.customer.name}
                  </Text>
                </View>
                <Text className="text-[12px] text-slate-500">
                  {productPathById.get(installment.product.id) ?? installment.product.name}
                </Text>
              </View>

              <View
                className={`rounded-full px-2.5 py-1 ${
                  installment.status === "PAID"
                    ? "bg-emerald-100"
                    : installment.status === "CANCELED"
                      ? "bg-red-100"
                      : "bg-yellow-100"
                }`}
              >
                <Text
                  className={`text-[11px] font-semibold ${
                    installment.status === "PAID"
                      ? "text-emerald-700"
                      : installment.status === "CANCELED"
                        ? "text-red-700"
                        : "text-yellow-700"
                  }`}
                >
                  {SALE_COMMISSION_INSTALLMENT_STATUS_LABEL[installment.status]}
                </Text>
              </View>
            </Pressable>

            <Text className="text-[13px] text-slate-600">
              Beneficiário: {installment.beneficiaryLabel ?? "-"}
            </Text>
            <Text className="text-[13px] text-slate-600">
              {SALE_COMMISSION_SOURCE_TYPE_LABEL[installment.sourceType]} •{" "}
              {SALE_COMMISSION_RECIPIENT_TYPE_LABEL[installment.recipientType]} •{" "}
              {SALE_COMMISSION_DIRECTION_LABEL[installment.direction]}
            </Text>
            <Text className="text-[13px] text-slate-600">
              Valor: {formatCurrencyBRLFromCents(installment.amount)} • Parcela #{installment.installmentNumber}
            </Text>
            <Text className="mb-3 text-[13px] text-slate-600">
              Previsto: {formatDateBR(installment.expectedPaymentDate)} • Pago:{" "}
              {formatDateBR(installment.paymentDate)}
            </Text>

            <View className="flex-row flex-wrap gap-2">
              <View className="min-w-[47%] flex-1">
                <AppButton
                  label="Ver venda"
                  variant="outline"
                  onPress={() =>
                    router.push({
                      pathname: "/sales/[saleId]" as never,
                      params: { saleId: installment.saleId },
                    } as never)
                  }
                />
              </View>
              <View className="min-w-[47%] flex-1">
                <AppButton
                  label="Pagar hoje"
                  disabled={!canPayInstallment(installment)}
                  onPress={() =>
                    setPayAction({
                      installment,
                      paymentDate: getTodayIsoDate(),
                      amount: formatCurrencyBRLFromCents(installment.amount),
                    })
                  }
                />
              </View>
              <View className="min-w-[47%] flex-1">
                <AppButton
                  label="Pagar com data"
                  variant="outline"
                  disabled={!canPayInstallment(installment)}
                  onPress={() =>
                    setPayAction({
                      installment,
                      paymentDate: getTodayIsoDate(),
                      amount: formatCurrencyBRLFromCents(installment.amount),
                    })
                  }
                />
              </View>
              <View className="min-w-[47%] flex-1">
                <AppButton
                  label="Editar parcela"
                  variant="outline"
                  disabled={!canUpdate}
                  onPress={() =>
                    setEditAction({
                      installment,
                      percentage: String(installment.percentage),
                      amount: formatCurrencyBRLFromCents(installment.amount),
                      status: installment.status,
                      expectedPaymentDate: toDateInputValue(installment.expectedPaymentDate),
                      paymentDate: toDateInputValue(installment.paymentDate),
                    })
                  }
                />
              </View>
              <View className="min-w-[47%] flex-1">
                <AppButton
                  label="Desfazer pagamento"
                  variant="outline"
                  disabled={installment.status !== "PAID" || !canUpdate}
                  onPress={() => {
                    void handleUndoPayment(installment);
                  }}
                />
              </View>
              <View className="min-w-[47%] flex-1">
                <AppButton
                  label="Excluir parcela"
                  variant="danger"
                  disabled={!canUpdate}
                  onPress={() => setInstallmentToDelete(installment)}
                />
              </View>
            </View>
          </Card>
        );
      })}

      {pagination ? (
        <Card>
          <Text className="mb-2 text-[13px] text-slate-600">
            Página {pagination.page} de {pagination.totalPages} • {pagination.total} registros
          </Text>
          <View className="mb-2 flex-row gap-2">
            <View className="flex-1">
              <AppButton
                label="Anterior"
                variant="outline"
                disabled={pagination.page <= 1}
                onPress={() =>
                  setFilters((current) => ({
                    ...current,
                    page: Math.max(1, current.page - 1),
                  }))
                }
              />
            </View>
            <View className="flex-1">
              <AppButton
                label="Próxima"
                variant="outline"
                disabled={pagination.page >= pagination.totalPages}
                onPress={() =>
                  setFilters((current) => ({
                    ...current,
                    page: current.page + 1,
                  }))
                }
              />
            </View>
          </View>
          <OptionPicker
            label="Registros por página"
            options={[
              { value: "10", label: "10" },
              { value: "20", label: "20" },
              { value: "50", label: "50" },
            ]}
            value={String(filters.pageSize)}
            onChange={(value) =>
              setFilters((current) => ({
                ...current,
                pageSize: value ? Number(value) : 20,
                page: 1,
              }))
            }
          />
        </Card>
      ) : null}

      <Modal
        visible={Boolean(payAction)}
        transparent
        animationType="fade"
        onRequestClose={() => setPayAction(null)}
      >
        <View className="flex-1 items-center justify-center bg-black/45 px-4">
          <View className="w-full rounded-2xl bg-white p-4">
            <Text className="mb-1 text-[18px] font-bold text-slate-900">Confirmar pagamento</Text>
            <Text className="mb-3 text-[13px] text-slate-500">
              Ajuste a data e o valor antes de confirmar.
            </Text>

            <View className="mb-3 gap-1.5">
              <Text className="text-[13px] font-semibold text-slate-900">Data do pagamento</Text>
              <TextInput
                className="h-11 rounded-xl border border-slate-300 bg-slate-50 px-3.5 text-[15px] text-slate-900"
                value={payAction?.paymentDate ?? ""}
                onChangeText={(value) =>
                  setPayAction((current) =>
                    current
                      ? {
                          ...current,
                          paymentDate: value,
                        }
                      : current,
                  )
                }
                autoCapitalize="none"
                placeholder="YYYY-MM-DD"
              />
            </View>

            <View className="mb-4 gap-1.5">
              <Text className="text-[13px] font-semibold text-slate-900">Valor</Text>
              <TextInput
                className="h-11 rounded-xl border border-slate-300 bg-slate-50 px-3.5 text-[15px] text-slate-900"
                value={payAction?.amount ?? ""}
                onChangeText={(value) =>
                  setPayAction((current) =>
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

            <View className="flex-row gap-2">
              <View className="flex-1">
                <AppButton label="Cancelar" variant="outline" onPress={() => setPayAction(null)} />
              </View>
              <View className="flex-1">
                <AppButton
                  label="Confirmar"
                  loading={updateInstallmentStatusMutation.isPending}
                  onPress={() => {
                    void handleConfirmPayAction();
                  }}
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={Boolean(editAction)}
        transparent
        animationType="fade"
        onRequestClose={() => setEditAction(null)}
      >
        <View className="flex-1 items-center justify-center bg-black/45 px-4">
          <ScrollView className="w-full" contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}>
            <View className="rounded-2xl bg-white p-4">
              <Text className="mb-1 text-[18px] font-bold text-slate-900">Editar parcela</Text>
              <Text className="mb-3 text-[13px] text-slate-500">Atualize os campos da parcela.</Text>

              <View className="mb-3 gap-1.5">
                <Text className="text-[13px] font-semibold text-slate-900">Percentual (%)</Text>
                <TextInput
                  className="h-11 rounded-xl border border-slate-300 bg-slate-50 px-3.5 text-[15px] text-slate-900"
                  value={editAction?.percentage ?? ""}
                  onChangeText={(value) =>
                    setEditAction((current) => (current ? { ...current, percentage: value } : current))
                  }
                  keyboardType="decimal-pad"
                />
              </View>

              <View className="mb-3 gap-1.5">
                <Text className="text-[13px] font-semibold text-slate-900">Valor</Text>
                <TextInput
                  className="h-11 rounded-xl border border-slate-300 bg-slate-50 px-3.5 text-[15px] text-slate-900"
                  value={editAction?.amount ?? ""}
                  onChangeText={(value) =>
                    setEditAction((current) =>
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
                    const isActive = editAction?.status === status;
                    return (
                      <Pressable
                        key={status}
                        className={`rounded-full border px-3 py-1.5 ${
                          isActive ? "border-brand-600 bg-brand-50" : "border-slate-300 bg-white"
                        }`}
                        onPress={() =>
                          setEditAction((current) => (current ? { ...current, status } : current))
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
                  value={editAction?.expectedPaymentDate ?? ""}
                  onChangeText={(value) =>
                    setEditAction((current) =>
                      current ? { ...current, expectedPaymentDate: value } : current,
                    )
                  }
                  autoCapitalize="none"
                  placeholder="YYYY-MM-DD"
                />
              </View>

              {editAction?.status === "PAID" ? (
                <View className="mb-4 gap-1.5">
                  <Text className="text-[13px] font-semibold text-slate-900">Data de pagamento</Text>
                  <TextInput
                    className="h-11 rounded-xl border border-slate-300 bg-slate-50 px-3.5 text-[15px] text-slate-900"
                    value={editAction?.paymentDate ?? ""}
                    onChangeText={(value) =>
                      setEditAction((current) => (current ? { ...current, paymentDate: value } : current))
                    }
                    autoCapitalize="none"
                    placeholder="YYYY-MM-DD"
                  />
                </View>
              ) : null}

              <View className="flex-row gap-2">
                <View className="flex-1">
                  <AppButton label="Cancelar" variant="outline" onPress={() => setEditAction(null)} />
                </View>
                <View className="flex-1">
                  <AppButton
                    label="Salvar"
                    loading={updateInstallmentMutation.isPending}
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
            <Text className="mb-4 text-[13px] text-slate-500">Esta ação não pode ser desfeita.</Text>

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
                    void handleConfirmDelete();
                  }}
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={bulkPaymentModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setBulkPaymentModalOpen(false)}
      >
        <View className="flex-1 items-center justify-center bg-black/45 px-4">
          <View className="w-full rounded-2xl bg-white p-4">
            <Text className="mb-1 text-[18px] font-bold text-slate-900">Pagamento em lote</Text>
            <Text className="mb-3 text-[13px] text-slate-500">
              Informe a data de pagamento para as parcelas selecionadas.
            </Text>

            <View className="mb-4 gap-1.5">
              <Text className="text-[13px] font-semibold text-slate-900">Data</Text>
              <TextInput
                className="h-11 rounded-xl border border-slate-300 bg-slate-50 px-3.5 text-[15px] text-slate-900"
                value={bulkPaymentDate}
                onChangeText={setBulkPaymentDate}
                autoCapitalize="none"
                placeholder="YYYY-MM-DD"
              />
            </View>

            <View className="flex-row gap-2">
              <View className="flex-1">
                <AppButton
                  label="Cancelar"
                  variant="outline"
                  onPress={() => setBulkPaymentModalOpen(false)}
                />
              </View>
              <View className="flex-1">
                <AppButton
                  label="Confirmar"
                  loading={isBulkPaying}
                  onPress={() => {
                    void handleBulkPay(bulkPaymentDate);
                  }}
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </AppScreen>
  );
}
