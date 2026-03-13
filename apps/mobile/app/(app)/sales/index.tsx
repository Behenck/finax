import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { OptionPicker } from "@/components/app/option-picker";
import { AppButton, AppScreen, Card, EmptyState, PageHeader, SearchField } from "@/components/app/ui";
import { SaleInstallmentsModal } from "@/components/sales/sale-installments-modal";
import { SaleStatusAction } from "@/components/sales/sale-status-action";
import { SaleStatusBadge } from "@/components/sales/sale-status-badge";
import { useOrganizationSlug } from "@/hooks/use-organization-slug";
import { getApiErrorMessage } from "@/lib/errors";
import { listProducts, registersQueryKeys } from "@/lib/registers";
import {
  SALE_STATUS_LABEL,
  buildProductPathMap,
  commissionsQueryKeys,
  deleteSale,
  formatCurrencyBRLFromCents,
  formatDateBR,
  listSales,
  normalizeSearchValue,
  patchSaleStatus,
  patchSalesStatusBulk,
  salesQueryKeys,
  type SaleListItem,
  type SaleStatus,
} from "@/lib/sales";

type SaleStatusFilter = "ALL" | SaleStatus;

type EnrichedSale = SaleListItem & {
  productLabel: string;
};

const STATUS_FILTERS: SaleStatusFilter[] = [
  "ALL",
  "PENDING",
  "APPROVED",
  "COMPLETED",
  "CANCELED",
];

const STATUS_SORT_PRIORITY: Record<SaleStatus, number> = {
  PENDING: 0,
  APPROVED: 1,
  COMPLETED: 2,
  CANCELED: 3,
};

const BULK_STATUS_OPTIONS: { label: string; value: SaleStatus }[] = [
  { label: SALE_STATUS_LABEL.PENDING, value: "PENDING" },
  { label: SALE_STATUS_LABEL.APPROVED, value: "APPROVED" },
  { label: SALE_STATUS_LABEL.COMPLETED, value: "COMPLETED" },
  { label: SALE_STATUS_LABEL.CANCELED, value: "CANCELED" },
];

