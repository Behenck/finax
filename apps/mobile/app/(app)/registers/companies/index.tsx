import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Location from "expo-location";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type UseFormReturn, useForm } from "react-hook-form";
import { Alert, Pressable, Text, View } from "react-native";
import {
  AppButton,
  AppScreen,
  Card,
  EmptyState,
  FormTextField,
  PageHeader,
  SearchField,
} from "@/components/app/ui";
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
import {
  companyFormSchema,
  type CompanyFormValues,
  unitFormSchema,
  type UnitFormValues,
} from "@/lib/registers/form-schemas";
import { normalizeSearchValue } from "@/lib/registers/helpers";
import { getApiErrorMessage } from "@/lib/errors";
import { maskCnpj, maskZipCode, unmask } from "@/lib/masks";
import type { Company, CompanyInput, Unit, UnitInput } from "@/types/registers";

type ViaCepResponse = {
  cep?: string;
  logradouro?: string;
  complemento?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean;
};

type NominatimReverseResponse = {
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    state?: string;
    state_code?: string;
    country_code?: string;
    postcode?: string;
    road?: string;
    pedestrian?: string;
    residential?: string;
    neighbourhood?: string;
    suburb?: string;
    city_district?: string;
    house_number?: string;
  };
};

const BRAZIL_STATE_CODES_BY_NAME: Record<string, string> = {
  acre: "AC",
  alagoas: "AL",
  amapa: "AP",
  amazonas: "AM",
  bahia: "BA",
  ceara: "CE",
  "distrito federal": "DF",
  "espirito santo": "ES",
  goias: "GO",
  maranhao: "MA",
  "mato grosso": "MT",
  "mato grosso do sul": "MS",
  "minas gerais": "MG",
  para: "PA",
  paraiba: "PB",
  parana: "PR",
  pernambuco: "PE",
  piaui: "PI",
  "rio de janeiro": "RJ",
  "rio grande do norte": "RN",
  "rio grande do sul": "RS",
  rondonia: "RO",
  roraima: "RR",
  "santa catarina": "SC",
  "sao paulo": "SP",
  sergipe: "SE",
  tocantins: "TO",
};

function resolveStateCode(rawState?: string, rawStateCode?: string) {
  if (rawStateCode) {
    const parsed = rawStateCode.toUpperCase().replace("BR-", "").trim();
    if (parsed.length === 2) {
      return parsed;
    }
  }

  if (!rawState) {
    return "";
  }

  const normalizedStateName = rawState
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

  return BRAZIL_STATE_CODES_BY_NAME[normalizedStateName] ?? rawState;
}

function getUnitDefaultValues(unit?: Unit): UnitFormValues {
  return {
    name: unit?.name ?? "",
    cnpj: unit?.cnpj ? maskCnpj(unit.cnpj) : "",
    country: unit?.country ?? "",
    state: unit?.state ?? "",
    city: unit?.city ?? "",
    street: unit?.street ?? "",
    zipCode: unit?.zipCode ?? "",
    neighborhood: unit?.neighborhood ?? "",
    number: unit?.number ?? "",
    complement: unit?.complement ?? "",
  };
}

function normalizeUnitInput(values: UnitFormValues): UnitInput {
  return {
    name: values.name,
    cnpj: values.cnpj ? unmask(values.cnpj) : undefined,
    country: values.country,
    state: values.state,
    city: values.city,
    street: values.street,
    zipCode: values.zipCode ? unmask(values.zipCode) : undefined,
    neighborhood: values.neighborhood,
    number: values.number,
    complement: values.complement,
  };
}

function getCompanyDefaultValues(company?: Company): CompanyFormValues {
  return {
    name: company?.name ?? "",
    cnpj: company?.cnpj ? maskCnpj(company.cnpj) : "",
  };
}

function normalizeCompanyInput(values: CompanyFormValues): CompanyInput {
  return {
    name: values.name,
    cnpj: values.cnpj ? unmask(values.cnpj) : undefined,
  };
}

function formatCnpjPreview(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  return maskCnpj(value);
}

function buildUnitAddressPreview(unit: Unit) {
  const streetNumber = [unit.street, unit.number].filter(Boolean).join(", ");
  const cityState = [unit.city, unit.state].filter(Boolean).join("/");

  const parts = [streetNumber, unit.neighborhood, cityState, unit.zipCode].filter(Boolean);
  if (parts.length === 0) {
    return null;
  }

  return parts.join(" • ");
}

