import { Controller, type Control, type UseFormGetValues, type UseFormSetValue } from "react-hook-form";
import { Pressable, Text, TextInput, View } from "react-native";
import { OptionPicker } from "@/components/app/option-picker";
import { AppButton } from "@/components/app/ui";
import {
  SALE_COMMISSION_DIRECTION_LABEL,
  SALE_COMMISSION_RECIPIENT_TYPE_LABEL,
  formatCurrencyBRLFromCents,
  type SaleFormValues,
  type SaleCommissionValues,
} from "@/lib/sales";

type SelectOption = {
  id: string;
  label: string;
};

type SaleCommissionsEditorProps = {
  control: Control<SaleFormValues>;
  getValues: UseFormGetValues<SaleFormValues>;
  setValue: UseFormSetValue<SaleFormValues>;
  fields: { id: string }[];
  removeCommission: (index: number) => void;
  addManualCommission: () => void;
  removePulledCommissions: () => void;
  pullFromScenario: () => void;
  selectedProductId: string;
  isPulling: boolean;
  pullRequested: boolean;
  pullHasError: boolean;
  matchedScenarioName?: string;
  pulledCommissionsCount: number;
  companyOptions: SelectOption[];
  unitOptions: SelectOption[];
  sellerOptions: SelectOption[];
  partnerOptions: SelectOption[];
  supervisorOptions: SelectOption[];
  saleTotalInCents: number;
  disabled?: boolean;
};

function formatPercentageInput(rawValue: string): string {
  const sanitized = rawValue.replace(/[^0-9,.-]/g, "").replace(",", ".");
  if (!sanitized) {
    return "";
  }

  const value = Number(sanitized);
  if (!Number.isFinite(value)) {
    return "";
  }

  return String(value);
}

function distributeInstallments(totalPercentage: number, installmentsCount: number) {
  if (installmentsCount <= 0) {
    return [];
  }

  const base = totalPercentage / installmentsCount;
  const roundedBase = Number(base.toFixed(4));
  const installments = Array.from({ length: installmentsCount }, (_, index) => ({
    installmentNumber: index + 1,
    percentage: roundedBase,
  }));

  const diff =
    totalPercentage -
    installments.reduce((sum, installment) => sum + installment.percentage, 0);

  installments[installments.length - 1] = {
    ...installments[installments.length - 1],
    percentage: Number((installments[installments.length - 1].percentage + diff).toFixed(4)),
  };

  return installments;
}

function resolveBeneficiaryOptions(
  recipientType: SaleCommissionValues["recipientType"],
  options: {
    companyOptions: SelectOption[];
    unitOptions: SelectOption[];
    sellerOptions: SelectOption[];
    partnerOptions: SelectOption[];
    supervisorOptions: SelectOption[];
  },
): SelectOption[] {
  if (recipientType === "COMPANY") {
    return options.companyOptions;
  }

  if (recipientType === "UNIT") {
    return options.unitOptions;
  }

  if (recipientType === "SELLER") {
    return options.sellerOptions;
  }

  if (recipientType === "PARTNER") {
    return options.partnerOptions;
  }

  if (recipientType === "SUPERVISOR") {
    return options.supervisorOptions;
  }

  return [];
}

