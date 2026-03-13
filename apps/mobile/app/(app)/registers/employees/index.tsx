import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Text, View } from "react-native";
import { AppButton, AppScreen, Card, EmptyState, PageHeader, SearchField } from "@/components/app/ui";
import { useOrganizationSlug } from "@/hooks/use-organization-slug";
import { deleteEmployee, listEmployees, registersQueryKeys } from "@/lib/registers";
import { normalizeSearchValue } from "@/lib/registers/helpers";
import { getApiErrorMessage } from "@/lib/errors";

export default function EmployeesScreen() {
  const slug = useOrganizationSlug();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const employeesQuery = useQuery({
    queryKey: registersQueryKeys.employees(slug),
    queryFn: () => listEmployees(slug),
  });

  const deleteMutation = useMutation({
    mutationFn: (employeeId: string) => deleteEmployee(slug, employeeId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: registersQueryKeys.employees(slug),
      });
    },
  });

  const employees = useMemo(() => employeesQuery.data ?? [], [employeesQuery.data]);
  const filteredEmployees = useMemo(() => {
    const query = normalizeSearchValue(search);
    if (!query) {
      return employees;
    }

    return employees.filter((employee) => {
      return (
        employee.name.toLowerCase().includes(query) ||
        employee.email.toLowerCase().includes(query) ||
        (employee.role ?? "").toLowerCase().includes(query) ||
        (employee.department ?? "").toLowerCase().includes(query) ||
        employee.company.name.toLowerCase().includes(query)
      );
    });
  }, [employees, search]);

  function handleDelete(employeeId: string, employeeName: string) {
    Alert.alert("Excluir funcionário", `Deseja excluir "${employeeName}"?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: () => {
          void (async () => {
            try {
              await deleteMutation.mutateAsync(employeeId);
            } catch (error) {
              Alert.alert(
                "Erro",
                getApiErrorMessage(error, "Não foi possível excluir o funcionário."),
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
        title="Funcionários"
        description="Cadastre e gerencie funcionários por empresa e unidade."
        action={<AppButton label="Novo" onPress={() => router.push("/registers/employees/create")} />}
      />

      <SearchField
        value={search}
        onChangeText={setSearch}
        placeholder="Buscar por nome, e-mail, empresa ou cargo..."
      />

      {employeesQuery.isLoading ? (
        <Text className="py-8 text-center text-[14px] text-slate-500">
          Carregando funcionários...
        </Text>
      ) : null}
      {employeesQuery.isError ? <EmptyState message="Erro ao carregar funcionários." /> : null}
      {!employeesQuery.isLoading && !employeesQuery.isError && filteredEmployees.length === 0 ? (
        <EmptyState message="Nenhum funcionário encontrado." />
      ) : null}

      {filteredEmployees.map((employee) => (
        <Card key={employee.id}>
          <View className="mb-2">
            <Text className="text-[16px] font-semibold text-slate-900">{employee.name}</Text>
            <Text className="text-[12px] text-slate-500">
              {employee.role || "Sem cargo"}
              {employee.department ? ` • ${employee.department}` : ""}
            </Text>
          </View>

          <Text className="text-[13px] text-slate-600">E-mail: {employee.email}</Text>
          <Text className="text-[13px] text-slate-600">Telefone: {employee.phone ?? "-"}</Text>
          <Text className="text-[13px] text-slate-600">Empresa: {employee.company.name}</Text>
          <Text className="mb-3 text-[13px] text-slate-600">
            Unidade: {employee.unit?.name ?? "-"}
          </Text>

          <View className="flex-row gap-2">
            <View className="flex-1">
              <AppButton
                label="Editar"
                variant="outline"
                onPress={() => router.push(`/registers/employees/${employee.id}/edit`)}
              />
            </View>
            <View className="flex-1">
              <AppButton
                label="Excluir"
                variant="danger"
                loading={deleteMutation.isPending}
                onPress={() => handleDelete(employee.id, employee.name)}
              />
            </View>
          </View>
        </Card>
      ))}
    </AppScreen>
  );
}