function useUnitAddressAutoFill(form: UseFormReturn<UnitFormValues>) {
  const [isResolvingCurrentLocation, setIsResolvingCurrentLocation] = useState(false);
  const zipCode = form.watch("zipCode");
  const skipZipCodeAutoResolveRef = useRef(false);

  const fillAddressFromZipCode = useCallback(
    async (digits: string, signal?: AbortSignal) => {
      try {
        const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`, {
          signal,
        });

        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as ViaCepResponse;
        if (data.erro) {
          return;
        }

        form.setValue("street", data.logradouro ?? "");
        form.setValue("neighborhood", data.bairro ?? "");
        form.setValue("city", data.localidade ?? "");
        form.setValue("state", data.uf ?? "");
        form.setValue("country", "BR");
        if (data.complemento && !form.getValues("complement")) {
          form.setValue("complement", data.complemento);
        }
      } catch {
        // Ignora erros de rede e mantém preenchimento manual.
      }
    },
    [form],
  );

  useEffect(() => {
    const digits = unmask(zipCode ?? "").slice(0, 8);
    if (digits.length !== 8) {
      skipZipCodeAutoResolveRef.current = false;
      return;
    }
    if (skipZipCodeAutoResolveRef.current) {
      skipZipCodeAutoResolveRef.current = false;
      return;
    }

    const abortController = new AbortController();
    void fillAddressFromZipCode(digits, abortController.signal);

    return () => {
      abortController.abort();
    };
  }, [fillAddressFromZipCode, zipCode]);

  async function handleUseCurrentLocation() {
    setIsResolvingCurrentLocation(true);

    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        Alert.alert("Permissão necessária", "Autorize a localização para preencher cidade e estado.");
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${position.coords.latitude}&lon=${position.coords.longitude}&addressdetails=1&accept-language=pt-BR`,
      );

      if (!response.ok) {
        throw new Error("Falha ao consultar geolocalização");
      }

      const data = (await response.json()) as NominatimReverseResponse;
      const city =
        data.address?.city ??
        data.address?.town ??
        data.address?.village ??
        data.address?.municipality ??
        "";
      const state = resolveStateCode(data.address?.state, data.address?.state_code);
      const zipCodeDigits = (data.address?.postcode ?? "").replace(/\D/g, "").slice(0, 8);
      const streetFromGeo =
        data.address?.road ?? data.address?.pedestrian ?? data.address?.residential ?? "";
      const neighborhoodFromGeo =
        data.address?.suburb ?? data.address?.neighbourhood ?? data.address?.city_district ?? "";
      const numberFromGeo = data.address?.house_number ?? "";

      if (!city && !state && !zipCodeDigits && !streetFromGeo && !neighborhoodFromGeo) {
        Alert.alert(
          "Localização indisponível",
          "Não foi possível identificar dados úteis da sua localização.",
        );
        return;
      }

      if (city) {
        form.setValue("city", city);
      }
      if (state) {
        form.setValue("state", state);
      }
      if (!form.getValues("country")) {
        form.setValue("country", "BR");
      }
      if (streetFromGeo) {
        form.setValue("street", streetFromGeo);
      }
      if (neighborhoodFromGeo) {
        form.setValue("neighborhood", neighborhoodFromGeo);
      }
      if (numberFromGeo) {
        form.setValue("number", numberFromGeo);
      }
      if (zipCodeDigits) {
        form.setValue("zipCode", maskZipCode(zipCodeDigits));
        if (zipCodeDigits.length === 8) {
          skipZipCodeAutoResolveRef.current = true;
          await fillAddressFromZipCode(zipCodeDigits);
        }
      }
    } catch {
      Alert.alert(
        "Erro",
        "Não foi possível usar sua localização atual. Você pode preencher manualmente.",
      );
    } finally {
      setIsResolvingCurrentLocation(false);
    }
  }

  return {
    isResolvingCurrentLocation,
    handleUseCurrentLocation,
  };
}

