import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Text, View } from "react-native";
import { AppButton, AppScreen, Card, EmptyState, PageHeader, SearchField } from "@/components/app/ui";
import { useOrganizationSlug } from "@/hooks/use-organization-slug";
import { deletePartner, listPartners, registersQueryKeys } from "@/lib/registers";
import { normalizeSearchValue } from "@/lib/registers/helpers";
import { getApiErrorMessage } from "@/lib/errors";

export default function PartnersScreen() {
  const slug = useOrganizationSlug();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const partnersQuery = useQuery({
    queryKey: registersQueryKeys.partners(slug),
    queryFn: () => listPartners(slug),
  });

  const deleteMutation = useMutation({
    mutationFn: (partnerId: string) => deletePartner(slug, partnerId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: registersQueryKeys.partners(slug) });
    },
  });

  const partners = useMemo(() => partnersQuery.data ?? [], [partnersQuery.data]);
  const filteredPartners = useMemo(() => {
    const query = normalizeSearchValue(search);
    if (!query) {
      return partners;
    }

    return partners.filter((partner) => {
      return (
        partner.name.toLowerCase().includes(query) ||
        partner.email.toLowerCase().includes(query) ||
        partner.document.toLowerCase().includes(query) ||
        partner.companyName.toLowerCase().includes(query)
      );
    });
  }, [partners, search]);

  function handleDelete(partnerId: string, partnerName: string) {
    Alert.alert("Excluir parceiro", `Deseja excluir "${partnerName}"?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: () => {
          void (async () => {
            try {
              await deleteMutation.mutateAsync(partnerId);
            } catch (error) {
              Alert.alert(
                "Erro",
                getApiErrorMessage(error, "Não foi possível excluir o parceiro."),
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
        title="Parceiros"
        description="Gerencie parceiros e supervisões comerciais."
        action={<AppButton label="Novo" onPress={() => router.push("/registers/partners/create")} />}
      />

      <SearchField
        value={search}
        onChangeText={setSearch}
        placeholder="Buscar por nome, empresa ou documento..."
      />

      {partnersQuery.isLoading ? (
        <Text className="py-8 text-center text-[14px] text-slate-500">Carregando parceiros...</Text>
      ) : null}
      {partnersQuery.isError ? <EmptyState message="Erro ao carregar parceiros." /> : null}
      {!partnersQuery.isLoading && !partnersQuery.isError && filteredPartners.length === 0 ? (
        <EmptyState message="Nenhum parceiro encontrado." />
      ) : null}

      {filteredPartners.map((partner) => (
        <Card key={partner.id}>
          <View className="mb-2 flex-row items-start justify-between">
            <View className="flex-1 pr-3">
              <Text className="text-[16px] font-semibold text-slate-900">{partner.name}</Text>
              <Text className="text-[12px] text-slate-500">
                {partner.documentType}: {partner.document}
              </Text>
            </View>
            <View
              className={`rounded-full px-2.5 py-1 ${
                partner.status === "ACTIVE" ? "bg-emerald-100" : "bg-amber-100"
              }`}
            >
              <Text
                className={`text-[11px] font-semibold ${
                  partner.status === "ACTIVE" ? "text-emerald-700" : "text-amber-700"
                }`}
              >
                {partner.status === "ACTIVE" ? "Ativo" : "Inativo"}
              </Text>
            </View>
          </View>

          <Text className="text-[13px] text-slate-600">Empresa: {partner.companyName}</Text>
          <Text className="text-[13px] text-slate-600">E-mail: {partner.email}</Text>
          <Text className="text-[13px] text-slate-600">Supervisor: {partner.supervisor?.name ?? "-"}</Text>
          <Text className="mb-3 text-[13px] text-slate-600">Telefone: {partner.phone}</Text>

          <View className="flex-row gap-2">
            <View className="flex-1">
              <AppButton
                label="Editar"
                variant="outline"
                onPress={() => router.push(`/registers/partners/${partner.id}/edit`)}
              />
            </View>
            <View className="flex-1">
              <AppButton
                label="Excluir"
                variant="danger"
                loading={deleteMutation.isPending}
                onPress={() => handleDelete(partner.id, partner.name)}
              />
            </View>
          </View>
        </Card>
      ))}
    </AppScreen>
  );
}
