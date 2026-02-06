import type { TransactionType } from "@/schemas/types/transactions"
import { TrendingDown, TrendingUp, Users } from "lucide-react"

interface TransactionTypeProps {
  type: TransactionType
  refundedBy: {
    id: string,
    name: string | null
  } | null
}

const TRANSACTION_TYPE: Record<string, string> = {
  INCOME: "Receita",
  OUTCOME: "Despesa"
}

export function TransactionType({ refundedBy, type }: TransactionTypeProps) {
  return (
    <div>
      <div className="flex items-center gap-2">
        {type === "INCOME" && !refundedBy ?
          <TrendingUp className="size-4 text-green-500" /> :
          type === "OUTCOME" && !refundedBy ?
            <TrendingDown className="size-4 text-red-500" /> :
            <Users className="size-4 text-blue-500" />
        }
        <span>{!!refundedBy ? "Reembolso" : TRANSACTION_TYPE[type]}</span>
      </div>
      {
        !!refundedBy && (
          <span className="text-xs text-muted-foreground">{refundedBy.name}</span>
        )
      }
    </div>
  )
}