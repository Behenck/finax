import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, Text, TextInput, useWindowDimensions, View } from "react-native";
import {
  DonutChart,
  LineAreaChart,
  RadialProgress,
  VerticalBarChart,
} from "@/components/app/simple-charts";
import { AppButton, AppScreen, Card, EmptyState, PageHeader } from "@/components/app/ui";
import { useAuth } from "@/hooks/use-auth";
import { useOrganizationSlug } from "@/hooks/use-organization-slug";
import {
  listCategories,
  listCompanies,
  listCostCenters,
  listCustomers,
  listEmployees,
  listPartners,
  listSellers,
  registersQueryKeys,
} from "@/lib/registers";
import {
  formatCurrencyBRLFromCents,
  getSalesDashboardData,
  salesQueryKeys,
  shiftMonth,
  toMonthInputValue,
} from "@/lib/sales";

type DashboardView = "commercial" | "operational";

function formatPercentageDiff(current: number, previous: number): string {
  if (previous === 0) {
    return current === 0 ? "0%" : "Novo no período";
  }

  const diff = ((current - previous) / previous) * 100;
  return `${diff > 0 ? "+" : ""}${diff.toFixed(1)}%`;
}

export default function DashboardScreen() {
  const { session } = useAuth();
  const slug = useOrganizationSlug();
  const { width } = useWindowDimensions();
  const [view, setView] = useState<DashboardView>("commercial");
  const [month, setMonth] = useState<string>(toMonthInputValue());

  const dashboardQuery = useQuery({
    queryKey: salesQueryKeys.dashboard(slug, { month }),
    queryFn: () => getSalesDashboardData(slug, month),
  });

  const customersQuery = useQuery({
    queryKey: registersQueryKeys.customers(slug),
    queryFn: () => listCustomers(slug),
  });
  const sellersQuery = useQuery({
    queryKey: registersQueryKeys.sellers(slug),
    queryFn: () => listSellers(slug),
  });
  const partnersQuery = useQuery({
    queryKey: registersQueryKeys.partners(slug),
    queryFn: () => listPartners(slug),
  });
  const employeesQuery = useQuery({
    queryKey: registersQueryKeys.employees(slug),
    queryFn: () => listEmployees(slug),
  });
  const companiesQuery = useQuery({
    queryKey: registersQueryKeys.companies(slug),
    queryFn: () => listCompanies(slug),
  });
  const categoriesQuery = useQuery({
    queryKey: registersQueryKeys.categories(slug),
    queryFn: () => listCategories(slug),
  });
  const costCentersQuery = useQuery({
    queryKey: registersQueryKeys.costCenters(slug),
    queryFn: () => listCostCenters(slug),
  });

  const commercial = dashboardQuery.data;

  const operational = useMemo(() => {
    const customers = customersQuery.data ?? [];
    const sellers = sellersQuery.data ?? [];
    const partners = partnersQuery.data ?? [];
    const employees = employeesQuery.data ?? [];
    const companies = companiesQuery.data ?? [];
    const categories = categoriesQuery.data ?? [];
    const costCenters = costCentersQuery.data ?? [];

    const customersWithEmail = customers.filter((customer) => Boolean(customer.email)).length;
    const customersWithPhone = customers.filter((customer) => Boolean(customer.phone)).length;
    const customerContactCoverage =
      customers.length === 0
        ? 0
        : Math.round(((customersWithEmail + customersWithPhone) / (customers.length * 2)) * 100);

    return {
      customersTotal: customers.length,
      customersActive: customers.filter((customer) => customer.status === "ACTIVE").length,
      sellersTotal: sellers.length,
      sellersActive: sellers.filter((seller) => seller.status === "ACTIVE").length,
      partnersTotal: partners.length,
      partnersActive: partners.filter((partner) => partner.status === "ACTIVE").length,
      employeesTotal: employees.length,
      companiesTotal: companies.length,
      unitsTotal: companies.reduce((sum, company) => sum + company.units.length, 0),
      categoriesTotal: categories.length,
      categoriesIncome: categories.filter((category) => category.type === "INCOME").length,
      categoriesOutcome: categories.filter((category) => category.type === "OUTCOME").length,
      categoriesChildrenTotal: categories.reduce(
        (sum, category) => sum + category.children.length,
        0,
      ),
      costCentersTotal: costCenters.length,
      customerContactCoverage,
    };
  }, [
    categoriesQuery.data,
    companiesQuery.data,
    costCentersQuery.data,
    customersQuery.data,
    employeesQuery.data,
    partnersQuery.data,
    sellersQuery.data,
  ]);

  const chartWidth = Math.max(220, width - 58);

  return (
    <AppScreen>
      <PageHeader
        title="Dashboard"
        description={`Olá, ${session?.user.name?.trim() || session?.user.email || "Usuário"}`}
      />

      <View className="mb-3 flex-row gap-2">
        <Pressable
          className={`flex-1 rounded-full border px-3 py-2 ${
            view === "commercial" ? "border-brand-600 bg-brand-50" : "border-slate-300 bg-white"
          }`}
          onPress={() => setView("commercial")}
        >
          <Text
            className={`text-center text-[12px] font-semibold ${
              view === "commercial" ? "text-brand-700" : "text-slate-700"
            }`}
          >
            Comercial
          </Text>
        </Pressable>
        <Pressable
          className={`flex-1 rounded-full border px-3 py-2 ${
            view === "operational" ? "border-brand-600 bg-brand-50" : "border-slate-300 bg-white"
          }`}
          onPress={() => setView("operational")}
        >
          <Text
            className={`text-center text-[12px] font-semibold ${
              view === "operational" ? "text-brand-700" : "text-slate-700"
            }`}
          >
            Operacional
          </Text>
        </Pressable>
      </View>

      {view === "commercial" ? (
        <>
          <Card>
            <Text className="mb-2 text-[14px] font-semibold text-slate-900">Mês de referência</Text>
            <View className="flex-row items-center gap-2">
              <Pressable
                className="h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-3"
                onPress={() => setMonth((current) => shiftMonth(current, -1))}
              >
                <Text className="text-[18px] font-semibold text-slate-700">{"<"}</Text>
              </Pressable>
              <TextInput
                className="h-11 flex-1 rounded-xl border border-slate-300 bg-slate-50 px-3.5 text-[15px] text-slate-900"
                value={month}
                onChangeText={setMonth}
                autoCapitalize="none"
                placeholder="YYYY-MM"
              />
              <Pressable
                className="h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-3"
                onPress={() => setMonth((current) => shiftMonth(current, 1))}
              >
                <Text className="text-[18px] font-semibold text-slate-700">{">"}</Text>
              </Pressable>
            </View>
          </Card>

          {dashboardQuery.isLoading ? (
            <Text className="py-8 text-center text-[14px] text-slate-500">
              Carregando dashboard comercial...
            </Text>
          ) : null}

          {dashboardQuery.isError ? (
            <View className="gap-2">
              <EmptyState message="Não foi possível carregar o dashboard comercial." />
              <AppButton
                label="Tentar novamente"
                variant="outline"
                onPress={() => {
                  void dashboardQuery.refetch();
                }}
              />
            </View>
          ) : null}

          {commercial ? (
            <>
              <Card>
                <Text className="mb-2 text-[14px] font-semibold text-slate-900">KPIs do mês</Text>
                <View className="mb-3 flex-row flex-wrap gap-2">
                  <View className="min-w-[47%] flex-1 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <Text className="text-[12px] text-slate-500">Vendas</Text>
                    <Text className="text-[18px] font-semibold text-slate-900">
                      {commercial.sales.current.count}
                    </Text>
                    <Text className="text-[12px] text-slate-500">
                      {formatPercentageDiff(
                        commercial.sales.current.count,
                        commercial.sales.previous.count,
                      )}
                    </Text>
                  </View>
                  <View className="min-w-[47%] flex-1 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <Text className="text-[12px] text-slate-500">Faturamento</Text>
                    <Text className="text-[18px] font-semibold text-slate-900">
                      {formatCurrencyBRLFromCents(commercial.sales.current.grossAmount)}
                    </Text>
                    <Text className="text-[12px] text-slate-500">
                      {formatPercentageDiff(
                        commercial.sales.current.grossAmount,
                        commercial.sales.previous.grossAmount,
                      )}
                    </Text>
                  </View>
                  <View className="min-w-[47%] flex-1 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <Text className="text-[12px] text-slate-500">Comissões a receber</Text>
                    <Text className="text-[18px] font-semibold text-slate-900">
                      {formatCurrencyBRLFromCents(commercial.commissions.current.INCOME.total.amount)}
                    </Text>
                  </View>
                  <View className="min-w-[47%] flex-1 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <Text className="text-[12px] text-slate-500">Comissões a pagar</Text>
                    <Text className="text-[18px] font-semibold text-slate-900">
                      {formatCurrencyBRLFromCents(commercial.commissions.current.OUTCOME.total.amount)}
                    </Text>
                  </View>
                </View>
                <View className="flex-row gap-2">
                  <View className="flex-1">
                    <AppButton label="Ir para Vendas" onPress={() => router.push("/sales" as never)} />
                  </View>
                  <View className="flex-1">
                    <AppButton
                      label="Ir para Comissões"
                      variant="outline"
                      onPress={() => router.push("/commissions")}
                    />
                  </View>
                </View>
              </Card>

              <Card>
                <Text className="mb-3 text-[14px] font-semibold text-slate-900">Status das vendas</Text>
                <DonutChart
                  data={[
                    {
                      label: "Pendentes",
                      value: commercial.sales.byStatus.PENDING.count,
                      color: "#f59e0b",
                    },
                    {
                      label: "Aprovadas",
                      value: commercial.sales.byStatus.APPROVED.count,
                      color: "#3b82f6",
                    },
                    {
                      label: "Concluídas",
                      value: commercial.sales.byStatus.COMPLETED.count,
                      color: "#10b981",
                    },
                    {
                      label: "Canceladas",
                      value: commercial.sales.byStatus.CANCELED.count,
                      color: "#ef4444",
                    },
                  ]}
                />
              </Card>

              <Card>
                <Text className="mb-3 text-[14px] font-semibold text-slate-900">Timeline do mês</Text>
                <LineAreaChart
                  width={chartWidth}
                  data={commercial.sales.timeline.map((point) => ({
                    label: point.date.slice(8, 10),
                    value: Math.round(point.amount / 100),
                  }))}
                />
              </Card>

              <Card>
                <Text className="mb-3 text-[14px] font-semibold text-slate-900">Top produtos</Text>
                <VerticalBarChart
                  data={commercial.sales.topProducts.slice(0, 6).map((item, index) => ({
                    label: item.name,
                    value: item.count,
                    color: ["#16a34a", "#0ea5e9", "#f59e0b", "#8b5cf6", "#ec4899", "#ef4444"][
                      index % 6
                    ]!,
                  }))}
                />
              </Card>

              <Card>
                <Text className="mb-3 text-[14px] font-semibold text-slate-900">Top responsáveis</Text>
                <VerticalBarChart
                  data={commercial.sales.topResponsibles.slice(0, 6).map((item, index) => ({
                    label: item.name,
                    value: item.count,
                    color: ["#0284c7", "#16a34a", "#f97316", "#7c3aed", "#e11d48", "#0f766e"][
                      index % 6
                    ]!,
                  }))}
                />
              </Card>
            </>
          ) : null}
        </>
      ) : (
        <>
          {customersQuery.isLoading ||
          sellersQuery.isLoading ||
          partnersQuery.isLoading ||
          employeesQuery.isLoading ||
          companiesQuery.isLoading ||
          categoriesQuery.isLoading ||
          costCentersQuery.isLoading ? (
            <Text className="py-8 text-center text-[14px] text-slate-500">
              Carregando dashboard operacional...
            </Text>
          ) : null}

          {customersQuery.isError ||
          sellersQuery.isError ||
          partnersQuery.isError ||
          employeesQuery.isError ||
          companiesQuery.isError ||
          categoriesQuery.isError ||
          costCentersQuery.isError ? (
            <View className="gap-2">
              <EmptyState message="Não foi possível carregar a visão operacional." />
              <AppButton
                label="Tentar novamente"
                variant="outline"
                onPress={() => {
                  void Promise.all([
                    customersQuery.refetch(),
                    sellersQuery.refetch(),
                    partnersQuery.refetch(),
                    employeesQuery.refetch(),
                    companiesQuery.refetch(),
                    categoriesQuery.refetch(),
                    costCentersQuery.refetch(),
                  ]);
                }}
              />
            </View>
          ) : (
            <>
              <Card>
                <Text className="mb-2 text-[14px] font-semibold text-slate-900">Base operacional</Text>
                <View className="flex-row flex-wrap gap-2">
                  <View className="min-w-[47%] flex-1 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <Text className="text-[12px] text-slate-500">Clientes</Text>
                    <Text className="text-[18px] font-semibold text-slate-900">
                      {operational.customersTotal}
                    </Text>
                    <Text className="text-[12px] text-slate-500">
                      {operational.customersActive} ativos
                    </Text>
                  </View>
                  <View className="min-w-[47%] flex-1 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <Text className="text-[12px] text-slate-500">Vendedores + Parceiros</Text>
                    <Text className="text-[18px] font-semibold text-slate-900">
                      {operational.sellersTotal + operational.partnersTotal}
                    </Text>
                    <Text className="text-[12px] text-slate-500">
                      {operational.sellersActive + operational.partnersActive} ativos
                    </Text>
                  </View>
                  <View className="min-w-[47%] flex-1 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <Text className="text-[12px] text-slate-500">Empresas / Unidades</Text>
                    <Text className="text-[18px] font-semibold text-slate-900">
                      {operational.companiesTotal} / {operational.unitsTotal}
                    </Text>
                  </View>
                  <View className="min-w-[47%] flex-1 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <Text className="text-[12px] text-slate-500">Equipe</Text>
                    <Text className="text-[18px] font-semibold text-slate-900">
                      {operational.employeesTotal}
                    </Text>
                  </View>
                </View>
              </Card>

              <Card>
                <Text className="mb-3 text-[14px] font-semibold text-slate-900">
                  Ativos por cadastro
                </Text>
                <VerticalBarChart
                  data={[
                    {
                      label: "Clientes",
                      value: operational.customersActive,
                      color: "#16a34a",
                    },
                    {
                      label: "Vendedores",
                      value: operational.sellersActive,
                      color: "#0284c7",
                    },
                    {
                      label: "Parceiros",
                      value: operational.partnersActive,
                      color: "#f97316",
                    },
                  ]}
                />
              </Card>

              <Card>
                <Text className="mb-3 text-[14px] font-semibold text-slate-900">
                  Cobertura de contato dos clientes
                </Text>
                <View className="items-center justify-center">
                  <RadialProgress
                    value={operational.customerContactCoverage}
                    total={100}
                    color="#16a34a"
                  />
                </View>
                <Text className="mt-2 text-center text-[13px] text-slate-500">
                  Percentual com e-mail/telefone preenchidos
                </Text>
              </Card>

              <Card>
                <Text className="mb-3 text-[14px] font-semibold text-slate-900">
                  Categorias financeiras
                </Text>
                <DonutChart
                  data={[
                    {
                      label: "Receitas",
                      value: operational.categoriesIncome,
                      color: "#0ea5e9",
                    },
                    {
                      label: "Despesas",
                      value: operational.categoriesOutcome,
                      color: "#f97316",
                    },
                  ]}
                />
                <Text className="mt-2 text-[13px] text-slate-600">
                  Total de categorias: {operational.categoriesTotal}
                </Text>
                <Text className="text-[13px] text-slate-600">
                  Subcategorias: {operational.categoriesChildrenTotal}
                </Text>
                <Text className="text-[13px] text-slate-600">
                  Centros de custo: {operational.costCentersTotal}
                </Text>
              </Card>
            </>
          )}
        </>
      )}
    </AppScreen>
  );
}