function UnitAddressFields({
  form,
  isPending,
}: {
  form: UseFormReturn<UnitFormValues>;
  isPending: boolean;
}) {
  const { isResolvingCurrentLocation, handleUseCurrentLocation } = useUnitAddressAutoFill(form);

  return (
    <View className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <Text className="mb-2 text-[13px] font-semibold text-slate-900">Localização da Unidade</Text>
      <FormTextField
        control={form.control}
        name="zipCode"
        label="CEP"
        keyboardType="numeric"
        transform={maskZipCode}
      />
      <AppButton
        label={isResolvingCurrentLocation ? "Obtendo localização..." : "Usar localização atual"}
        variant="outline"
        disabled={isPending || isResolvingCurrentLocation}
        onPress={() => {
          void handleUseCurrentLocation();
        }}
      />
      <View className="mt-2" />
      <FormTextField control={form.control} name="country" label="País" />
      <FormTextField control={form.control} name="state" label="Estado" />
      <FormTextField control={form.control} name="city" label="Cidade" />
      <FormTextField control={form.control} name="street" label="Rua" />
      <FormTextField control={form.control} name="neighborhood" label="Bairro" />
      <FormTextField control={form.control} name="number" label="Número" />
      <FormTextField control={form.control} name="complement" label="Complemento" />
    </View>
  );
}

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
  onUpdate: (companyId: string, unitId: string, payload: UnitInput) => Promise<void>;
  onDelete: (companyId: string, unitId: string, name: string) => Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const unitForm = useForm<UnitFormValues>({
    resolver: zodResolver(unitFormSchema),
    defaultValues: getUnitDefaultValues(unit),
  });
  const addressPreview = buildUnitAddressPreview(unit);
  const cnpjPreview = formatCnpjPreview(unit.cnpj);
  const hasDetails = Boolean(cnpjPreview || addressPreview);

  return (
    <View className="mb-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
      {isEditing ? (
        <View>
          <FormTextField control={unitForm.control} name="name" label="Nome da Unidade" />
          <FormTextField
            control={unitForm.control}
            name="cnpj"
            label="CNPJ da Unidade"
            keyboardType="numeric"
            transform={maskCnpj}
          />
          <UnitAddressFields form={unitForm} isPending={isPending} />
          <View className="mt-3 flex-row gap-2">
            <View className="flex-1">
              <AppButton
                label="Cancelar"
                variant="outline"
                onPress={() => {
                  unitForm.reset(getUnitDefaultValues(unit));
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
                  await onUpdate(companyId, unit.id, normalizeUnitInput(values));
                  setIsEditing(false);
                })}
              />
            </View>
          </View>
        </View>
      ) : (
        <View
          className={`flex-row justify-between gap-3 ${hasDetails ? "items-start" : "items-center"}`}
        >
          <View className="flex-1 pr-2">
            <Text className="text-[14px] font-medium text-slate-900">{unit.name}</Text>
            {cnpjPreview ? (
              <Text className="mt-0.5 text-[12px] text-slate-500">CNPJ: {cnpjPreview}</Text>
            ) : null}
            {addressPreview ? (
              <Text className="mt-0.5 text-[12px] text-slate-500" numberOfLines={1}>
                {addressPreview}
              </Text>
            ) : null}
          </View>
          <View className="shrink-0 flex-row gap-2">
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
  onUpdateCompany: (companyId: string, payload: CompanyInput) => Promise<void>;
  onDeleteCompany: (companyId: string, name: string) => Promise<void>;
  onCreateUnit: (companyId: string, payload: UnitInput) => Promise<void>;
  onUpdateUnit: (companyId: string, unitId: string, payload: UnitInput) => Promise<void>;
  onDeleteUnit: (companyId: string, unitId: string, name: string) => Promise<void>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isEditingCompany, setIsEditingCompany] = useState(false);
  const companyCnpjPreview = formatCnpjPreview(company.cnpj);

  const companyForm = useForm<CompanyFormValues>({
    resolver: zodResolver(companyFormSchema),
    defaultValues: getCompanyDefaultValues(company),
  });

  const unitForm = useForm<UnitFormValues>({
    resolver: zodResolver(unitFormSchema),
    defaultValues: getUnitDefaultValues(),
  });

  return (
    <Card>
      <Pressable
        className="mb-3 flex-row items-center justify-between"
        onPress={() => setIsOpen((state) => !state)}
      >
        <View className="flex-1 pr-3">
          <Text className="text-[16px] font-semibold text-slate-900">{company.name}</Text>
          {companyCnpjPreview ? (
            <Text className="text-[12px] text-slate-500">CNPJ: {companyCnpjPreview}</Text>
          ) : null}
          {company.units.length > 0 ? (
            <Text className="text-[12px] text-slate-500">
              {company.units.length} unidade(s) • {company.employees.length} funcionário(s)
            </Text>
          ) : null}
        </View>
        <Text className="text-[12px] font-semibold text-brand-700">
          {isOpen ? "Fechar" : "Abrir"}
        </Text>
      </Pressable>

      {isOpen ? (
        <View className="border-t border-slate-200 pt-4">
          {isEditingCompany ? (
            <View className="mb-4">
              <FormTextField control={companyForm.control} name="name" label="Nome da Empresa" />
              <FormTextField
                control={companyForm.control}
                name="cnpj"
                label="CNPJ da Empresa"
                keyboardType="numeric"
                transform={maskCnpj}
              />
              <View className="flex-row gap-2">
                <View className="flex-1">
                  <AppButton
                    label="Cancelar"
                    variant="outline"
                    onPress={() => {
                      companyForm.reset(getCompanyDefaultValues(company));
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
                      await onUpdateCompany(company.id, normalizeCompanyInput(values));
                      setIsEditingCompany(false);
                    })}
                  />
                </View>
              </View>
            </View>
          ) : (
            <View className="mb-4 flex-row gap-2">
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

          <Text className="mb-2.5 text-[14px] font-semibold text-slate-900">Unidades</Text>
          {company.units.length === 0 ? (
            <Text className="mb-3 text-[13px] text-slate-500">Nenhuma unidade cadastrada.</Text>
          ) : null}

          <View className="mb-3">
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
          </View>

          <View className="rounded-xl border border-slate-200 p-3.5">
            <FormTextField control={unitForm.control} name="name" label="Nova Unidade" />
            <FormTextField
              control={unitForm.control}
              name="cnpj"
              label="CNPJ da Unidade"
              keyboardType="numeric"
              transform={maskCnpj}
            />
            <UnitAddressFields form={unitForm} isPending={isPending} />
            <AppButton
              label="Adicionar Unidade"
              loading={isPending}
              onPress={unitForm.handleSubmit(async (values) => {
                await onCreateUnit(company.id, normalizeUnitInput(values));
                unitForm.reset(getUnitDefaultValues());
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
    mutationFn: (payload: CompanyInput) => createCompany(slug, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: registersQueryKeys.companies(slug),
      });
    },
  });

  const updateCompanyMutation = useMutation({
    mutationFn: ({ companyId, payload }: { companyId: string; payload: CompanyInput }) =>
      updateCompany(slug, companyId, payload),
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
    mutationFn: ({ companyId, payload }: { companyId: string; payload: UnitInput }) =>
      createUnit(slug, companyId, payload),
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
      payload,
    }: {
      companyId: string;
      unitId: string;
      payload: UnitInput;
    }) => updateUnit(slug, companyId, unitId, payload),
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

  const createCompanyForm = useForm<CompanyFormValues>({
    resolver: zodResolver(companyFormSchema),
    defaultValues: getCompanyDefaultValues(),
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
    const digitsQuery = unmask(search);
    if (!query) {
      return companies;
    }

    return companies.filter((company) => {
      const companyCnpj = company.cnpj ?? "";
      const companyCnpjDigits = unmask(companyCnpj);

      return (
        company.name.toLowerCase().includes(query) ||
        companyCnpj.toLowerCase().includes(query) ||
        (digitsQuery ? companyCnpjDigits.includes(digitsQuery) : false) ||
        company.units.some((unit) => {
          const unitCnpj = unit.cnpj ?? "";
          const unitCnpjDigits = unmask(unitCnpj);
          return (
            unit.name.toLowerCase().includes(query) ||
            unitCnpj.toLowerCase().includes(query) ||
            (digitsQuery ? unitCnpjDigits.includes(digitsQuery) : false)
          );
        })
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
      <PageHeader title="Empresas" description="Gerencie empresas e as unidades vinculadas." />

      <SearchField
        value={search}
        onChangeText={setSearch}
        placeholder="Buscar por nome ou CNPJ..."
      />

      <Card>
        <Text className="mb-2 text-[14px] font-semibold text-slate-900">Nova Empresa</Text>
        <FormTextField control={createCompanyForm.control} name="name" label="Nome da Empresa" />
        <FormTextField
          control={createCompanyForm.control}
          name="cnpj"
          label="CNPJ da Empresa"
          keyboardType="numeric"
          transform={maskCnpj}
        />
        <AppButton
          label="Adicionar Empresa"
          loading={createCompanyMutation.isPending}
          onPress={createCompanyForm.handleSubmit(async (values) => {
            await runAction(
              async () => {
                await createCompanyMutation.mutateAsync(normalizeCompanyInput(values));
                createCompanyForm.reset(getCompanyDefaultValues());
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

      <View className="mt-1">
        {filteredCompanies.map((company) => (
          <CompanyCard
            key={company.id}
            company={company}
            isPending={isPending}
            onUpdateCompany={(companyId, payload) =>
              runAction(
                async () => {
                  await updateCompanyMutation.mutateAsync({ companyId, payload });
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
                            getApiErrorMessage(error, "Não foi possível excluir a empresa."),
                          );
                        });
                      },
                    },
                  ]);
                },
                "Não foi possível excluir a empresa.",
              )
            }
            onCreateUnit={(companyId, payload) =>
              runAction(
                async () => {
                  await createUnitMutation.mutateAsync({ companyId, payload });
                },
                "Não foi possível criar a unidade.",
              )
            }
            onUpdateUnit={(companyId, unitId, payload) =>
              runAction(
                async () => {
                  await updateUnitMutation.mutateAsync({ companyId, unitId, payload });
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
                        void deleteUnitMutation.mutateAsync({ companyId, unitId }).catch((error) => {
                          Alert.alert(
                            "Erro",
                            getApiErrorMessage(error, "Não foi possível excluir a unidade."),
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
      </View>
    </AppScreen>
  );
}
