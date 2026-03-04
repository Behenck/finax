export function formatCurrencyBRL(value: string | number) {
  const numericValue =
    typeof value === 'number'
      ? value
      : Number(value.replace(/\D/g, '')) / 100

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(numericValue)
}

export function parseBRLCurrencyToNumber(value: string | null | undefined): number {
  if (!value) return 0

  return Number(
    value
      .replace(/\s/g, "")
      .replace("R$", "")
      .replace(/\./g, "")
      .replace(",", ".")
  )
}

export function parseBRLCurrencyToCents(value: string | null | undefined): number {
  const numericValue = parseBRLCurrencyToNumber(value)
  return Math.round(numericValue * 100)
}
