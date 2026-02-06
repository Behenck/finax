import type { TransactionType } from "@/schemas/types/transactions"
import { formatCurrencyBRL } from "@/utils/format-amount"
import type { ReactNode } from "react"

type AmountConfig = {
  className?: string
}

export const TRANSACTION_AMOUNT: Record<TransactionType, AmountConfig> = {
  INCOME: {
    className: "text-green-600",
  },
  OUTCOME: {
    className: "text-red-600",
  },
}


interface BadgeStatusProps {
  children: ReactNode
  type: TransactionType
}

export function TransactionAmount({ children, type }: BadgeStatusProps) {
  const config = TRANSACTION_AMOUNT[type]
  const amount = Number(children) / 100

  return (
    <span className={`font-bold ${config.className}`}>
      {type === "OUTCOME" && "-"}
      {formatCurrencyBRL(amount)}
    </span>
  )
}
