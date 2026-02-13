type DocumentType = "CPF" | "CNPJ" | "RG" | "PASSPORT" | "IE" | "OTHER"

type FormatDocumentParams = {
  type?: DocumentType
  value: string
}

function onlyDigits(value: string) {
  return (value ?? "").replace(/\D/g, "")
}

function applyMask(digits: string, pattern: string) {
  let result = ""
  let di = 0

  for (let pi = 0; pi < pattern.length; pi++) {
    const p = pattern[pi]

    if (p === "0") {
      if (!digits[di]) break
      result += digits[di++]
      continue
    }

    // só adiciona separador se houver dígito depois
    if (digits[di]) {
      result += p
    }
  }

  // remove qualquer separador sobrando no final
  return result.replace(/[.\-/ ]+$/, "")
}

export function formatDocument({
  type,
  value,
}: FormatDocumentParams) {
  if (!value) return ""

  const digits = onlyDigits(value)

  switch (type) {
    case "CPF":
      return applyMask(digits, "000.000.000-00")

    case "CNPJ":
      return applyMask(digits, "00.000.000/0000-00")

    case "RG":
      return applyMask(digits, "00.000.000-0")

    case "PASSPORT":
      return value.toUpperCase()

    case "IE":
    case "OTHER":
    default:
      return value
  }
}
