import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Text, View } from "react-native";
import { AppButton, AppScreen, Card, EmptyState, PageHeader, SearchField } from "@/components/app/ui";
import { useOrganizationSlug } from "@/hooks/use-organization-slug";
import { deleteSeller, listSellers, registersQueryKeys } from "@/lib/registers";
import { normalizeSearchValue } from "@/lib/registers/helpers";
import { getApiErrorMessage } from "@/lib/errors";

export default function SellersScreen() {
  const slug = useOrganizationSlug();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const sellersQuery = useQuery({
    queryKey: registersQueryKeys.sellers(slug),
    queryFn: () => listSellers(slug),
  });

  const deleteMutation = useMutation({
    mutationFn: (sellerId: string) => deleteSeller(slug, sellerId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: registersQueryKeys.sellers(slug) });
    },
  });

  const sellers = useMemo(() => sellersQuery.data ?? [], [sellersQuery.data]);
  const filteredSellers = useMemo(() => {
    const query = normalizeSearchValue(search);
    if (!query) {
      return sellers;
    }

    return sellers.filter((seller) => {
      return (
        seller.name.toLowerCase().includes(query) ||
        seller.email.toLowerCase().includes(query) ||
        seller.document.toLowerCase().includes(query) ||
        seller.companyName.toLowerCase().includes(query)
      );
    });
  }, [search, sellers]);

  function handleDelete(sellerId: string, sellerName: string) {
    Alert.alert("Excluir vendedor", `Deseja excluir "${sellerName}"?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: () => {
          void (async () => {
            try {
              await deleteMutation.mutateAsync(sellerId);
            } catch (error) {
              Alert.alert(
                "Erro",
                getApiErrorMessage(error, "Não foi possível excluir o vendedor."),
              );
            }
          })();
        },
      },
    ]);
  }

  return (
    <AppScreen>
      <PageHeader
        title="Vendedores"
        description="Gerencie os vendedores vinculados à organização."
        action={<AppButton label="Novo" onPress={() => router.push("/registers/sellers/create")} />}
      />

      <SearchField value={search} onChangeText={setSearch} placeholder="Buscar por nome, empresa ou documento..." />

      {sellersQuery.isLoading ? (
        <Text className="py-8 text-center text-[14px] text-slate-500">Carregando vendedores...</Text>
      ) : null}

      {sellersQuery.isError ? <EmptyState message="Erro ao carregar vendedores." /> : null}

      {!sellersQuery.isLoading && !sellersQuery.isError && filteredSellers.length === 0 ? (
        <EmptyState message="Nenhum vendedor encontrado." />
      ) : null}

      {filteredSellers.map((seller) => (
        <Card key={seller.id}>
          <View className="mb-2 flex-row items-start justify-between">
            <View className="flex-1 pr-3">
              <Text className="text-[16px] font-semibold text-slate-900">{seller.name}</Text>
              <Text className="text-[12px] text-slate-500">
                {seller.documentType}: {seller.document}
              </Text>
            </View>
            <View
              className={`rounded-full px-2.5 py-1 ${
                seller.status === "ACTIVE" ? "bg-emerald-100" : "bg-amber-100"
              }`}
            >
              <Text
                className={`text-[11px] font-semibold ${
                  seller.status === "ACTIVE" ? "text-emerald-700" : "text-amber-700"
                }`}
              >
                {seller.status === "ACTIVE" ? "Ativo" : "Inativo"}
              </Text>
            </View>
          </View>

          <Text className="text-[13px] text-slate-600">Empresa: {seller.companyName}</Text>
          <Text className="text-[13px] text-slate-600">E-mail: {seller.email}</Text>
          <Text className="mb-3 text-[13px] text-slate-600">Telefone: {seller.phone}</Text>

          <View className="flex-row gap-2">
            <View className="flex-1">
              <AppButton
                label="Editar"
                variant="outline"
                onPress={() => router.push(`/registers/sellers/${seller.id}/edit`)}
              />
            </View>
            <View className="flex-1">
              <AppButton
                label="Excluir"
                variant="danger"
                loading={deleteMutation.isPending}
                onPress={() => handleDelete(seller.id, seller.name)}
              />
            </View>
          </View>
        </Card>
      ))}
    </AppScreen>
  );
}
