import { randomBytes } from "crypto"

export function generateHexCode() {
  return randomBytes(4).toString("hex").toUpperCase()
}
