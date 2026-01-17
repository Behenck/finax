export function applyDateInputMask(value: string) {
  const numbers = value.replace(/\D/g, '').slice(0, 8)

  if (numbers.length <= 2) return numbers
  if (numbers.length <= 4) {
    return `${numbers.slice(0, 2)}/${numbers.slice(2)}`
  }

  return `${numbers.slice(0, 2)}/${numbers.slice(2, 4)}/${numbers.slice(4)}`
}