export function SaleCommissionsEditor({
  control,
  getValues,
  setValue,
  fields,
  removeCommission,
  addManualCommission,
  removePulledCommissions,
  pullFromScenario,
  selectedProductId,
  isPulling,
  pullRequested,
  pullHasError,
  matchedScenarioName,
  pulledCommissionsCount,
  companyOptions,
  unitOptions,
  sellerOptions,
  partnerOptions,
  supervisorOptions,
  saleTotalInCents,
  disabled = false,
}: SaleCommissionsEditorProps) {
  return (
    <View className="gap-3">
      <View className="rounded-2xl border border-slate-200 bg-white p-4">
        <View className="mb-3 flex-row flex-wrap gap-2">
          <View className="min-w-[47%] flex-1">
            <AppButton
              label="Adicionar comissão"
              variant="outline"
              disabled={disabled}
              onPress={addManualCommission}
            />
          </View>
          <View className="min-w-[47%] flex-1">
            <AppButton
              label={isPulling ? "Carregando..." : pullRequested ? "Atualizar cenário" : "Buscar cenário"}
              variant="outline"
              disabled={disabled || !selectedProductId || isPulling}
              onPress={pullFromScenario}
            />
          </View>
          <View className="w-full">
            <AppButton
              label="Remover comissões do cenário"
              variant="outline"
              disabled={disabled || pulledCommissionsCount === 0}
              onPress={removePulledCommissions}
            />
          </View>
        </View>

        {!selectedProductId ? (
          <Text className="text-[13px] text-slate-500">
            Selecione um produto para carregar cenários de comissão.
          </Text>
        ) : pullHasError ? (
          <Text className="text-[13px] text-red-600">
            Não foi possível carregar cenários de comissão.
          </Text>
        ) : matchedScenarioName ? (
          <Text className="text-[13px] text-brand-700">
            Cenário aplicado: {matchedScenarioName}
          </Text>
        ) : pullRequested ? (
          <Text className="text-[13px] text-slate-500">
            Nenhum cenário compatível para o contexto atual.
          </Text>
        ) : null}

        {saleTotalInCents > 0 ? (
          <Text className="mt-3 text-[13px] text-slate-600">
            Valor da venda: {formatCurrencyBRLFromCents(saleTotalInCents)}
          </Text>
        ) : null}
      </View>

      {fields.length === 0 ? (
        <View className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6">
          <Text className="text-center text-[14px] text-slate-500">
            Nenhuma comissão adicionada.
          </Text>
        </View>
      ) : null}

      {fields.map((field, index) => {
        const commission = getValues(`commissions.${index}`);
        const beneficiaryOptions = resolveBeneficiaryOptions(commission.recipientType, {
          companyOptions,
          unitOptions,
          sellerOptions,
          partnerOptions,
          supervisorOptions,
        });
        const installmentsCount = commission.installments.length;

        return (
          <View key={field.id} className="rounded-2xl border border-slate-200 bg-white p-4">
            <View className="mb-2 flex-row items-center justify-between gap-2">
              <Text className="text-[14px] font-semibold text-slate-900">
                Comissão #{index + 1} ({commission.sourceType})
              </Text>
              <Pressable
                className="rounded-full border border-red-300 px-2.5 py-1"
                onPress={() => removeCommission(index)}
                disabled={disabled}
              >
                <Text className="text-[12px] font-semibold text-red-600">Remover</Text>
              </Pressable>
            </View>

            <Controller
              control={control}
              name={`commissions.${index}.recipientType`}
              render={({ field: controllerField }) => (
                <View className="mb-3 gap-1.5">
                  <Text className="text-[13px] font-semibold text-slate-900">Recebedor *</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {(
                      [
                        "COMPANY",
                        "UNIT",
                        "SELLER",
                        "PARTNER",
                        "SUPERVISOR",
                        "OTHER",
                      ] as const
                    ).map((recipientType) => {
                      const isActive = controllerField.value === recipientType;
                      return (
                        <Pressable
                          key={recipientType}
                          className={`rounded-full border px-3 py-1.5 ${
                            isActive
                              ? "border-brand-600 bg-brand-50"
                              : "border-slate-300 bg-white"
                          }`}
                          onPress={() => controllerField.onChange(recipientType)}
                        >
                          <Text
                            className={`text-[12px] font-medium ${
                              isActive ? "text-brand-700" : "text-slate-700"
                            }`}
                          >
                            {SALE_COMMISSION_RECIPIENT_TYPE_LABEL[recipientType]}
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
              name={`commissions.${index}.direction`}
              render={({ field: controllerField }) => (
                <View className="mb-3 gap-1.5">
                  <Text className="text-[13px] font-semibold text-slate-900">Direção *</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {(["OUTCOME", "INCOME"] as const).map((direction) => {
                      const isActive = controllerField.value === direction;
                      return (
                        <Pressable
                          key={direction}
                          className={`rounded-full border px-3 py-1.5 ${
                            isActive
                              ? "border-brand-600 bg-brand-50"
                              : "border-slate-300 bg-white"
                          }`}
                          onPress={() => controllerField.onChange(direction)}
                        >
                          <Text
                            className={`text-[12px] font-medium ${
                              isActive ? "text-brand-700" : "text-slate-700"
                            }`}
                          >
                            {SALE_COMMISSION_DIRECTION_LABEL[direction]}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              )}
            />

            {commission.recipientType === "OTHER" ? (
              <Controller
                control={control}
                name={`commissions.${index}.beneficiaryLabel`}
                render={({ field: controllerField, fieldState }) => (
                  <View className="mb-3 gap-1.5">
                    <Text className="text-[13px] font-semibold text-slate-900">
                      Beneficiário *
                    </Text>
                    <TextInput
                      className={`h-11 rounded-xl border px-3.5 text-[15px] text-slate-900 ${
                        fieldState.error
                          ? "border-red-500 bg-red-50"
                          : "border-slate-300 bg-slate-50"
                      }`}
                      value={controllerField.value ?? ""}
                      onChangeText={controllerField.onChange}
                      onBlur={controllerField.onBlur}
                      editable={!disabled}
                    />
                    {fieldState.error ? (
                      <Text className="text-[12px] text-red-600">{fieldState.error.message}</Text>
                    ) : null}
                  </View>
                )}
              />
            ) : (
              <Controller
                control={control}
                name={`commissions.${index}.beneficiaryId`}
                render={({ field: controllerField, fieldState }) => (
                  <View>
                    <OptionPicker
                      label="Beneficiário *"
                      placeholder="Selecionar beneficiário"
                      options={beneficiaryOptions.map((option) => ({
                        label: option.label,
                        value: option.id,
                      }))}
                      value={controllerField.value}
                      onChange={(value) => controllerField.onChange(value ?? "")}
                      disabled={disabled}
                    />
                    {fieldState.error ? (
                      <Text className="-mt-2 mb-2 text-[12px] text-red-600">
                        {fieldState.error.message}
                      </Text>
                    ) : null}
                  </View>
                )}
              />
            )}

            <Controller
              control={control}
              name={`commissions.${index}.startDate`}
              render={({ field: controllerField, fieldState }) => (
                <View className="mb-3 gap-1.5">
                  <Text className="text-[13px] font-semibold text-slate-900">Início *</Text>
                  <TextInput
                    className={`h-11 rounded-xl border px-3.5 text-[15px] text-slate-900 ${
                      fieldState.error
                        ? "border-red-500 bg-red-50"
                        : "border-slate-300 bg-slate-50"
                    }`}
                    value={controllerField.value}
                    onChangeText={controllerField.onChange}
                    onBlur={controllerField.onBlur}
                    editable={!disabled}
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
              name={`commissions.${index}.totalPercentage`}
              render={({ field: controllerField, fieldState }) => (
                <View className="mb-3 gap-1.5">
                  <Text className="text-[13px] font-semibold text-slate-900">
                    Percentual total (%) *
                  </Text>
                  <TextInput
                    className={`h-11 rounded-xl border px-3.5 text-[15px] text-slate-900 ${
                      fieldState.error
                        ? "border-red-500 bg-red-50"
                        : "border-slate-300 bg-slate-50"
                    }`}
                    value={String(controllerField.value ?? "")}
                    onChangeText={(value) => {
                      const next = formatPercentageInput(value);
                      controllerField.onChange(next ? Number(next) : 0);
                    }}
                    onBlur={controllerField.onBlur}
                    editable={!disabled}
                    keyboardType="decimal-pad"
                  />
                  {fieldState.error ? (
                    <Text className="text-[12px] text-red-600">{fieldState.error.message}</Text>
                  ) : null}
                </View>
              )}
            />

            <View className="mb-2 gap-1.5">
              <Text className="text-[13px] font-semibold text-slate-900">
                Parcelas ({installmentsCount})
              </Text>
              <View className="flex-row gap-2">
                <View className="flex-1">
                  <AppButton
                    label="- Parcela"
                    variant="outline"
                    disabled={disabled || installmentsCount <= 1}
                    onPress={() => {
                      const total = Number(getValues(`commissions.${index}.totalPercentage`) ?? 0);
                      const nextCount = Math.max(1, installmentsCount - 1);
                      setValue(
                        `commissions.${index}.installments`,
                        distributeInstallments(total, nextCount),
                        { shouldDirty: true, shouldValidate: true },
                      );
                    }}
                  />
                </View>
                <View className="flex-1">
                  <AppButton
                    label="+ Parcela"
                    variant="outline"
                    disabled={disabled}
                    onPress={() => {
                      const total = Number(getValues(`commissions.${index}.totalPercentage`) ?? 0);
                      const nextCount = installmentsCount + 1;
                      setValue(
                        `commissions.${index}.installments`,
                        distributeInstallments(total, nextCount),
                        { shouldDirty: true, shouldValidate: true },
                      );
                    }}
                  />
                </View>
              </View>
            </View>

            {commission.installments.map((installment, installmentIndex) => (
              <Controller
                key={`${field.id}-installment-${installment.installmentNumber}`}
                control={control}
                name={`commissions.${index}.installments.${installmentIndex}.percentage`}
                render={({ field: controllerField, fieldState }) => (
                  <View className="mb-2 gap-1.5">
                    <Text className="text-[12px] font-semibold text-slate-700">
                      Parcela {installment.installmentNumber} (%)
                    </Text>
                    <TextInput
                      className={`h-10 rounded-xl border px-3 text-[14px] text-slate-900 ${
                        fieldState.error
                          ? "border-red-500 bg-red-50"
                          : "border-slate-300 bg-slate-50"
                      }`}
                      value={String(controllerField.value ?? "")}
                      onChangeText={(value) => {
                        const next = formatPercentageInput(value);
                        controllerField.onChange(next ? Number(next) : 0);
                      }}
                      editable={!disabled}
                      keyboardType="decimal-pad"
                    />
                    {fieldState.error ? (
                      <Text className="text-[12px] text-red-600">{fieldState.error.message}</Text>
                    ) : null}
                  </View>
                )}
              />
            ))}

            <Text className="mt-1 text-[12px] text-slate-500">
              Valor estimado da comissão:{" "}
              {formatCurrencyBRLFromCents(
                Math.round((saleTotalInCents * Number(commission.totalPercentage || 0)) / 100),
              )}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
