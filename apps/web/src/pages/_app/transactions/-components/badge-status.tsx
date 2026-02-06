import type { TransactionStatus } from "@/schemas/types/transactions"
import { Badge } from "@/components/ui/badge"
import { isBefore, startOfDay } from "date-fns"

type BadgeConfig = {
  label: string
  variant: "default" | "secondary" | "destructive" | "outline"
  className?: string
}

/**
 * Badge padrão por status
 */
export const TRANSACTION_BADGE: Record<TransactionStatus, BadgeConfig> = {
  PENDING: {
    label: "Pendente",
    variant: "outline",
    className: "bg-yellow-500/15 text-yellow-700 border-yellow-500/30",
  },
  PAID: {
    label: "Pago",
    variant: "outline",
    className: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  },
  CANCELED: {
    label: "Cancelado",
    variant: "outline",
    className: "bg-red-500/15 text-red-700 border-red-500/30",
  },
}

/**
 * Badge para atraso
 */
const OVERDUE_BADGE: BadgeConfig = {
  label: "Atrasado",
  variant: "outline",
  className: "bg-red-600/20 text-red-700 border-red-600/40",
}

/**
 * Verifica se está vencido
 */
function isOverdue(dueDate?: Date | string | null) {
  if (!dueDate) return false

  const due = startOfDay(new Date(dueDate))
  const today = startOfDay(new Date())

  return isBefore(due, today)
}

interface BadgeStatusProps {
  status: TransactionStatus
  dueDate?: Date | string | null
}

export function BadgeStatus({ status, dueDate }: BadgeStatusProps) {
  const late = status === "PENDING" && isOverdue(dueDate)

  const config = late
    ? OVERDUE_BADGE
    : TRANSACTION_BADGE[status]

  return (
    <Badge
      variant={config.variant}
      className={config.className}
    >
      {config.label}
    </Badge>
  )
}
