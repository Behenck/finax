import { Controller, type Control } from "react-hook-form";
import { Text, TextInput, View } from "react-native";
import { MultiOptionPicker, OptionPicker } from "@/components/app/option-picker";
import type { SaleDynamicFieldSchemaItem, SaleFormValues } from "@/lib/sales";
import { formatCurrencyInput } from "@/lib/sales";

type SaleDynamicFieldsProps = {
  control: Control<SaleFormValues>;
  fields: SaleDynamicFieldSchemaItem[];
  disabled?: boolean;
};

function formatDynamicFieldValue(type: SaleDynamicFieldSchemaItem["type"], value: string): string {
  if (type === "CURRENCY") {
    return formatCurrencyInput(value);
  }

  return value;
}

function keyboardByType(type: SaleDynamicFieldSchemaItem["type"]) {
  if (type === "NUMBER" || type === "CURRENCY") {
    return "decimal-pad";
  }

  if (type === "PHONE") {
    return "phone-pad";
  }

  return "default";
}

export function SaleDynamicFields({ control, fields, disabled = false }: SaleDynamicFieldsProps) {
  if (fields.length === 0) {
    return (
      <View className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6">
        <Text className="text-center text-[14px] text-slate-500">
          Este produto não possui campos dinâmicos.
        </Text>
      </View>
    );
  }

  return (
    <View className="gap-2">
      {fields.map((field) => {
        const name = `dynamicFields.${field.fieldId}` as const;
        const isSelect = field.type === "SELECT";
        const isMultiSelect = field.type === "MULTI_SELECT";

        if (isSelect) {
          return (
            <Controller
              key={field.fieldId}
              control={control}
              name={name}
              render={({ field: controllerField, fieldState }) => (
                <View>
                  <OptionPicker
                    label={`${field.label}${field.required ? " *" : ""}`}
                    placeholder="Selecionar opção"
                    options={field.options.map((option) => ({
                      label: option.label,
                      value: option.id,
                    }))}
                    value={typeof controllerField.value === "string" ? controllerField.value : undefined}
                    onChange={(value) => controllerField.onChange(value ?? "")}
                    disabled={disabled}
                    allowClear={!field.required}
                  />
                  {fieldState.error ? (
                    <Text className="-mt-2 mb-2 text-[12px] text-red-600">
                      {fieldState.error.message}
                    </Text>
                  ) : null}
                </View>
              )}
            />
          );
        }

        if (isMultiSelect) {
          return (
            <Controller
              key={field.fieldId}
              control={control}
              name={name}
              render={({ field: controllerField, fieldState }) => (
                <View>
                  <MultiOptionPicker
                    label={`${field.label}${field.required ? " *" : ""}`}
                    placeholder="Selecionar opções"
                    options={field.options.map((option) => ({
                      label: option.label,
                      value: option.id,
                    }))}
                    value={Array.isArray(controllerField.value) ? controllerField.value : []}
                    onChange={controllerField.onChange}
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
          );
        }

        const isMultiline = field.type === "RICH_TEXT" || field.type === "TEXT";
        const placeholder =
          field.type === "DATE"
            ? "YYYY-MM-DD"
            : field.type === "DATE_TIME"
              ? "YYYY-MM-DD HH:mm"
              : "";

        return (
          <Controller
            key={field.fieldId}
            control={control}
            name={name}
            render={({ field: controllerField, fieldState }) => (
              <View className="mb-3 gap-1.5">
                <Text className="text-[13px] font-semibold text-slate-900">
                  {field.label}
                  {field.required ? " *" : ""}
                </Text>
                <TextInput
                  className={`rounded-xl border px-3.5 text-[15px] text-slate-900 ${
                    isMultiline ? "min-h-[96px] py-3" : "h-11"
                  } ${fieldState.error ? "border-red-500 bg-red-50" : "border-slate-300 bg-slate-50"}`}
                  value={String(controllerField.value ?? "")}
                  onChangeText={(text) =>
                    controllerField.onChange(formatDynamicFieldValue(field.type, text))
                  }
                  onBlur={controllerField.onBlur}
                  keyboardType={keyboardByType(field.type)}
                  multiline={isMultiline}
                  textAlignVertical={isMultiline ? "top" : "center"}
                  editable={!disabled}
                  placeholder={placeholder}
                  placeholderTextColor="#94a3b8"
                  autoCapitalize="none"
                />
                {fieldState.error ? (
                  <Text className="text-[12px] text-red-600">{fieldState.error.message}</Text>
                ) : null}
              </View>
            )}
          />
        );
      })}
    </View>
  );
}
