export function applyDateInputMask(value: string) {
  const digits = value.replace(/\D/g, '') // remove tudo que não é número

  const day = digits.slice(0, 2)
  const month = digits.slice(2, 4)
  const year = digits.slice(4, 8)

  if (digits.length <= 2) {
    return day
  }

  if (digits.length <= 4) {
    return `${day}/${month}`
  }

  return `${day}/${month}/${year}`
}
