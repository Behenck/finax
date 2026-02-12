export function hasAnyValue(obj?: Record<string, unknown>) {
  if (!obj) return false
  return Object.values(obj).some((v) => v !== undefined && v !== null && v !== "")
}
