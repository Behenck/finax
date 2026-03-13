import { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { AppButton } from "@/components/app/ui";

type Option = {
  label: string;
  value: string;
};

type BasePickerProps = {
  label: string;
  placeholder?: string;
  options: Option[];
  searchable?: boolean;
  emptyMessage?: string;
  disabled?: boolean;
};

type OptionPickerProps = BasePickerProps & {
  value?: string;
  onChange: (value?: string) => void;
  allowClear?: boolean;
};

export function OptionPicker({
  label,
  placeholder = "Selecionar",
  options,
  value,
  onChange,
  searchable = true,
  emptyMessage = "Nenhuma opção encontrada.",
  disabled = false,
  allowClear = false,
}: OptionPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selectedLabel = useMemo(
    () => options.find((option) => option.value === value)?.label,
    [options, value],
  );

  const filteredOptions = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) {
      return options;
    }

    return options.filter((option) =>
      option.label.toLowerCase().includes(normalizedSearch),
    );
  }, [options, search]);

  function handleSelect(optionValue: string) {
    onChange(optionValue);
    setOpen(false);
    setSearch("");
  }

  return (
    <View className="mb-3 gap-1.5">
      <Text className="text-[13px] font-semibold text-slate-900">{label}</Text>

      <Pressable
        className={`h-11 justify-center rounded-xl border px-3.5 ${
          disabled ? "border-slate-200 bg-slate-100" : "border-slate-300 bg-slate-50"
        }`}
        onPress={() => {
          if (disabled) {
            return;
          }
          setOpen(true);
        }}
        style={({ pressed }) => (pressed && !disabled ? { opacity: 0.92 } : undefined)}
      >
        <Text className={`text-[15px] ${value ? "text-slate-900" : "text-slate-400"}`}>
          {selectedLabel ?? placeholder}
        </Text>
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <View className="flex-1 items-center justify-center bg-black/45 px-4">
          <View className="max-h-[75%] w-full rounded-2xl bg-white p-4">
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-[16px] font-semibold text-slate-900">{label}</Text>
              <Pressable onPress={() => setOpen(false)}>
                <Text className="text-[14px] font-medium text-brand-700">Fechar</Text>
              </Pressable>
            </View>

            {searchable ? (
              <TextInput
                className="mb-3 h-11 rounded-xl border border-slate-300 bg-slate-50 px-3.5 text-[15px] text-slate-900"
                placeholder="Buscar..."
                placeholderTextColor="#94a3b8"
                value={search}
                onChangeText={setSearch}
                autoCapitalize="none"
              />
            ) : null}

            <ScrollView className="max-h-[420px]">
              {filteredOptions.length === 0 ? (
                <Text className="py-6 text-center text-[14px] text-slate-500">
                  {emptyMessage}
                </Text>
              ) : (
                filteredOptions.map((option) => {
                  const isSelected = option.value === value;
                  return (
                    <Pressable
                      key={option.value}
                      className={`mb-1 rounded-xl border px-3 py-2.5 ${
                        isSelected
                          ? "border-brand-600 bg-brand-50"
                          : "border-slate-200 bg-white"
                      }`}
                      onPress={() => handleSelect(option.value)}
                    >
                      <Text
                        className={`text-[14px] ${
                          isSelected ? "font-semibold text-brand-700" : "text-slate-700"
                        }`}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })
              )}
            </ScrollView>

            {allowClear ? (
              <View className="mt-3">
                <AppButton
                  label="Limpar seleção"
                  variant="outline"
                  onPress={() => {
                    onChange(undefined);
                    setOpen(false);
                    setSearch("");
                  }}
                />
              </View>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

type MultiOptionPickerProps = BasePickerProps & {
  value: string[];
  onChange: (value: string[]) => void;
};

export function MultiOptionPicker({
  label,
  placeholder = "Selecionar",
  options,
  value,
  onChange,
  searchable = true,
  emptyMessage = "Nenhuma opção encontrada.",
  disabled = false,
}: MultiOptionPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selectedLabel = useMemo(() => {
    if (value.length === 0) {
      return undefined;
    }

    if (value.length === 1) {
      return options.find((option) => option.value === value[0])?.label;
    }

    return `${value.length} selecionados`;
  }, [options, value]);

  const filteredOptions = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) {
      return options;
    }

    return options.filter((option) =>
      option.label.toLowerCase().includes(normalizedSearch),
    );
  }, [options, search]);

  function toggleOption(optionValue: string) {
    if (value.includes(optionValue)) {
      onChange(value.filter((current) => current !== optionValue));
      return;
    }

    onChange([...value, optionValue]);
  }

  return (
    <View className="mb-3 gap-1.5">
      <Text className="text-[13px] font-semibold text-slate-900">{label}</Text>

      <Pressable
        className={`h-11 justify-center rounded-xl border px-3.5 ${
          disabled ? "border-slate-200 bg-slate-100" : "border-slate-300 bg-slate-50"
        }`}
        onPress={() => {
          if (disabled) {
            return;
          }
          setOpen(true);
        }}
        style={({ pressed }) => (pressed && !disabled ? { opacity: 0.92 } : undefined)}
      >
        <Text className={`text-[15px] ${value.length > 0 ? "text-slate-900" : "text-slate-400"}`}>
          {selectedLabel ?? placeholder}
        </Text>
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <View className="flex-1 items-center justify-center bg-black/45 px-4">
          <View className="max-h-[75%] w-full rounded-2xl bg-white p-4">
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-[16px] font-semibold text-slate-900">{label}</Text>
              <Pressable onPress={() => setOpen(false)}>
                <Text className="text-[14px] font-medium text-brand-700">Concluir</Text>
              </Pressable>
            </View>

            {searchable ? (
              <TextInput
                className="mb-3 h-11 rounded-xl border border-slate-300 bg-slate-50 px-3.5 text-[15px] text-slate-900"
                placeholder="Buscar..."
                placeholderTextColor="#94a3b8"
                value={search}
                onChangeText={setSearch}
                autoCapitalize="none"
              />
            ) : null}

            <ScrollView className="max-h-[420px]">
              {filteredOptions.length === 0 ? (
                <Text className="py-6 text-center text-[14px] text-slate-500">
                  {emptyMessage}
                </Text>
              ) : (
                filteredOptions.map((option) => {
                  const isSelected = value.includes(option.value);
                  return (
                    <Pressable
                      key={option.value}
                      className={`mb-1 rounded-xl border px-3 py-2.5 ${
                        isSelected
                          ? "border-brand-600 bg-brand-50"
                          : "border-slate-200 bg-white"
                      }`}
                      onPress={() => toggleOption(option.value)}
                    >
                      <Text
                        className={`text-[14px] ${
                          isSelected ? "font-semibold text-brand-700" : "text-slate-700"
                        }`}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })
              )}
            </ScrollView>

            <View className="mt-3">
              <AppButton label="Limpar seleção" variant="outline" onPress={() => onChange([])} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