export default function SalesListScreen() {
  const slug = useOrganizationSlug();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<SaleStatusFilter>("ALL");
  const [selectedSaleIds, setSelectedSaleIds] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState<SaleStatus | "">("");
  const [installmentsSale, setInstallmentsSale] = useState<SaleListItem | null>(null);
  const [statusPendingSaleId, setStatusPendingSaleId] = useState<string | null>(null);
  const [deletePendingSaleId, setDeletePendingSaleId] = useState<string | null>(null);

  const salesQuery = useQuery({
    queryKey: salesQueryKeys.list(slug),
    queryFn: () => listSales(slug),
  });

  const productsQuery = useQuery({
    queryKey: registersQueryKeys.products(slug),
    queryFn: () => listProducts(slug),
  });

  const patchStatusMutation = useMutation({
    mutationFn: ({
      saleId,
      status,
    }: {
      saleId: string;
      status: SaleStatus;
    }) => patchSaleStatus(slug, saleId, status),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: salesQueryKeys.list(slug) }),
        queryClient.invalidateQueries({ queryKey: salesQueryKeys.dashboard(slug, { month: "" }) }),
        queryClient.invalidateQueries({ queryKey: commissionsQueryKeys.root }),
      ]);
    },
  });

  const patchBulkStatusMutation = useMutation({
    mutationFn: ({
      saleIds,
      status,
    }: {
      saleIds: string[];
      status: SaleStatus;
    }) => patchSalesStatusBulk(slug, saleIds, status),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: salesQueryKeys.list(slug) }),
        queryClient.invalidateQueries({ queryKey: salesQueryKeys.dashboard(slug, { month: "" }) }),
        queryClient.invalidateQueries({ queryKey: commissionsQueryKeys.root }),
      ]);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (saleId: string) => deleteSale(slug, saleId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: salesQueryKeys.list(slug) }),
        queryClient.invalidateQueries({ queryKey: salesQueryKeys.dashboard(slug, { month: "" }) }),
        queryClient.invalidateQueries({ queryKey: commissionsQueryKeys.root }),
      ]);
    },
  });

  const productPathById = useMemo(
    () => buildProductPathMap(productsQuery.data ?? []),
    [productsQuery.data],
  );

  const filteredSales = useMemo<EnrichedSale[]>(() => {
    const normalizedQuery = normalizeSearchValue(search);

    return (salesQuery.data ?? [])
      .map((sale) => ({
        ...sale,
        productLabel: productPathById.get(sale.product.id) ?? sale.product.name,
      }))
      .sort((saleA, saleB) => {
        const statusDiff =
          (STATUS_SORT_PRIORITY[saleA.status] ?? Number.MAX_SAFE_INTEGER) -
          (STATUS_SORT_PRIORITY[saleB.status] ?? Number.MAX_SAFE_INTEGER);

        if (statusDiff !== 0) {
          return statusDiff;
        }

        return saleB.createdAt.localeCompare(saleA.createdAt);
      })
      .filter((sale) => {
        if (statusFilter !== "ALL" && sale.status !== statusFilter) {
          return false;
        }

        if (!normalizedQuery) {
          return true;
        }

        const searchable = [
          sale.customer.name,
          sale.productLabel,
          sale.company.name,
          sale.unit?.name ?? "",
          sale.responsible?.name ?? "",
          sale.notes ?? "",
          SALE_STATUS_LABEL[sale.status],
        ]
          .join(" ")
          .toLowerCase();

        return searchable.includes(normalizedQuery);
      });
  }, [productPathById, salesQuery.data, search, statusFilter]);

  useEffect(() => {
    const existingIds = new Set(filteredSales.map((sale) => sale.id));
    setSelectedSaleIds((current) => current.filter((saleId) => existingIds.has(saleId)));
  }, [filteredSales]);

  const selectedAllVisible =
    filteredSales.length > 0 && filteredSales.every((sale) => selectedSaleIds.includes(sale.id));

  function toggleSaleSelection(saleId: string) {
    setSelectedSaleIds((current) => {
      if (current.includes(saleId)) {
        return current.filter((currentId) => currentId !== saleId);
      }

      return [...current, saleId];
    });
  }

  function toggleSelectAllVisible() {
    if (selectedAllVisible) {
      setSelectedSaleIds((current) =>
        current.filter((saleId) => !filteredSales.some((sale) => sale.id === saleId)),
      );
      return;
    }

    const next = new Set(selectedSaleIds);
    for (const sale of filteredSales) {
      next.add(sale.id);
    }
    setSelectedSaleIds(Array.from(next));
  }

  async function handlePatchStatus(saleId: string, status: SaleStatus) {
    setStatusPendingSaleId(saleId);

    try {
      await patchStatusMutation.mutateAsync({ saleId, status });
    } catch (error) {
      Alert.alert("Erro", getApiErrorMessage(error, "Não foi possível alterar o status."));
    } finally {
      setStatusPendingSaleId(null);
    }
  }

  async function handleApplyBulkStatus() {
    if (!bulkStatus || selectedSaleIds.length === 0) {
      return;
    }

    try {
      const updated = await patchBulkStatusMutation.mutateAsync({
        saleIds: selectedSaleIds,
        status: bulkStatus,
      });
      Alert.alert("Status atualizado", `${updated} venda(s) atualizada(s).`);
      setSelectedSaleIds([]);
      setBulkStatus("");
    } catch (error) {
      Alert.alert(
        "Erro",
        getApiErrorMessage(error, "Não foi possível alterar o status em lote."),
      );
    }
  }

  function handleDeleteSale(saleId: string, customerName: string) {
    Alert.alert("Excluir venda", `Deseja excluir a venda de "${customerName}"?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: () => {
          setDeletePendingSaleId(saleId);
          void deleteMutation.mutateAsync(saleId).catch((error) => {
            Alert.alert("Erro", getApiErrorMessage(error, "Não foi possível excluir a venda."));
          }).finally(() => {
            setDeletePendingSaleId(null);
          });
        },
      },
    ]);
  }

  return (
    <AppScreen>
      <PageHeader
        title="Vendas"
        description="Gerencie, filtre e atualize o ciclo completo das vendas."
        action={<AppButton label="Nova venda" onPress={() => router.push("/sales/create" as never)} />}
      />

      <SearchField
        value={search}
        onChangeText={setSearch}
        placeholder="Buscar por cliente, produto, responsável..."
      />

      <View className="mb-3 flex-row flex-wrap gap-2">
        {STATUS_FILTERS.map((status) => {
          const isActive = statusFilter === status;
          const label = status === "ALL" ? "Todos" : SALE_STATUS_LABEL[status];

          return (
            <Pressable
              key={status}
              className={`rounded-full border px-3 py-1.5 ${
                isActive ? "border-brand-600 bg-brand-50" : "border-slate-300 bg-white"
              }`}
              onPress={() => setStatusFilter(status)}
            >
              <Text
                className={`text-[12px] font-medium ${
                  isActive ? "text-brand-700" : "text-slate-700"
                }`}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {selectedSaleIds.length > 0 ? (
        <Card>
          <Text className="mb-2 text-[14px] font-semibold text-slate-900">
            {selectedSaleIds.length} venda(s) selecionada(s)
          </Text>
          <OptionPicker
            label="Novo status em lote"
            placeholder="Selecionar status"
            options={BULK_STATUS_OPTIONS}
            value={bulkStatus || undefined}
            onChange={(value) => setBulkStatus((value as SaleStatus | undefined) ?? "")}
          />
          <View className="flex-row gap-2">
            <View className="flex-1">
              <AppButton
                label="Limpar seleção"
                variant="outline"
                onPress={() => setSelectedSaleIds([])}
              />
            </View>
            <View className="flex-1">
              <AppButton
                label="Aplicar status"
                loading={patchBulkStatusMutation.isPending}
                disabled={!bulkStatus}
                onPress={() => {
                  void handleApplyBulkStatus();
                }}
              />
            </View>
          </View>
        </Card>
      ) : null}

      <View className="mb-3 flex-row items-center justify-between">
        <Text className="text-[13px] text-slate-600">{filteredSales.length} venda(s)</Text>
        {filteredSales.length > 0 ? (
          <Pressable onPress={toggleSelectAllVisible}>
            <Text className="text-[13px] font-semibold text-brand-700">
              {selectedAllVisible ? "Desmarcar visíveis" : "Selecionar visíveis"}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {salesQuery.isLoading ? (
        <Text className="py-8 text-center text-[14px] text-slate-500">Carregando vendas...</Text>
      ) : null}

      {salesQuery.isError ? (
        <View className="gap-2">
          <EmptyState message="Não foi possível carregar as vendas." />
          <AppButton
            label="Tentar novamente"
            variant="outline"
            onPress={() => {
              void salesQuery.refetch();
            }}
          />
        </View>
      ) : null}

      {!salesQuery.isLoading && !salesQuery.isError && filteredSales.length === 0 ? (
        <EmptyState message="Nenhuma venda encontrada para os filtros atuais." />
      ) : null}

      {filteredSales.map((sale) => {
        const isSelected = selectedSaleIds.includes(sale.id);
        const isDeleting = deletePendingSaleId === sale.id && deleteMutation.isPending;
        const isStatusPending = statusPendingSaleId === sale.id && patchStatusMutation.isPending;

        return (
          <Card key={sale.id}>
            <View className="mb-3 flex-row items-start justify-between gap-3">
              <Pressable
                className="flex-1"
                onPress={() => toggleSaleSelection(sale.id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isSelected }}
              >
                <View className="mb-1 flex-row items-center gap-2">
                  <View
                    className={`h-4 w-4 rounded border ${
                      isSelected ? "border-brand-700 bg-brand-600" : "border-slate-400 bg-white"
                    }`}
                  />
                  <Text className="flex-1 text-[16px] font-semibold text-slate-900">
                    {sale.customer.name}
                  </Text>
                </View>
                <Text className="text-[12px] text-slate-500">{sale.productLabel}</Text>
              </Pressable>

              <SaleStatusBadge status={sale.status} />
            </View>

            <Text className="text-[13px] text-slate-600">
              Valor: {formatCurrencyBRLFromCents(sale.totalAmount)}
            </Text>
            <Text className="text-[13px] text-slate-600">
              Data: {formatDateBR(sale.saleDate)} • Empresa: {sale.company.name}
            </Text>
            <Text className="text-[13px] text-slate-600">
              Responsável: {sale.responsible?.name ?? "-"} • Unidade: {sale.unit?.name ?? "-"}
            </Text>
            <Text className="mb-3 text-[13px] text-slate-600">
              Parcelas: {sale.commissionInstallmentsSummary.paid}/
              {sale.commissionInstallmentsSummary.total} pagas
            </Text>

            <View className="mb-2 flex-row flex-wrap gap-2">
              <View className="min-w-[47%] flex-1">
                <AppButton
                  label="Ver detalhes"
                  variant="outline"
                  onPress={() =>
                    router.push({
                      pathname: "/sales/[saleId]" as never,
                      params: { saleId: sale.id },
                    } as never)
                  }
                />
              </View>
              <View className="min-w-[47%] flex-1">
                <AppButton
                  label="Editar"
                  variant="outline"
                  onPress={() =>
                    router.push({
                      pathname: "/sales/[saleId]/edit" as never,
                      params: { saleId: sale.id },
                    } as never)
                  }
                />
              </View>
              <View className="min-w-[47%] flex-1">
                <AppButton
                  label="Duplicar"
                  variant="outline"
                  onPress={() =>
                    router.push({
                      pathname: "/sales/create" as never,
                      params: { duplicateSaleId: sale.id },
                    } as never)
                  }
                />
              </View>
              <View className="min-w-[47%] flex-1">
                <AppButton
                  label="Parcelas"
                  variant="outline"
                  onPress={() => setInstallmentsSale(sale)}
                />
              </View>
            </View>

            <View className="flex-row flex-wrap gap-2">
              <View className="min-w-[47%] flex-1">
                <SaleStatusAction
                  currentStatus={sale.status}
                  loading={isStatusPending}
                  onConfirm={(status) => handlePatchStatus(sale.id, status)}
                />
              </View>
              <View className="min-w-[47%] flex-1">
                <AppButton
                  label="Excluir"
                  variant="danger"
                  loading={isDeleting}
                  onPress={() => handleDeleteSale(sale.id, sale.customer.name)}
                />
              </View>
            </View>
          </Card>
        );
      })}

      <SaleInstallmentsModal
        open={Boolean(installmentsSale)}
        onClose={() => setInstallmentsSale(null)}
        saleId={installmentsSale?.id ?? ""}
        saleStatus={installmentsSale?.status ?? "PENDING"}
      />
    </AppScreen>
  );
}
