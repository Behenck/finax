import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Text, View } from "react-native";
import { AppButton, AppScreen, Card, EmptyState, PageHeader, SearchField } from "@/components/app/ui";
import { useOrganizationSlug } from "@/hooks/use-organization-slug";
import { deleteCustomer, listCustomers, registersQueryKeys } from "@/lib/registers";
import { normalizeSearchValue } from "@/lib/registers/helpers";
import { getApiErrorMessage } from "@/lib/errors";

export default function CustomersScreen() {
  const slug = useOrganizationSlug();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const customersQuery = useQuery({
    queryKey: registersQueryKeys.customers(slug),
    queryFn: () => listCustomers(slug),
  });

  const deleteMutation = useMutation({
    mutationFn: (customerId: string) => deleteCustomer(slug, customerId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: registersQueryKeys.customers(slug),
      });
    },
  });

  const customers = useMemo(() => customersQuery.data ?? [], [customersQuery.data]);
  const filteredCustomers = useMemo(() => {
    const query = normalizeSearchValue(search);
    if (!query) {
      return customers;
    }

    return customers.filter((customer) => {
      return (
        customer.name.toLowerCase().includes(query) ||
        customer.documentNumber.toLowerCase().includes(query) ||
        (customer.email ?? "").toLowerCase().includes(query) ||
        (customer.phone ?? "").toLowerCase().includes(query)
      );
    });
  }, [customers, search]);

  function handleDelete(customerId: string, customerName: string) {
    Alert.alert("Excluir cliente", `Deseja excluir "${customerName}"?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: () => {
          void (async () => {
            try {
              await deleteMutation.mutateAsync(customerId);
            } catch (error) {
              Alert.alert(
                "Erro",
                getApiErrorMessage(error, "Não foi possível excluir o cliente."),
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
        title="Clientes"
        description="Gerencie sua base de clientes PF e PJ."
        action={
          <AppButton
            label="Novo"
            onPress={() => router.push("/registers/customers/create")}
          />
        }
      />

      <SearchField
        value={search}
        onChangeText={setSearch}
        placeholder="Buscar por nome, documento, e-mail..."
      />

      {customersQuery.isLoading ? (
        <Text className="py-8 text-center text-[14px] text-slate-500">Carregando clientes...</Text>
      ) : null}

      {customersQuery.isError ? (
        <EmptyState message="Erro ao carregar clientes." />
      ) : null}

      {!customersQuery.isLoading && !customersQuery.isError && filteredCustomers.length === 0 ? (
        <EmptyState message="Nenhum cliente encontrado." />
      ) : null}

      {filteredCustomers.map((customer) => (
        <Card key={customer.id}>
          <View className="mb-2 flex-row items-start justify-between">
            <View className="flex-1 pr-3">
              <Text className="text-[16px] font-semibold text-slate-900">{customer.name}</Text>
              <Text className="text-[12px] text-slate-500">
                {customer.personType} • {customer.documentType}: {customer.documentNumber}
              </Text>
            </View>
            <View
              className={`rounded-full px-2.5 py-1 ${
                customer.status === "ACTIVE" ? "bg-emerald-100" : "bg-amber-100"
              }`}
            >
              <Text
                className={`text-[11px] font-semibold ${
                  customer.status === "ACTIVE" ? "text-emerald-700" : "text-amber-700"
                }`}
              >
                {customer.status === "ACTIVE" ? "Ativo" : "Inativo"}
              </Text>
            </View>
          </View>

          <Text className="text-[13px] text-slate-600">E-mail: {customer.email ?? "-"}</Text>
          <Text className="text-[13px] text-slate-600">Telefone: {customer.phone ?? "-"}</Text>
          <Text className="mb-3 text-[13px] text-slate-600">
            Responsável: {customer.responsible?.name ?? "-"}
          </Text>

          <View className="flex-row gap-2">
            <View className="flex-1">
              <AppButton
                label="Editar"
                variant="outline"
                onPress={() => router.push(`/registers/customers/${customer.id}/edit`)}
              />
            </View>
            <View className="flex-1">
              <AppButton
                label="Excluir"
                variant="danger"
                loading={deleteMutation.isPending}
                onPress={() => handleDelete(customer.id, customer.name)}
              />
            </View>
          </View>
        </Card>
      ))}
    </AppScreen>
  );
}
