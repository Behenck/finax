import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Alert, Pressable, Text, View } from "react-native";
import { AppButton, AppScreen, Card, EmptyState, FormTextField, PageHeader, SearchField } from "@/components/app/ui";
import { useOrganizationSlug } from "@/hooks/use-organization-slug";
import {
  createCompany,
  createUnit,
  deleteCompany,
  deleteUnit,
  listCompanies,
  registersQueryKeys,
  updateCompany,
  updateUnit,
} from "@/lib/registers";
import { simpleNameSchema, type SimpleNameValues } from "@/lib/registers/form-schemas";
import { normalizeSearchValue } from "@/lib/registers/helpers";
import { getApiErrorMessage } from "@/lib/errors";
import type { Company, Unit } from "@/types/registers";

function EditableUnitRow({
  companyId,
  unit,
  isPending,
  onUpdate,
  onDelete,
}: {
  companyId: string;
  unit: Unit;
  isPending: boolean;
  onUpdate: (companyId: string, unitId: string, name: string) => Promise<void>;
  onDelete: (companyId: string, unitId: string, name: string) => Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const unitForm = useForm<SimpleNameValues>({
    resolver: zodResolver(simpleNameSchema),
    defaultValues: { name: unit.name },
  });

  return (
    <View className="mb-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
      {isEditing ? (
        <View>
          <FormTextField control={unitForm.control} name="name" label="Nome da Unidade" />
          <View className="flex-row gap-2">
            <View className="flex-1">
              <AppButton
                label="Cancelar"
                variant="outline"
                onPress={() => {
                  unitForm.reset({ name: unit.name });
                  setIsEditing(false);
                }}
                disabled={isPending}
              />
            </View>
            <View className="flex-1">
              <AppButton
                label="Salvar"
                loading={isPending}
                onPress={unitForm.handleSubmit(async (values) => {
                  await onUpdate(companyId, unit.id, values.name);
                  setIsEditing(false);
                })}
              />
            </View>
          </View>
        </View>
      ) : (
        <View className="flex-row items-center justify-between gap-2">
          <Text className="flex-1 text-[14px] font-medium text-slate-900">{unit.name}</Text>
          <View className="flex-row gap-2">
            <AppButton label="Editar" variant="outline" onPress={() => setIsEditing(true)} />
            <AppButton
              label="Excluir"
              variant="danger"
              loading={isPending}
              onPress={() => {
                void onDelete(companyId, unit.id, unit.name);
              }}
            />
          </View>
        </View>
      )}
    </View>
  );
}

function CompanyCard({
  company,
  isPending,
  onUpdateCompany,
  onDeleteCompany,
  onCreateUnit,
  onUpdateUnit,
  onDeleteUnit,
}: {
  company: Company;
  isPending: boolean;
  onUpdateCompany: (companyId: string, name: string) => Promise<void>;
  onDeleteCompany: (companyId: string, name: string) => Promise<void>;
  onCreateUnit: (companyId: string, name: string) => Promise<void>;
  onUpdateUnit: (companyId: string, unitId: string, name: string) => Promise<void>;
  onDeleteUnit: (companyId: string, unitId: string, name: string) => Promise<void>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isEditingCompany, setIsEditingCompany] = useState(false);

  const companyForm = useForm<SimpleNameValues>({
    resolver: zodResolver(simpleNameSchema),
    defaultValues: { name: company.name },
  });

  const unitForm = useForm<SimpleNameValues>({
    resolver: zodResolver(simpleNameSchema),
    defaultValues: { name: "" },
  });

  return (
    <Card>
      <Pressable
        className="mb-2 flex-row items-center justify-between"
        onPress={() => setIsOpen((state) => !state)}
      >
        <View className="flex-1 pr-3">
          <Text className="text-[16px] font-semibold text-slate-900">{company.name}</Text>
          <Text className="text-[12px] text-slate-500">
            {company.units.length} unidade(s) • {company.employees.length} funcionário(s)
          </Text>
        </View>
        <Text className="text-[12px] font-semibold text-brand-700">
          {isOpen ? "Fechar" : "Abrir"}
        </Text>
      </Pressable>

      {isOpen ? (
        <View className="border-t border-slate-200 pt-3">
          {isEditingCompany ? (
            <View className="mb-3">
              <FormTextField control={companyForm.control} name="name" label="Nome da Empresa" />
              <View className="flex-row gap-2">
                <View className="flex-1">
                  <AppButton
                    label="Cancelar"
                    variant="outline"
                    onPress={() => {
                      companyForm.reset({ name: company.name });
                      setIsEditingCompany(false);
                    }}
                    disabled={isPending}
                  />
                </View>
                <View className="flex-1">
                  <AppButton
                    label="Salvar"
                    loading={isPending}
                    onPress={companyForm.handleSubmit(async (values) => {
                      await onUpdateCompany(company.id, values.name);
                      setIsEditingCompany(false);
                    })}
                  />
                </View>
              </View>
            </View>
          ) : (
            <View className="mb-3 flex-row gap-2">
              <View className="flex-1">
                <AppButton
                  label="Editar Empresa"
                  variant="outline"
                  onPress={() => setIsEditingCompany(true)}
                />
              </View>
              <View className="flex-1">
                <AppButton
                  label="Excluir Empresa"
                  variant="danger"
                  loading={isPending}
                  onPress={() => {
                    void onDeleteCompany(company.id, company.name);
                  }}
                />
              </View>
            </View>
          )}

          <Text className="mb-2 text-[14px] font-semibold text-slate-900">Unidades</Text>
          {company.units.length === 0 ? (
            <Text className="mb-3 text-[13px] text-slate-500">Nenhuma unidade cadastrada.</Text>
          ) : null}

          {company.units.map((unit) => (
            <EditableUnitRow
              key={unit.id}
              companyId={company.id}
              unit={unit}
              isPending={isPending}
              onUpdate={onUpdateUnit}
              onDelete={onDeleteUnit}
            />
          ))}

          <View className="mt-1 rounded-xl border border-slate-200 p-3">
            <FormTextField control={unitForm.control} name="name" label="Nova Unidade" />
            <AppButton
              label="Adicionar Unidade"
              loading={isPending}
              onPress={unitForm.handleSubmit(async (values) => {
                await onCreateUnit(company.id, values.name);
                unitForm.reset({ name: "" });
              })}
            />
          </View>
        </View>
      ) : null}
    </Card>
  );
}

export default function CompaniesScreen() {
  const slug = useOrganizationSlug();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const companiesQuery = useQuery({
    queryKey: registersQueryKeys.companies(slug),
    queryFn: () => listCompanies(slug),
  });

  const createCompanyMutation = useMutation({
    mutationFn: (name: string) => createCompany(slug, name),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: registersQueryKeys.companies(slug),
      });
    },
  });

  const updateCompanyMutation = useMutation({
    mutationFn: ({ companyId, name }: { companyId: string; name: string }) =>
      updateCompany(slug, companyId, name),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: registersQueryKeys.companies(slug),
      });
    },
  });

  const deleteCompanyMutation = useMutation({
    mutationFn: (companyId: string) => deleteCompany(slug, companyId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: registersQueryKeys.companies(slug),
      });
    },
  });

  const createUnitMutation = useMutation({
    mutationFn: ({ companyId, name }: { companyId: string; name: string }) =>
      createUnit(slug, companyId, name),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: registersQueryKeys.companies(slug),
      });
    },
  });

  const updateUnitMutation = useMutation({
    mutationFn: ({
      companyId,
      unitId,
      name,
    }: {
      companyId: string;
      unitId: string;
      name: string;
    }) => updateUnit(slug, companyId, unitId, name),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: registersQueryKeys.companies(slug),
      });
    },
  });

  const deleteUnitMutation = useMutation({
    mutationFn: ({ companyId, unitId }: { companyId: string; unitId: string }) =>
      deleteUnit(slug, companyId, unitId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: registersQueryKeys.companies(slug),
      });
    },
  });

  const createCompanyForm = useForm<SimpleNameValues>({
    resolver: zodResolver(simpleNameSchema),
    defaultValues: { name: "" },
  });

  const isPending =
    createCompanyMutation.isPending ||
    updateCompanyMutation.isPending ||
    deleteCompanyMutation.isPending ||
    createUnitMutation.isPending ||
    updateUnitMutation.isPending ||
    deleteUnitMutation.isPending;

  const filteredCompanies = useMemo(() => {
    const companies = companiesQuery.data ?? [];
    const query = normalizeSearchValue(search);
    if (!query) {
      return companies;
    }

    return companies.filter((company) => {
      return (
        company.name.toLowerCase().includes(query) ||
        company.units.some((unit) => unit.name.toLowerCase().includes(query))
      );
    });
  }, [companiesQuery.data, search]);

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
        title="Empresas"
        description="Gerencie empresas e as unidades vinculadas."
      />

      <SearchField value={search} onChangeText={setSearch} placeholder="Buscar por empresa ou unidade..." />

      <Card>
        <Text className="mb-2 text-[14px] font-semibold text-slate-900">Nova Empresa</Text>
        <FormTextField control={createCompanyForm.control} name="name" label="Nome da Empresa" />
        <AppButton
          label="Adicionar Empresa"
          loading={createCompanyMutation.isPending}
          onPress={createCompanyForm.handleSubmit(async (values) => {
            await runAction(
              async () => {
                await createCompanyMutation.mutateAsync(values.name);
                createCompanyForm.reset({ name: "" });
              },
              "Não foi possível criar a empresa.",
            );
          })}
        />
      </Card>

      {companiesQuery.isLoading ? (
        <Text className="py-8 text-center text-[14px] text-slate-500">Carregando empresas...</Text>
      ) : null}
      {companiesQuery.isError ? <EmptyState message="Erro ao carregar empresas." /> : null}
      {!companiesQuery.isLoading && !companiesQuery.isError && filteredCompanies.length === 0 ? (
        <EmptyState message="Nenhuma empresa encontrada." />
      ) : null}

      {filteredCompanies.map((company) => (
        <CompanyCard
          key={company.id}
          company={company}
          isPending={isPending}
          onUpdateCompany={(companyId, name) =>
            runAction(
              async () => {
                await updateCompanyMutation.mutateAsync({ companyId, name });
              },
              "Não foi possível atualizar a empresa.",
            )
          }
          onDeleteCompany={(companyId, name) =>
            runAction(
              async () => {
                Alert.alert("Excluir empresa", `Deseja excluir "${name}"?`, [
                  { text: "Cancelar", style: "cancel" },
                  {
                    text: "Excluir",
                    style: "destructive",
                    onPress: () => {
                      void deleteCompanyMutation.mutateAsync(companyId).catch((error) => {
                        Alert.alert(
                          "Erro",
                          getApiErrorMessage(
                            error,
                            "Não foi possível excluir a empresa.",
                          ),
                        );
                      });
                    },
                  },
                ]);
              },
              "Não foi possível excluir a empresa.",
            )
          }
          onCreateUnit={(companyId, name) =>
            runAction(
              async () => {
                await createUnitMutation.mutateAsync({ companyId, name });
              },
              "Não foi possível criar a unidade.",
            )
          }
          onUpdateUnit={(companyId, unitId, name) =>
            runAction(
              async () => {
                await updateUnitMutation.mutateAsync({ companyId, unitId, name });
              },
              "Não foi possível atualizar a unidade.",
            )
          }
          onDeleteUnit={(companyId, unitId, name) =>
            runAction(
              async () => {
                Alert.alert("Excluir unidade", `Deseja excluir "${name}"?`, [
                  { text: "Cancelar", style: "cancel" },
                  {
                    text: "Excluir",
                    style: "destructive",
                    onPress: () => {
                      void deleteUnitMutation
                        .mutateAsync({ companyId, unitId })
                        .catch((error) => {
                          Alert.alert(
                            "Erro",
                            getApiErrorMessage(
                              error,
                              "Não foi possível excluir a unidade.",
                            ),
                          );
                        });
                    },
                  },
                ]);
              },
              "Não foi possível excluir a unidade.",
            )
          }
        />
      ))}
    </AppScreen>
  );
}
