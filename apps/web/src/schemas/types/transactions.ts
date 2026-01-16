import { z } from "zod"

export const TransactionTypeSchema = z.enum([
  "INCOME",
  "OUTCOME",
])

export type TransactionType = z.infer<typeof TransactionTypeSchema>

export const TransactionStatusSchema = z.enum([
  "PENDING",
  "PAID",
  "CANCELED",
])

export type TransactionStatus = z.infer<typeof TransactionStatusSchema>