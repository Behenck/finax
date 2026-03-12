import {
  ActivityIndicator,
  Pressable,
  Text,
  type PressableProps,
  type PressableStateCallbackType,
} from "react-native";

type AuthButtonVariant = "primary" | "outline" | "ghost";

type AuthButtonProps = Omit<PressableProps, "style"> & {
  label: string;
  loading?: boolean;
  variant?: AuthButtonVariant;
};

const CONTAINER_VARIANT_CLASS: Record<AuthButtonVariant, string> = {
  primary: "bg-brand-600 border-brand-600",
  outline: "bg-white border-slate-300",
  ghost: "bg-transparent border-transparent",
};

const LABEL_VARIANT_CLASS: Record<AuthButtonVariant, string> = {
  primary: "text-white",
  outline: "text-slate-900",
  ghost: "text-slate-900",
};

export function AuthButton({
  label,
  loading = false,
  disabled,
  variant = "primary",
  ...props
}: AuthButtonProps) {
  const isDisabled = Boolean(disabled || loading);

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      className={`h-12 items-center justify-center rounded-xl border ${CONTAINER_VARIANT_CLASS[variant]} ${isDisabled ? "opacity-65" : ""}`}
      style={({ pressed }: PressableStateCallbackType) =>
        pressed && !isDisabled ? { opacity: 0.9 } : undefined
      }
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === "primary" ? "#ffffff" : "#0f172a"}
          size="small"
        />
      ) : (
        <Text className={`text-[15px] font-semibold ${LABEL_VARIANT_CLASS[variant]}`}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}
