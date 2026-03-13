import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { Alert, Modal, Pressable, Text, TextInput, View } from "react-native";
import { OptionPicker } from "@/components/app/option-picker";
import { AppButton, AppScreen, PageHeader } from "@/components/app/ui";
import { SaleCommissionsEditor } from "@/components/sales/sale-commissions-editor";
import { SaleDynamicFields } from "@/components/sales/sale-dynamic-fields";
import { useOrganizationSlug } from "@/hooks/use-organization-slug";
import { getApiErrorMessage } from "@/lib/errors";
import { createCustomer } from "@/lib/registers";
import {
  createSale,
  flattenActiveProductOptions,
  formatCurrencyInput,
  getSale,
  getProductCommissionScenarios,
  getProductSaleFields,
  listSaleFormOptions,
  parseCurrencyToCents,
  saleFormSchema,
  salesQueryKeys,
  updateSale,
  type SaleFormValues,
  type SaleCommissionValues,
  type SaleDetail,
  type SaleDynamicFieldSchemaItem,
} from "@/lib/sales";
import { maskCpf, maskPhone, unmask } from "@/lib/masks";

type SaleFormScreenProps = {
  mode: "create" | "edit";
  saleId?: string;
  prefilledCustomerId?: string;
  duplicateSaleId?: string;
};

type QuickCustomerFormValues = {
  name: string;
  document: string;
  phone: string;
};

function getDefaultQuickCustomerValues(): QuickCustomerFormValues {
  return {
    name: "",
    document: "",
    phone: "",
  };
}

function getDefaultSaleValues(prefilledCustomerId?: string): SaleFormValues {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return {
    saleDate: `${now.getFullYear()}-${month}-${day}`,
    customerId: prefilledCustomerId ?? "",
    productId: "",
    companyId: "",
    unitId: "",
    responsibleType: "SELLER",
    responsibleId: "",
    totalAmount: "",
    notes: "",
    dynamicFields: {},
    commissions: [],
  };
}

function mapSaleToFormValues(
  sale: SaleDetail,
  fallbackCustomerId?: string,
): SaleFormValues {
  return {
    saleDate: sale.saleDate.slice(0, 10),
    customerId: sale.customerId ?? fallbackCustomerId ?? "",
    productId: sale.productId,
    companyId: sale.companyId,
    unitId: sale.unitId ?? "",
    responsibleType: sale.responsibleType,
    responsibleId: sale.responsibleId,
    totalAmount: formatCurrencyInput(String(sale.totalAmount)),
    notes: sale.notes ?? "",
    dynamicFields: sale.dynamicFieldValues ?? {},
    commissions: sale.commissions.map((commission) => ({
      sourceType: commission.sourceType,
      recipientType: commission.recipientType,
      direction: commission.direction,
      beneficiaryId: commission.beneficiaryId ?? "",
      beneficiaryLabel: commission.beneficiaryLabel ?? "",
      startDate: commission.startDate.slice(0, 10),
      totalPercentage: commission.totalPercentage,
      installments: commission.installments.map((installment) => ({
        installmentNumber: installment.installmentNumber,
        percentage: installment.percentage,
      })),
    })),
  };
}

function createDefaultManualCommission(startDate: string): SaleCommissionValues {
  return {
    sourceType: "MANUAL",
    recipientType: "SELLER",
    direction: "OUTCOME",
    beneficiaryId: "",
    beneficiaryLabel: "",
    startDate,
    totalPercentage: 0,
    installments: [
      {
        installmentNumber: 1,
        percentage: 0,
      },
    ],
  };
}

function resolveMatchedScenario(
  scenarios: Awaited<ReturnType<typeof getProductCommissionScenarios>>,
  context: {
    companyId: string;
    unitId: string;
    sellerId: string;
    partnerId: string;
  },
) {
  return scenarios.find((scenario) =>
    scenario.conditions.every((condition) => {
      if (!condition.valueId) {
        return true;
      }

      if (condition.type === "COMPANY") {
        return context.companyId === condition.valueId;
      }

      if (condition.type === "UNIT") {
        return context.unitId === condition.valueId;
      }

      if (condition.type === "SELLER") {
        return context.sellerId === condition.valueId;
      }

      if (condition.type === "PARTNER") {
        return context.partnerId === condition.valueId;
      }

      return false;
    }),
  );
}

