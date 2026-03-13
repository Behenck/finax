import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Alert, Text, View } from "react-native";
import { AppButton, AppScreen, Card, EmptyState, FormTextField, PageHeader, SearchField } from "@/components/app/ui";
import { useOrganizationSlug } from "@/hooks/use-organization-slug";
import {
  createCostCenter,
  deleteCostCenter,
  listCostCenters,
  registersQueryKeys,
  updateCostCenter,
} from "@/lib/registers";
import { simpleNameSchema, type SimpleNameValues } from "@/lib/registers/form-schemas";
import { normalizeSearchValue } from "@/lib/registers/helpers";
import { getApiErrorMessage } from "@/lib/errors";
import type { CostCenter } from "@/types/registers";

function CostCenterRow({
  costCenter,
  isPending,
  onUpdate,
  onDelete,
}: {
  costCenter: CostCenter;
  isPending: boolean;
  onUpdate: (id: string, name: string) => Promise<void>;
  onDelete: (id: string, name: string) => Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const form = useForm<SimpleNameValues>({
    resolver: zodResolver(simpleNameSchema),
    defaultValues: { name: costCenter.name },
  });

  return (
    <Card>
      {isEditing ? (
        <View>
          <FormTextField control={form.control} name="name" label="Nome do Centro de Custo" />
          <View className="flex-row gap-2">
            <View className="flex-1">
              <AppButton
                label="Cancelar"
                variant="outline"
                onPress={() => {
                  form.reset({ name: costCenter.name });
                  setIsEditing(false);
                }}
                disabled={isPending}
              />
            </View>
            <View className="flex-1">
              <AppButton
                label="Salvar"
                loading={isPending}
                onPress={form.handleSubmit(async (values) => {
                  await onUpdate(costCenter.id, values.name);
                  setIsEditing(false);
                })}
              />
            </View>
          </View>
        </View>
      ) : (
        <View className="flex-row items-center justify-between gap-3">
          <Text className="flex-1 text-[15px] font-semibold text-slate-900">{costCenter.name}</Text>
          <View className="flex-row gap-2">
            <AppButton label="Editar" variant="outline" onPress={() => setIsEditing(true)} />
            <AppButton
              label="Excluir"
              variant="danger"
              loading={isPending}
              onPress={() => {
                void onDelete(costCenter.id, costCenter.name);
              }}
            />
          </View>
        </View>
      )}
    </Card>
  );
}

export default function CostCentersScreen() {
  const slug = useOrganizationSlug();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const costCentersQuery = useQuery({
    queryKey: registersQueryKeys.costCenters(slug),
    queryFn: () => listCostCenters(slug),
  });

  const createMutation = useMutation({
    mutationFn: (name: string) => createCostCenter(slug, name),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: registersQueryKeys.costCenters(slug),
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      updateCostCenter(slug, id, name),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: registersQueryKeys.costCenters(slug),
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCostCenter(slug, id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: registersQueryKeys.costCenters(slug),
      });
    },
  });

  const createForm = useForm<SimpleNameValues>({
    resolver: zodResolver(simpleNameSchema),
    defaultValues: { name: "" },
  });

  const isPending = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  const filteredCostCenters = useMemo(() => {
    const centers = costCentersQuery.data ?? [];
    const query = normalizeSearchValue(search);
    if (!query) {
      return centers;
    }

    return centers.filter((center) => center.name.toLowerCase().includes(query));
  }, [costCentersQuery.data, search]);

  async function runAction(action: () => Promise<void>, fallback: string) {
    try {
      await action();
    } catch (error) {
      Alert.alert("Erro", getApiErrorMessage(error, fallback));
    }
  }

  return (
    <AppScreen>
      <PageHeader
        title="Centros de Custo"
        description="Organize lançamentos por centro de custo."
      />

      <SearchField value={search} onChangeText={setSearch} placeholder="Buscar por nome..." />

      <Card>
        <Text className="mb-2 text-[14px] font-semibold text-slate-900">Novo Centro de Custo</Text>
        <FormTextField control={createForm.control} name="name" label="Nome" />
        <AppButton
          label="Adicionar"
          loading={createMutation.isPending}
          onPress={createForm.handleSubmit(async (values) => {
            await runAction(
              async () => {
                await createMutation.mutateAsync(values.name);
                createForm.reset({ name: "" });
              },
              "Não foi possível criar o centro de custo.",
            );
          })}
        />
      </Card>

      {costCentersQuery.isLoading ? (
        <Text className="py-8 text-center text-[14px] text-slate-500">
          Carregando centros de custo...
        </Text>
      ) : null}
      {costCentersQuery.isError ? <EmptyState message="Erro ao carregar centros de custo." /> : null}
      {!costCentersQuery.isLoading && !costCentersQuery.isError && filteredCostCenters.length === 0 ? (
        <EmptyState message="Nenhum centro de custo encontrado." />
      ) : null}

      {filteredCostCenters.map((costCenter) => (
        <CostCenterRow
          key={costCenter.id}
          costCenter={costCenter}
          isPending={isPending}
          onUpdate={(id, name) =>
            runAction(
              async () => {
                await updateMutation.mutateAsync({ id, name });
              },
              "Não foi possível atualizar o centro de custo.",
            )
          }
          onDelete={(id, name) =>
            runAction(
              async () => {
                Alert.alert("Excluir centro de custo", `Deseja excluir "${name}"?`, [
                  { text: "Cancelar", style: "cancel" },
                  {
                    text: "Excluir",
                    style: "destructive",
                    onPress: () => {
                      void deleteMutation.mutateAsync(id).catch((error) => {
                        Alert.alert(
                          "Erro",
                          getApiErrorMessage(
                            error,
                            "Não foi possível excluir o centro de custo.",
                          ),
                        );
                      });
                    },
                  },
                ]);
              },
              "Não foi possível excluir o centro de custo.",
            )
          }
        />
      ))}
    </AppScreen>
  );
}
