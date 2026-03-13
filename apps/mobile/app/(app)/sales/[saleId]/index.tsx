import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Text, View } from "react-native";
import { AppButton, AppScreen, Card, EmptyState, PageHeader } from "@/components/app/ui";
import { SaleInstallmentsModal } from "@/components/sales/sale-installments-modal";
import { SaleStatusAction } from "@/components/sales/sale-status-action";
import { SaleStatusBadge } from "@/components/sales/sale-status-badge";
import { useOrganizationSlug } from "@/hooks/use-organization-slug";
import { getApiErrorMessage } from "@/lib/errors";
import { listProducts, registersQueryKeys } from "@/lib/registers";
import {
  SALE_COMMISSION_DIRECTION_LABEL,
  SALE_COMMISSION_RECIPIENT_TYPE_LABEL,
  SALE_COMMISSION_SOURCE_TYPE_LABEL,
  SALE_RESPONSIBLE_TYPE_LABEL,
  buildProductPathMap,
  commissionsQueryKeys,
  deleteSale,
  formatCurrencyBRLFromCents,
  formatDateBR,
  formatDateTimeBR,
  getSale,
  listSaleHistory,
  patchSaleStatus,
  salesQueryKeys,
  type SaleDetail,
  type SaleHistoryEvent,
  type SaleStatus,
} from "@/lib/sales";

const SALE_HISTORY_ACTION_LABEL: Record<SaleHistoryEvent["action"], string> = {
  CREATED: "Venda criada",
  UPDATED: "Venda atualizada",
  STATUS_CHANGED: "Status alterado",
  COMMISSION_INSTALLMENT_UPDATED: "Parcela de comissão atualizada",
  COMMISSION_INSTALLMENT_STATUS_UPDATED: "Status de parcela alterado",
  COMMISSION_INSTALLMENT_DELETED: "Parcela de comissão excluída",
};

function formatDynamicFieldValue(
  field: SaleDetail["dynamicFieldSchema"][number],
  rawValue: unknown,
) {
  if (rawValue == null || rawValue === "") {
    return "-";
  }

  if (field.type === "SELECT") {
    const value = String(rawValue);
    return field.options.find((option) => option.id === value)?.label ?? value;
  }

  if (field.type === "MULTI_SELECT") {
    if (!Array.isArray(rawValue)) {
      return "-";
    }

    const labels = rawValue
      .map((value) => field.options.find((option) => option.id === String(value))?.label)
      .filter((value): value is string => Boolean(value));

    return labels.length > 0 ? labels.join(", ") : "-";
  }

  if (field.type === "CURRENCY") {
    const numericValue =
      typeof rawValue === "number" ? rawValue : Number(String(rawValue).replace(/\D/g, ""));
    if (!Number.isFinite(numericValue)) {
      return String(rawValue);
    }
    return formatCurrencyBRLFromCents(Math.round(numericValue));
  }

  return String(rawValue);
}

