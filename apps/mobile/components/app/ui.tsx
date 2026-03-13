import { Controller, type Control, type FieldValues, type Path } from "react-hook-form";
import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  type KeyboardTypeOptions,
  type PressableProps,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type ScreenProps = {
  children: ReactNode;
  scroll?: boolean;
};

export function AppScreen({ children, scroll = true }: ScreenProps) {
  if (!scroll) {
    return <SafeAreaView className="flex-1 bg-white">{children}</SafeAreaView>;
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <View>{children}</View>
      </ScrollView>
    </SafeAreaView>
  );
}

type PageHeaderProps = {
  title: string;
  description?: string;
  action?: React.ReactNode;
};

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <View className="mb-4 gap-2">
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1 gap-1">
          <Text className="text-[24px] font-bold text-slate-900">{title}</Text>
          {description ? (
            <Text className="text-[13px] leading-5 text-slate-500">{description}</Text>
          ) : null}
        </View>
        {action ? <View>{action}</View> : null}
      </View>
    </View>
  );
}

export function SearchField({
  value,
  onChangeText,
  placeholder = "Buscar...",
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}) {
  return (
    <TextInput
      className="mb-3 h-11 rounded-xl border border-slate-300 bg-slate-50 px-3.5 text-[15px] text-slate-900"
      placeholder={placeholder}
      placeholderTextColor="#94a3b8"
      value={value}
      onChangeText={onChangeText}
    />
  );
}

type AppButtonVariant = "primary" | "outline" | "danger";

const BUTTON_VARIANTS: Record<AppButtonVariant, string> = {
  primary: "border-brand-600 bg-brand-600",
  outline: "border-slate-300 bg-white",
  danger: "border-red-600 bg-red-600",
};

const BUTTON_LABEL_VARIANTS: Record<AppButtonVariant, string> = {
  primary: "text-white",
  outline: "text-slate-900",
  danger: "text-white",
};

type AppButtonProps = Omit<PressableProps, "style"> & {
  label: string;
  loading?: boolean;
  variant?: AppButtonVariant;
};

export function AppButton({
  label,
  loading = false,
  disabled,
  variant = "primary",
  ...props
}: AppButtonProps) {
  const isDisabled = Boolean(disabled || loading);

  return (
    <Pressable
      className={`h-11 items-center justify-center rounded-xl border px-4 ${BUTTON_VARIANTS[variant]} ${isDisabled ? "opacity-60" : ""}`}
      disabled={isDisabled}
      style={({ pressed }) => (pressed && !isDisabled ? { opacity: 0.92 } : undefined)}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === "outline" ? "#0f172a" : "#ffffff"}
        />
      ) : (
        <Text className={`text-[14px] font-semibold ${BUTTON_LABEL_VARIANTS[variant]}`}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function Card({ children }: { children: ReactNode }) {
  return <View className="mb-3 rounded-2xl border border-slate-200 bg-white p-4">{children}</View>;
}

export function EmptyState({ message }: { message: string }) {
  return (
    <View className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8">
      <Text className="text-center text-[14px] text-slate-500">{message}</Text>
    </View>
  );
}

type FormTextFieldProps<T extends FieldValues> = {
  control: Control<T>;
  name: Path<T>;
  label: string;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  secureTextEntry?: boolean;
  multiline?: boolean;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  transform?: (value: string) => string;
};

export function FormTextField<T extends FieldValues>({
  control,
  name,
  label,
  placeholder,
  keyboardType = "default",
  secureTextEntry,
  multiline,
  autoCapitalize = "sentences",
  transform,
}: FormTextFieldProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <View className="mb-3 gap-1.5">
          <Text className="text-[13px] font-semibold text-slate-900">{label}</Text>
          <TextInput
            className={`rounded-xl border px-3.5 text-[15px] text-slate-900 ${
              multiline ? "min-h-[96px] py-3" : "h-11"
            } ${fieldState.error ? "border-red-500 bg-red-50" : "border-slate-300 bg-slate-50"}`}
            value={String(field.value ?? "")}
            onBlur={field.onBlur}
            onChangeText={(text) => {
              const nextValue = transform ? transform(text) : text;
              field.onChange(nextValue);
            }}
            placeholder={placeholder}
            placeholderTextColor="#94a3b8"
            keyboardType={keyboardType}
            secureTextEntry={secureTextEntry}
            multiline={multiline}
            textAlignVertical={multiline ? "top" : "center"}
            autoCapitalize={autoCapitalize}
          />
          {fieldState.error ? (
            <Text className="text-[12px] text-red-600">{fieldState.error.message}</Text>
          ) : null}
        </View>
      )}
    />
  );
}

type Option<TValue extends string> = {
  label: string;
  value: TValue;
};

type FormOptionGroupProps<TFieldValues extends FieldValues, TValue extends string> = {
  control: Control<TFieldValues>;
  name: Path<TFieldValues>;
  label: string;
  options: Option<TValue>[];
  nullable?: boolean;
  noneLabel?: string;
};

export function FormOptionGroup<TFieldValues extends FieldValues, TValue extends string>({
  control,
  name,
  label,
  options,
  nullable = false,
  noneLabel = "Nenhum",
}: FormOptionGroupProps<TFieldValues, TValue>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <View className="mb-3 gap-1.5">
          <Text className="text-[13px] font-semibold text-slate-900">{label}</Text>
          <View className="flex-row flex-wrap gap-2">
            {nullable ? (
              <Pressable
                className={`rounded-full border px-3 py-1.5 ${
                  !field.value
                    ? "border-brand-600 bg-brand-50"
                    : "border-slate-300 bg-white"
                }`}
                onPress={() => field.onChange(undefined)}
              >
                <Text
                  className={`text-[12px] font-medium ${
                    !field.value ? "text-brand-700" : "text-slate-700"
                  }`}
                >
                  {noneLabel}
                </Text>
              </Pressable>
            ) : null}
            {options.map((option) => {
              const isActive = field.value === option.value;
              return (
                <Pressable
                  key={option.value}
                  className={`rounded-full border px-3 py-1.5 ${
                    isActive ? "border-brand-600 bg-brand-50" : "border-slate-300 bg-white"
                  }`}
                  onPress={() => field.onChange(option.value)}
                >
                  <Text
                    className={`text-[12px] font-medium ${
                      isActive ? "text-brand-700" : "text-slate-700"
                    }`}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {fieldState.error ? (
            <Text className="text-[12px] text-red-600">{fieldState.error.message}</Text>
          ) : null}
        </View>
      )}
    />
  );
}
