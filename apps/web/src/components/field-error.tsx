import { FieldError as FieldErrorUI } from "./ui/field"

interface FieldErrorProps {
  error?: unknown
}

function getErrorMessage(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined

  // RHF costuma colocar { message?: string } no nó do erro
  const msg = (error as { message?: unknown }).message
  return typeof msg === "string" ? msg : undefined
}

export function FieldError({ error }: FieldErrorProps) {
  const message = getErrorMessage(error)
  if (!message) return null

  return <FieldErrorUI>{message}</FieldErrorUI>
}