export default function SaleDetailsScreen() {
  const params = useLocalSearchParams<{ saleId?: string | string[] }>();
  const saleId = Array.isArray(params.saleId) ? params.saleId[0] : params.saleId;
  const slug = useOrganizationSlug();
  const queryClient = useQueryClient();
  const [installmentsOpen, setInstallmentsOpen] = useState(false);
  const [isStatusUpdating, setIsStatusUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const saleQuery = useQuery({
    queryKey: saleId ? salesQueryKeys.detail(slug, saleId) : ["sales", "detail", "invalid-id"],
    queryFn: () => getSale(slug, saleId!),
    enabled: Boolean(saleId),
  });

  const historyQuery = useQuery({
    queryKey: saleId ? salesQueryKeys.history(slug, saleId) : ["sales", "history", "invalid-id"],
    queryFn: () => listSaleHistory(slug, saleId!),
    enabled: Boolean(saleId),
  });

  const productsQuery = useQuery({
    queryKey: registersQueryKeys.products(slug),
    queryFn: () => listProducts(slug),
  });

  const patchStatusMutation = useMutation({
    mutationFn: (status: SaleStatus) => patchSaleStatus(slug, saleId!, status),
    onSuccess: async () => {
      if (!saleId) {
        return;
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: salesQueryKeys.list(slug) }),
        queryClient.invalidateQueries({ queryKey: salesQueryKeys.detail(slug, saleId) }),
        queryClient.invalidateQueries({ queryKey: salesQueryKeys.history(slug, saleId) }),
        queryClient.invalidateQueries({ queryKey: salesQueryKeys.dashboard(slug, { month: "" }) }),
        queryClient.invalidateQueries({ queryKey: commissionsQueryKeys.root }),
      ]);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteSale(slug, saleId!),
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

  async function handlePatchStatus(status: SaleStatus) {
    if (!saleId) {
      return;
    }

    setIsStatusUpdating(true);

    try {
      await patchStatusMutation.mutateAsync(status);
    } catch (error) {
      Alert.alert("Erro", getApiErrorMessage(error, "Não foi possível alterar o status."));
    } finally {
      setIsStatusUpdating(false);
    }
  }

  function handleDeleteSale() {
    if (!saleId) {
      return;
    }

    Alert.alert("Excluir venda", "Esta ação não pode ser desfeita. Deseja continuar?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: () => {
          setIsDeleting(true);
          void deleteMutation
            .mutateAsync()
            .then(() => {
              router.replace("/sales" as never);
            })
            .catch((error) => {
              Alert.alert("Erro", getApiErrorMessage(error, "Não foi possível excluir a venda."));
            })
            .finally(() => {
              setIsDeleting(false);
            });
        },
      },
    ]);
  }

  if (!saleId) {
    return (
      <AppScreen>
        <Card>
          <Text className="text-[14px] text-red-700">ID da venda inválido.</Text>
        </Card>
      </AppScreen>
    );
  }

  if (saleQuery.isLoading) {
    return (
      <AppScreen>
        <Text className="py-8 text-center text-[14px] text-slate-500">Carregando venda...</Text>
      </AppScreen>
    );
  }

  if (saleQuery.isError || !saleQuery.data) {
    return (
      <AppScreen>
        <View className="gap-2">
          <EmptyState message="Não foi possível carregar a venda." />
          <AppButton
            label="Tentar novamente"
            variant="outline"
            onPress={() => {
              void saleQuery.refetch();
            }}
          />
        </View>
      </AppScreen>
    );
  }

  const sale = saleQuery.data;
  const saleProductPath = productPathById.get(sale.product.id) ?? sale.product.name;
  const dynamicFields = sale.dynamicFieldSchema.map((field) => ({
    ...field,
    value: Object.prototype.hasOwnProperty.call(sale.dynamicFieldValues, field.fieldId)
      ? sale.dynamicFieldValues[field.fieldId]
      : undefined,
  }));

  return (
    <AppScreen>
      <PageHeader
        title="Detalhes da Venda"
        description={`Código da venda: ${sale.id}`}
        action={
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
        }
      />

      <View className="mb-3 flex-row flex-wrap gap-2">
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
            onPress={() => setInstallmentsOpen(true)}
          />
        </View>
        <View className="min-w-[47%] flex-1">
          <SaleStatusAction
            currentStatus={sale.status}
            loading={isStatusUpdating}
            onConfirm={handlePatchStatus}
          />
        </View>
        <View className="min-w-[47%] flex-1">
          <AppButton
            label="Excluir"
            variant="danger"
            loading={isDeleting}
            onPress={handleDeleteSale}
          />
        </View>
      </View>

      <Card>
        <View className="mb-2 flex-row items-center justify-between gap-2">
          <Text className="flex-1 text-[17px] font-semibold text-slate-900">{saleProductPath}</Text>
          <SaleStatusBadge status={sale.status} />
        </View>
        <Text className="text-[13px] text-slate-600">Data: {formatDateBR(sale.saleDate)}</Text>
        <Text className="text-[13px] text-slate-600">
          Valor total: {formatCurrencyBRLFromCents(sale.totalAmount)}
        </Text>
        <Text className="text-[13px] text-slate-600">
          Criado em: {formatDateTimeBR(sale.createdAt)}
        </Text>
      </Card>

      <Card>
        <Text className="mb-2 text-[14px] font-semibold text-slate-900">Relacionamentos</Text>
        <Text className="text-[13px] text-slate-600">Cliente: {sale.customer.name}</Text>
        <Text className="text-[13px] text-slate-600">Empresa: {sale.company.name}</Text>
        <Text className="text-[13px] text-slate-600">Unidade: {sale.unit?.name ?? "-"}</Text>
        <Text className="text-[13px] text-slate-600">
          Responsável: {sale.responsible?.name ?? "-"} (
          {SALE_RESPONSIBLE_TYPE_LABEL[sale.responsibleType]})
        </Text>
      </Card>

      <Card>
        <Text className="mb-2 text-[14px] font-semibold text-slate-900">Campos dinâmicos</Text>
        {dynamicFields.length === 0 ? (
          <Text className="text-[13px] text-slate-500">Sem campos personalizados.</Text>
        ) : (
          dynamicFields.map((field) => (
            <View key={field.fieldId} className="mb-2">
              <Text className="text-[12px] font-semibold text-slate-700">{field.label}</Text>
              <Text className="text-[13px] text-slate-600">
                {formatDynamicFieldValue(field, field.value)}
              </Text>
            </View>
          ))
        )}
      </Card>

      <Card>
        <Text className="mb-2 text-[14px] font-semibold text-slate-900">Comissões</Text>
        {sale.commissions.length === 0 ? (
          <Text className="text-[13px] text-slate-500">Sem comissões cadastradas.</Text>
        ) : (
          sale.commissions.map((commission) => (
            <View key={commission.id} className="mb-3 rounded-xl border border-slate-200 p-3">
              <Text className="text-[13px] font-semibold text-slate-900">
                {SALE_COMMISSION_SOURCE_TYPE_LABEL[commission.sourceType]} •{" "}
                {SALE_COMMISSION_RECIPIENT_TYPE_LABEL[commission.recipientType]} •{" "}
                {SALE_COMMISSION_DIRECTION_LABEL[commission.direction]}
              </Text>
              <Text className="text-[13px] text-slate-600">
                Beneficiário: {commission.beneficiaryLabel ?? "-"}
              </Text>
              <Text className="text-[13px] text-slate-600">
                Percentual total: {commission.totalPercentage}%
              </Text>
              <Text className="text-[13px] text-slate-600">
                Valor: {formatCurrencyBRLFromCents(commission.totalAmount)}
              </Text>
              <Text className="mb-2 text-[13px] text-slate-600">
                Início: {formatDateBR(commission.startDate)}
              </Text>
              {commission.installments.map((installment) => (
                <Text key={`${commission.id}-${installment.installmentNumber}`} className="text-[12px] text-slate-500">
                  Parcela {installment.installmentNumber}: {installment.percentage}% •{" "}
                  {formatCurrencyBRLFromCents(installment.amount)} •{" "}
                  {formatDateBR(installment.expectedPaymentDate)} • {installment.status}
                </Text>
              ))}
            </View>
          ))
        )}
      </Card>

      <Card>
        <Text className="mb-2 text-[14px] font-semibold text-slate-900">Histórico</Text>
        {historyQuery.isLoading ? (
          <Text className="text-[13px] text-slate-500">Carregando histórico...</Text>
        ) : historyQuery.isError ? (
          <View className="gap-2">
            <Text className="text-[13px] text-red-600">Erro ao carregar histórico.</Text>
            <AppButton
              label="Tentar novamente"
              variant="outline"
              onPress={() => {
                void historyQuery.refetch();
              }}
            />
          </View>
        ) : (historyQuery.data ?? []).length === 0 ? (
          <Text className="text-[13px] text-slate-500">Nenhum evento registrado.</Text>
        ) : (
          (historyQuery.data ?? []).map((event) => (
            <View key={event.id} className="mb-3 rounded-xl border border-slate-200 p-3">
              <Text className="text-[13px] font-semibold text-slate-900">
                {SALE_HISTORY_ACTION_LABEL[event.action]}
              </Text>
              <Text className="text-[12px] text-slate-500">
                {formatDateTimeBR(event.createdAt)} • {event.actor.name ?? "Usuário"}
              </Text>
              {event.changes.slice(0, 6).map((change, index) => (
                <Text key={`${event.id}-${change.path}-${index}`} className="text-[12px] text-slate-600">
                  {change.path}: {String(change.before ?? "-")} → {String(change.after ?? "-")}
                </Text>
              ))}
            </View>
          ))
        )}
      </Card>

      <SaleInstallmentsModal
        open={installmentsOpen}
        onClose={() => setInstallmentsOpen(false)}
        saleId={sale.id}
        saleStatus={sale.status}
      />
    </AppScreen>
  );
}