export function SaleFormScreen({
  mode,
  saleId,
  prefilledCustomerId,
  duplicateSaleId,
}: SaleFormScreenProps) {
  const slug = useOrganizationSlug();
  const queryClient = useQueryClient();
  const [quickCustomerModalOpen, setQuickCustomerModalOpen] = useState(false);
  const [quickCustomerForm, setQuickCustomerForm] = useState<QuickCustomerFormValues>(
    getDefaultQuickCustomerValues(),
  );
  const [dynamicFieldSchema, setDynamicFieldSchema] = useState<SaleDynamicFieldSchemaItem[]>(
    [],
  );
  const [commissionPullRequestedForProduct, setCommissionPullRequestedForProduct] =
    useState<string | null>(null);
  const [matchedScenarioName, setMatchedScenarioName] = useState<string | undefined>();
  const [pullScenarioError, setPullScenarioError] = useState(false);
  const [isPullingScenario, setIsPullingScenario] = useState(false);

  const form = useForm<SaleFormValues>({
    resolver: zodResolver(saleFormSchema),
    defaultValues: getDefaultSaleValues(prefilledCustomerId),
  });
  const { control, handleSubmit, reset, watch, setValue, getValues } = form;

  const commissionsFieldArray = useFieldArray({
    control,
    name: "commissions",
  });

  const selectedProductId = watch("productId") ?? "";
  const selectedCompanyId = watch("companyId") ?? "";
  const selectedUnitId = watch("unitId") ?? "";
  const selectedResponsibleType = watch("responsibleType") ?? "SELLER";
  const selectedResponsibleId = watch("responsibleId") ?? "";
  const saleTotalAmount = watch("totalAmount") ?? "";
  const watchedCommissions = watch("commissions");
  const saleTotalInCents = parseCurrencyToCents(saleTotalAmount);

  const optionsQuery = useQuery({
    queryKey: salesQueryKeys.formOptions(slug),
    queryFn: () => listSaleFormOptions(slug),
  });

  const editSaleQuery = useQuery({
    queryKey: saleId ? salesQueryKeys.detail(slug, saleId) : ["sales", "detail", "noop"],
    queryFn: () => getSale(slug, saleId!),
    enabled: mode === "edit" && Boolean(saleId),
  });

  const duplicateSaleQuery = useQuery({
    queryKey: duplicateSaleId
      ? salesQueryKeys.detail(slug, duplicateSaleId)
      : ["sales", "duplicate", "noop"],
    queryFn: () => getSale(slug, duplicateSaleId!),
    enabled: mode === "create" && Boolean(duplicateSaleId),
  });

  const createMutation = useMutation({
    mutationFn: async (payload: SaleFormValues) => {
      const normalizedPayload = {
        saleDate: payload.saleDate,
        customerId: payload.customerId,
        productId: payload.productId,
        totalAmount: parseCurrencyToCents(payload.totalAmount),
        responsible: {
          type: payload.responsibleType,
          id: payload.responsibleId,
        },
        companyId: payload.companyId,
        unitId: payload.unitId?.trim() ? payload.unitId : undefined,
        notes: payload.notes?.trim() ? payload.notes.trim() : undefined,
        dynamicFields: payload.dynamicFields,
        commissions:
          payload.commissions.length > 0
            ? payload.commissions.map((commission) => ({
                sourceType: commission.sourceType,
                recipientType: commission.recipientType,
                direction: commission.direction,
                beneficiaryId:
                  commission.recipientType === "OTHER"
                    ? undefined
                    : commission.beneficiaryId || undefined,
                beneficiaryLabel:
                  commission.recipientType === "OTHER"
                    ? commission.beneficiaryLabel?.trim() || undefined
                    : undefined,
                startDate: commission.startDate,
                totalPercentage: commission.totalPercentage,
                installments: commission.installments.map((installment) => ({
                  installmentNumber: installment.installmentNumber,
                  percentage: installment.percentage,
                })),
              }))
            : undefined,
      } as const;

      return createSale(slug, normalizedPayload);
    },
    onSuccess: async (createdSaleId) => {
      await queryClient.invalidateQueries({ queryKey: salesQueryKeys.list(slug) });
      await queryClient.invalidateQueries({ queryKey: salesQueryKeys.dashboard(slug, { month: "" }) });
      Alert.alert("Sucesso", "Venda cadastrada com sucesso.");
      router.replace({
        pathname: "/sales/[saleId]" as never,
        params: { saleId: createdSaleId },
      } as never);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: SaleFormValues) => {
      if (!saleId) {
        throw new Error("ID da venda não informado.");
      }

      const normalizedPayload = {
        saleDate: payload.saleDate,
        customerId: payload.customerId,
        productId: payload.productId,
        totalAmount: parseCurrencyToCents(payload.totalAmount),
        responsible: {
          type: payload.responsibleType,
          id: payload.responsibleId,
        },
        companyId: payload.companyId,
        unitId: payload.unitId?.trim() ? payload.unitId : undefined,
        notes: payload.notes?.trim() ? payload.notes.trim() : undefined,
        dynamicFields: payload.dynamicFields,
        commissions:
          payload.commissions.length > 0
            ? payload.commissions.map((commission) => ({
                sourceType: commission.sourceType,
                recipientType: commission.recipientType,
                direction: commission.direction,
                beneficiaryId:
                  commission.recipientType === "OTHER"
                    ? undefined
                    : commission.beneficiaryId || undefined,
                beneficiaryLabel:
                  commission.recipientType === "OTHER"
                    ? commission.beneficiaryLabel?.trim() || undefined
                    : undefined,
                startDate: commission.startDate,
                totalPercentage: commission.totalPercentage,
                installments: commission.installments.map((installment) => ({
                  installmentNumber: installment.installmentNumber,
                  percentage: installment.percentage,
                })),
              }))
            : undefined,
      } as const;

      await updateSale(slug, saleId, normalizedPayload);
    },
    onSuccess: async () => {
      if (!saleId) {
        return;
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: salesQueryKeys.list(slug) }),
        queryClient.invalidateQueries({ queryKey: salesQueryKeys.detail(slug, saleId) }),
      ]);
      Alert.alert("Sucesso", "Venda atualizada com sucesso.");
      router.replace({
        pathname: "/sales/[saleId]" as never,
        params: { saleId },
      } as never);
    },
  });

  const createQuickCustomerMutation = useMutation({
    mutationFn: async () => {
      if (!quickCustomerForm.name.trim()) {
        throw new Error("Informe o nome do cliente.");
      }

      const customerId = await createCustomer(slug, {
        personType: "PF",
        name: quickCustomerForm.name.trim(),
        documentType: "CPF",
        documentNumber: unmask(quickCustomerForm.document),
        phone: quickCustomerForm.phone ? unmask(quickCustomerForm.phone) : undefined,
      });

      return customerId;
    },
    onSuccess: async (customerId) => {
      await queryClient.invalidateQueries({ queryKey: salesQueryKeys.formOptions(slug) });
      setValue("customerId", customerId, { shouldDirty: true, shouldValidate: true });
      setQuickCustomerForm(getDefaultQuickCustomerValues());
      setQuickCustomerModalOpen(false);
      Alert.alert("Sucesso", "Cliente criado e selecionado.");
    },
  });

  const productOptions = useMemo(() => {
    const products = optionsQuery.data?.products ?? [];
    return flattenActiveProductOptions(products).map((product) => ({
      label: product.label,
      value: product.id,
    }));
  }, [optionsQuery.data?.products]);

  const customersOptions = useMemo(
    () =>
      (optionsQuery.data?.customers ?? []).map((customer) => ({
        label: `${customer.name} (${customer.documentNumber})`,
        value: customer.id,
      })),
    [optionsQuery.data?.customers],
  );

  const companiesOptions = useMemo(
    () =>
      (optionsQuery.data?.companies ?? []).map((company) => ({
        label: company.name,
        value: company.id,
      })),
    [optionsQuery.data?.companies],
  );

  const companyUnitsOptions = useMemo(() => {
    const company = (optionsQuery.data?.companies ?? []).find(
      (item) => item.id === selectedCompanyId,
    );
    return (company?.units ?? []).map((unit) => ({
      label: unit.name,
      value: unit.id,
    }));
  }, [optionsQuery.data?.companies, selectedCompanyId]);

  const sellerOptions = useMemo(
    () =>
      (optionsQuery.data?.sellers ?? []).map((seller) => ({
        id: seller.id,
        label: seller.name,
      })),
    [optionsQuery.data?.sellers],
  );

  const partnerOptions = useMemo(
    () =>
      (optionsQuery.data?.partners ?? []).map((partner) => ({
        id: partner.id,
        label: partner.name,
      })),
    [optionsQuery.data?.partners],
  );

  const supervisorOptions = useMemo(
    () => (optionsQuery.data?.supervisors ?? []).map((supervisor) => ({
      id: supervisor.id,
      label: supervisor.name,
    })),
    [optionsQuery.data?.supervisors],
  );

  const responsibleOptions = useMemo(() => {
    if (selectedResponsibleType === "PARTNER") {
      return partnerOptions;
    }

    return sellerOptions;
  }, [partnerOptions, sellerOptions, selectedResponsibleType]);

  const pulledCommissionsCount = useMemo(
    () => (watchedCommissions ?? []).filter((commission) => commission.sourceType === "PULLED").length,
    [watchedCommissions],
  );

  useEffect(() => {
    const currentUnitId = getValues("unitId");
    if (!currentUnitId) {
      return;
    }

    const hasUnit = companyUnitsOptions.some((unit) => unit.value === currentUnitId);
    if (!hasUnit) {
      setValue("unitId", "", { shouldDirty: true, shouldValidate: true });
    }
  }, [companyUnitsOptions, getValues, setValue]);

  useEffect(() => {
    const currentResponsibleId = getValues("responsibleId");
    if (!currentResponsibleId) {
      return;
    }

    const hasResponsible = responsibleOptions.some(
      (responsible) => responsible.id === currentResponsibleId,
    );
    if (!hasResponsible) {
      setValue("responsibleId", "", { shouldDirty: true, shouldValidate: true });
    }
  }, [getValues, responsibleOptions, setValue]);

  useEffect(() => {
    if (!selectedProductId) {
      setDynamicFieldSchema([]);
      setCommissionPullRequestedForProduct(null);
      setMatchedScenarioName(undefined);
      setPullScenarioError(false);
      return;
    }

    void (async () => {
      try {
        const fields = await getProductSaleFields(slug, selectedProductId);
        const mappedFields: SaleDynamicFieldSchemaItem[] = fields.map((field) => ({
          fieldId: field.id,
          label: field.label,
          type: field.type,
          required: field.required,
          options: field.options.map((option) => ({
            id: option.id,
            label: option.label,
            isDefault: option.isDefault,
          })),
        }));

        setDynamicFieldSchema(mappedFields);
        setValue("dynamicFields", {}, { shouldDirty: true, shouldValidate: true });
        setCommissionPullRequestedForProduct(null);
        setMatchedScenarioName(undefined);
        setPullScenarioError(false);
      } catch {
        setDynamicFieldSchema([]);
      }
    })();
  }, [selectedProductId, setValue, slug]);

  useEffect(() => {
    if (mode !== "edit" || !editSaleQuery.data) {
      return;
    }

    reset(mapSaleToFormValues(editSaleQuery.data, prefilledCustomerId));
    setDynamicFieldSchema(
      editSaleQuery.data.dynamicFieldSchema.map((field) => ({
        fieldId: field.fieldId,
        label: field.label,
        type: field.type,
        required: field.required,
        options: field.options.map((option) => ({
          id: option.id,
          label: option.label,
        })),
      })),
    );
  }, [editSaleQuery.data, mode, prefilledCustomerId, reset]);

  useEffect(() => {
    if (mode !== "create" || !duplicateSaleQuery.data) {
      return;
    }

    const duplicated = mapSaleToFormValues(duplicateSaleQuery.data, prefilledCustomerId);
    duplicated.saleDate = getDefaultSaleValues().saleDate;
    reset(duplicated);
    setDynamicFieldSchema(
      duplicateSaleQuery.data.dynamicFieldSchema.map((field) => ({
        fieldId: field.fieldId,
        label: field.label,
        type: field.type,
        required: field.required,
        options: field.options.map((option) => ({
          id: option.id,
          label: option.label,
        })),
      })),
    );
  }, [duplicateSaleQuery.data, mode, prefilledCustomerId, reset]);

  async function handlePullCommissionsFromScenario() {
    if (!selectedProductId) {
      return;
    }

    setIsPullingScenario(true);
    setCommissionPullRequestedForProduct(selectedProductId);
    setPullScenarioError(false);

    try {
      const scenarios = await getProductCommissionScenarios(slug, selectedProductId);
      const matchedScenario = resolveMatchedScenario(scenarios, {
        companyId: selectedCompanyId,
        unitId: selectedUnitId,
        sellerId: selectedResponsibleType === "SELLER" ? selectedResponsibleId : "",
        partnerId: selectedResponsibleType === "PARTNER" ? selectedResponsibleId : "",
      });

      if (!matchedScenario) {
        setMatchedScenarioName(undefined);
        commissionsFieldArray.replace(
          (getValues("commissions") ?? []).filter((commission) => commission.sourceType !== "PULLED"),
        );
        return;
      }

      const nextPulledCommissions: SaleCommissionValues[] = matchedScenario.commissions.map(
        (commission) => ({
          sourceType: "PULLED",
          recipientType: commission.recipientType,
          direction: "OUTCOME",
          beneficiaryId: commission.beneficiaryId ?? "",
          beneficiaryLabel: commission.beneficiaryLabel ?? "",
          startDate: getValues("saleDate"),
          totalPercentage: commission.totalPercentage,
          installments: commission.installments.map((installment) => ({
            installmentNumber: installment.installmentNumber,
            percentage: installment.percentage,
          })),
        }),
      );

      const manualCommissions = (getValues("commissions") ?? []).filter(
        (commission) => commission.sourceType !== "PULLED",
      );
      commissionsFieldArray.replace([...manualCommissions, ...nextPulledCommissions]);
      setMatchedScenarioName(matchedScenario.name);
    } catch {
      setPullScenarioError(true);
    } finally {
      setIsPullingScenario(false);
    }
  }

  function handleAddManualCommission() {
    commissionsFieldArray.append(createDefaultManualCommission(getValues("saleDate")));
  }

  function handleRemovePulledCommissions() {
    const manualCommissions = (getValues("commissions") ?? []).filter(
      (commission) => commission.sourceType !== "PULLED",
    );
    commissionsFieldArray.replace(manualCommissions);
    setMatchedScenarioName(undefined);
  }

  async function onSubmit(values: SaleFormValues) {
    try {
      if (mode === "create") {
        await createMutation.mutateAsync(values);
        return;
      }

      await updateMutation.mutateAsync(values);
    } catch (error) {
      Alert.alert("Erro", getApiErrorMessage(error, "Não foi possível salvar a venda."));
    }
  }

  const isLoadingBase =
    optionsQuery.isLoading ||
    (mode === "edit" && editSaleQuery.isLoading) ||
    (mode === "create" && Boolean(duplicateSaleId) && duplicateSaleQuery.isLoading);
  const isPending = createMutation.isPending || updateMutation.isPending;

  if (isLoadingBase) {
    return (
      <AppScreen>
        <Text className="py-6 text-center text-[14px] text-slate-500">Carregando formulário...</Text>
      </AppScreen>
    );
  }

  if (optionsQuery.isError) {
    return (
      <AppScreen>
        <View className="gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
          <Text className="text-[14px] text-red-700">
            Não foi possível carregar opções do formulário.
          </Text>
          <AppButton
            label="Tentar novamente"
            variant="outline"
            onPress={() => {
              void optionsQuery.refetch();
            }}
          />
        </View>
      </AppScreen>
    );
  }

  if ((mode === "edit" && (editSaleQuery.isError || !editSaleQuery.data)) || !optionsQuery.data) {
    return (
      <AppScreen>
        <View className="gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
          <Text className="text-[14px] text-red-700">
            Não foi possível carregar os dados da venda.
          </Text>
          <AppButton label="Voltar" variant="outline" onPress={() => router.back()} />
        </View>
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <PageHeader
        title={mode === "create" ? "Nova Venda" : "Editar Venda"}
        description="Preencha os dados para registrar ou atualizar a venda."
      />

      <Controller
        control={control}
        name="productId"
        render={({ field, fieldState }) => (
          <View>
            <OptionPicker
              label="Produto *"
              placeholder="Selecione o produto"
              options={productOptions}
              value={field.value}
              onChange={(value) => field.onChange(value ?? "")}
            />
            {fieldState.error ? (
              <Text className="-mt-2 mb-2 text-[12px] text-red-600">{fieldState.error.message}</Text>
            ) : null}
          </View>
        )}
      />

      <Controller
        control={control}
        name="saleDate"
        render={({ field, fieldState }) => (
          <View className="mb-3 gap-1.5">
            <Text className="text-[13px] font-semibold text-slate-900">Data da venda *</Text>
            <TextInput
              className={`h-11 rounded-xl border px-3.5 text-[15px] text-slate-900 ${
                fieldState.error ? "border-red-500 bg-red-50" : "border-slate-300 bg-slate-50"
              }`}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              placeholder="YYYY-MM-DD"
              autoCapitalize="none"
            />
            {fieldState.error ? (
              <Text className="text-[12px] text-red-600">{fieldState.error.message}</Text>
            ) : null}
          </View>
        )}
      />

      <Controller
        control={control}
        name="totalAmount"
        render={({ field, fieldState }) => (
          <View className="mb-3 gap-1.5">
            <Text className="text-[13px] font-semibold text-slate-900">Valor total *</Text>
            <TextInput
              className={`h-11 rounded-xl border px-3.5 text-[15px] text-slate-900 ${
                fieldState.error ? "border-red-500 bg-red-50" : "border-slate-300 bg-slate-50"
              }`}
              value={field.value}
              onChangeText={(value) => field.onChange(formatCurrencyInput(value))}
              onBlur={field.onBlur}
              placeholder="R$ 0,00"
              keyboardType="decimal-pad"
            />
            {fieldState.error ? (
              <Text className="text-[12px] text-red-600">{fieldState.error.message}</Text>
            ) : null}
          </View>
        )}
      />

      <Controller
        control={control}
        name="customerId"
        render={({ field, fieldState }) => (
          <View>
            <OptionPicker
              label="Cliente *"
              placeholder="Selecione o cliente"
              options={customersOptions}
              value={field.value}
              onChange={(value) => field.onChange(value ?? "")}
            />
            {fieldState.error ? (
              <Text className="-mt-2 mb-2 text-[12px] text-red-600">{fieldState.error.message}</Text>
            ) : null}
          </View>
        )}
      />

      <View className="mb-3">
        <AppButton
          label="Cadastrar cliente rápido"
          variant="outline"
          onPress={() => setQuickCustomerModalOpen(true)}
        />
      </View>

      <Controller
        control={control}
        name="companyId"
        render={({ field, fieldState }) => (
          <View>
            <OptionPicker
              label="Empresa *"
              placeholder="Selecione a empresa"
              options={companiesOptions}
              value={field.value}
              onChange={(value) => field.onChange(value ?? "")}
            />
            {fieldState.error ? (
              <Text className="-mt-2 mb-2 text-[12px] text-red-600">{fieldState.error.message}</Text>
            ) : null}
          </View>
        )}
      />

      <Controller
        control={control}
        name="unitId"
        render={({ field, fieldState }) => (
          <View>
            <OptionPicker
              label="Unidade"
              placeholder="Sem unidade"
              options={companyUnitsOptions}
              value={field.value}
              onChange={(value) => field.onChange(value ?? "")}
              allowClear
            />
            {fieldState.error ? (
              <Text className="-mt-2 mb-2 text-[12px] text-red-600">{fieldState.error.message}</Text>
            ) : null}
          </View>
        )}
      />

      <Controller
        control={control}
        name="responsibleType"
        render={({ field }) => (
          <View className="mb-3 gap-1.5">
            <Text className="text-[13px] font-semibold text-slate-900">Tipo de responsável *</Text>
            <View className="flex-row gap-2">
              {(["SELLER", "PARTNER"] as const).map((value) => {
                const isActive = field.value === value;
                return (
                  <Pressable
                    key={value}
                    className={`rounded-full border px-3 py-1.5 ${
                      isActive ? "border-brand-600 bg-brand-50" : "border-slate-300 bg-white"
                    }`}
                    onPress={() => field.onChange(value)}
                  >
                    <Text
                      className={`text-[12px] font-medium ${
                        isActive ? "text-brand-700" : "text-slate-700"
                      }`}
                    >
                      {value === "SELLER" ? "Vendedor" : "Parceiro"}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
      />

      <Controller
        control={control}
        name="responsibleId"
        render={({ field, fieldState }) => (
          <View>
            <OptionPicker
              label={`${selectedResponsibleType === "SELLER" ? "Vendedor" : "Parceiro"} *`}
              placeholder="Selecione o responsável"
              options={responsibleOptions.map((option) => ({
                label: option.label,
                value: option.id,
              }))}
              value={field.value}
              onChange={(value) => field.onChange(value ?? "")}
            />
            {fieldState.error ? (
              <Text className="-mt-2 mb-2 text-[12px] text-red-600">{fieldState.error.message}</Text>
            ) : null}
          </View>
        )}
      />

      <View className="mb-3 rounded-2xl border border-slate-200 bg-white p-4">
        <Text className="mb-2 text-[14px] font-semibold text-slate-900">Campos dinâmicos</Text>
        <SaleDynamicFields control={control} fields={dynamicFieldSchema} disabled={isPending} />
      </View>

      <View className="mb-3 rounded-2xl border border-slate-200 bg-white p-4">
        <Text className="mb-2 text-[14px] font-semibold text-slate-900">Comissões</Text>
        <SaleCommissionsEditor
          control={control}
          getValues={getValues}
          setValue={setValue}
          fields={commissionsFieldArray.fields}
          removeCommission={commissionsFieldArray.remove}
          addManualCommission={handleAddManualCommission}
          removePulledCommissions={handleRemovePulledCommissions}
          pullFromScenario={() => {
            void handlePullCommissionsFromScenario();
          }}
          selectedProductId={selectedProductId}
          isPulling={isPullingScenario}
          pullRequested={commissionPullRequestedForProduct === selectedProductId}
          pullHasError={pullScenarioError}
          matchedScenarioName={matchedScenarioName}
          pulledCommissionsCount={pulledCommissionsCount}
          companyOptions={companiesOptions.map((option) => ({ id: option.value, label: option.label }))}
          unitOptions={companyUnitsOptions.map((option) => ({ id: option.value, label: option.label }))}
          sellerOptions={sellerOptions}
          partnerOptions={partnerOptions}
          supervisorOptions={supervisorOptions}
          saleTotalInCents={saleTotalInCents}
          disabled={isPending}
        />
      </View>

      <Controller
        control={control}
        name="notes"
        render={({ field, fieldState }) => (
          <View className="mb-4 gap-1.5">
            <Text className="text-[13px] font-semibold text-slate-900">Observações</Text>
            <TextInput
              className={`min-h-[96px] rounded-xl border px-3.5 py-3 text-[15px] text-slate-900 ${
                fieldState.error ? "border-red-500 bg-red-50" : "border-slate-300 bg-slate-50"
              }`}
              value={field.value ?? ""}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              multiline
              textAlignVertical="top"
            />
            {fieldState.error ? (
              <Text className="text-[12px] text-red-600">{fieldState.error.message}</Text>
            ) : null}
          </View>
        )}
      />

      <View className="flex-row gap-2">
        <View className="flex-1">
          <AppButton label="Cancelar" variant="outline" onPress={() => router.back()} />
        </View>
        <View className="flex-1">
          <AppButton
            label={mode === "create" ? "Salvar venda" : "Atualizar venda"}
            loading={isPending}
            onPress={() => {
              void handleSubmit(onSubmit)();
            }}
          />
        </View>
      </View>

      <Modal
        visible={quickCustomerModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setQuickCustomerModalOpen(false)}
      >
        <View className="flex-1 items-center justify-center bg-black/45 px-4">
          <View className="w-full rounded-2xl bg-white p-4">
            <Text className="mb-1 text-[18px] font-bold text-slate-900">Cliente rápido</Text>
            <Text className="mb-3 text-[13px] text-slate-500">
              Cadastre um cliente simplificado sem sair da venda.
            </Text>

            <View className="mb-3 gap-1.5">
              <Text className="text-[13px] font-semibold text-slate-900">Nome *</Text>
              <TextInput
                className="h-11 rounded-xl border border-slate-300 bg-slate-50 px-3.5 text-[15px] text-slate-900"
                value={quickCustomerForm.name}
                onChangeText={(value) =>
                  setQuickCustomerForm((current) => ({
                    ...current,
                    name: value,
                  }))
                }
              />
            </View>

            <View className="mb-3 gap-1.5">
              <Text className="text-[13px] font-semibold text-slate-900">CPF *</Text>
              <TextInput
                className="h-11 rounded-xl border border-slate-300 bg-slate-50 px-3.5 text-[15px] text-slate-900"
                value={quickCustomerForm.document}
                onChangeText={(value) =>
                  setQuickCustomerForm((current) => ({
                    ...current,
                    document: maskCpf(value),
                  }))
                }
                keyboardType="number-pad"
              />
            </View>

            <View className="mb-4 gap-1.5">
              <Text className="text-[13px] font-semibold text-slate-900">Telefone</Text>
              <TextInput
                className="h-11 rounded-xl border border-slate-300 bg-slate-50 px-3.5 text-[15px] text-slate-900"
                value={quickCustomerForm.phone}
                onChangeText={(value) =>
                  setQuickCustomerForm((current) => ({
                    ...current,
                    phone: maskPhone(value),
                  }))
                }
                keyboardType="phone-pad"
              />
            </View>

            <View className="flex-row gap-2">
              <View className="flex-1">
                <AppButton
                  label="Cancelar"
                  variant="outline"
                  onPress={() => {
                    setQuickCustomerModalOpen(false);
                    setQuickCustomerForm(getDefaultQuickCustomerValues());
                  }}
                />
              </View>
              <View className="flex-1">
                <AppButton
                  label="Salvar cliente"
                  loading={createQuickCustomerMutation.isPending}
                  onPress={() => {
                    void createQuickCustomerMutation.mutateAsync().catch((error) => {
                      Alert.alert(
                        "Erro",
                        getApiErrorMessage(error, "Não foi possível criar o cliente."),
                      );
                    });
                  }}
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </AppScreen>
  );
}
