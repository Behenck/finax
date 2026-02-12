export function formatPhone(phone?: string | null) {
  if (!phone) return ""

  // remove tudo que não for número
  const digits = phone.replace(/\D/g, "")

  // precisa ter pelo menos DDD + número
  if (digits.length < 10) return phone

  const ddd = digits.slice(0, 2)
  const number = digits.slice(2)

  // celular com 9 dígitos
  if (number.length === 9) {
    return `(${ddd}) ${number.slice(0, 5)}-${number.slice(5)}`
  }

  // telefone com 8 dígitos
  if (number.length === 8) {
    return `(${ddd}) ${number.slice(0, 4)}-${number.slice(4)}`
  }

  // fallback
  return phone
}
