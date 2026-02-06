import { addMonths, addYears } from "date-fns"

export type TransactionRecurrenceType =
  | "SINGLE"
  | "MONTH"
  | "YEAR"
  | "INSTALLMENTS"

export type TransactionRecurrenceStrategy = {
  totalOccurrences: number
  calculateNextDate: (baseDate: Date, occurrenceIndex: number) => Date
  shouldSplitAmount?: boolean
}

export function resolveTransactionRecurrenceStrategy(
  recurrenceType: TransactionRecurrenceType,
  recurrenceQuantity?: number
): TransactionRecurrenceStrategy {
  const totalOccurrences = Math.max(recurrenceQuantity ?? 1, 1)

  const strategies: Record<
    TransactionRecurrenceType,
    TransactionRecurrenceStrategy
  > = {
    SINGLE: {
      totalOccurrences: 1,
      calculateNextDate: (baseDate) => baseDate,
    },

    MONTH: {
      totalOccurrences,
      calculateNextDate: (baseDate, index) =>
        addMonths(baseDate, index),
    },

    YEAR: {
      totalOccurrences,
      calculateNextDate: (baseDate, index) =>
        addYears(baseDate, index),
    },

    INSTALLMENTS: {
      totalOccurrences,
      calculateNextDate: (baseDate, index) =>
        addMonths(baseDate, index),
      shouldSplitAmount: true,
    },
  }

  return strategies[recurrenceType]
}
