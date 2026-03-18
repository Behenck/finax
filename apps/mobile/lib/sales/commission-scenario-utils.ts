import type { SaleCommissionValues } from "@/lib/sales/form-schemas";
import type { ProductCommissionScenarios } from "@/lib/sales/types";

const COMMISSION_PERCENTAGE_SCALE = 10_000;
const COMMISSION_PERCENTAGE_COMPOSITION_DENOMINATOR =
  100 * COMMISSION_PERCENTAGE_SCALE;

type ProductCommission = ProductCommissionScenarios[number]["commissions"][number];

function toScaledPercentage(value: number): number {
  return Math.round((Number(value || 0) + Number.EPSILON) * COMMISSION_PERCENTAGE_SCALE);
}

function fromScaledPercentage(value: number): number {
  return value / COMMISSION_PERCENTAGE_SCALE;
}

function composeScaledPercentages(baseScaled: number, dependentScaled: number): number {
  return Math.round(
    (baseScaled * dependentScaled) / COMMISSION_PERCENTAGE_COMPOSITION_DENOMINATOR,
  );
}

function normalizeInstallmentsScaledToTotal(
  totalScaled: number,
  installmentsScaled: number[],
): number[] {
  if (installmentsScaled.length === 0) {
    return [];
  }

  const normalized = [...installmentsScaled];
  const installmentsTotalScaled = normalized.reduce(
    (sum, installmentScaled) => sum + installmentScaled,
    0,
  );
  const residual = totalScaled - installmentsTotalScaled;
  const lastInstallmentIndex = normalized.length - 1;
  const adjustedLastInstallment = Math.max(
    0,
    (normalized[lastInstallmentIndex] ?? 0) + residual,
  );
  normalized[lastInstallmentIndex] = adjustedLastInstallment;

  return normalized;
}

function deriveDirection(
  recipientType: ProductCommission["recipientType"],
): SaleCommissionValues["direction"] {
  if (recipientType === "COMPANY" || recipientType === "UNIT") {
    return "INCOME";
  }

  return "OUTCOME";
}

function resolveEffectivePercentages(commissions: ProductCommission[]) {
  const memo = new Map<number, { totalScaled: number; installmentsScaled: number[] }>();

  const resolveByIndex = (
    commissionIndex: number,
    stack: Set<number>,
  ): { totalScaled: number; installmentsScaled: number[] } => {
    const memoized = memo.get(commissionIndex);
    if (memoized) {
      return memoized;
    }

    const commission = commissions[commissionIndex];
    const ownTotalScaled = toScaledPercentage(commission?.totalPercentage ?? 0);
    const ownInstallmentsScaled = normalizeInstallmentsScaledToTotal(
      ownTotalScaled,
      commission?.installments.map((installment) =>
        toScaledPercentage(installment.percentage),
      ) ?? [],
    );
    const calculationBase = commission?.calculationBase ?? "SALE_TOTAL";
    const baseCommissionIndex = commission?.baseCommissionIndex;

    if (
      calculationBase !== "COMMISSION" ||
      baseCommissionIndex === undefined ||
      baseCommissionIndex < 0 ||
      baseCommissionIndex >= commissions.length ||
      baseCommissionIndex === commissionIndex ||
      stack.has(commissionIndex)
    ) {
      const ownResult = {
        totalScaled: ownTotalScaled,
        installmentsScaled: ownInstallmentsScaled,
      };
      memo.set(commissionIndex, ownResult);
      return ownResult;
    }

    const nextStack = new Set(stack);
    nextStack.add(commissionIndex);
    const baseEffective = resolveByIndex(baseCommissionIndex, nextStack);
    const effectiveTotalScaled = composeScaledPercentages(
      baseEffective.totalScaled,
      ownTotalScaled,
    );
    const effectiveInstallmentsScaled = normalizeInstallmentsScaledToTotal(
      effectiveTotalScaled,
      ownInstallmentsScaled.map((installmentScaled) =>
        composeScaledPercentages(baseEffective.totalScaled, installmentScaled),
      ),
    );

    const result = {
      totalScaled: effectiveTotalScaled,
      installmentsScaled: effectiveInstallmentsScaled,
    };
    memo.set(commissionIndex, result);

    return result;
  };

  return commissions.map((_commission, commissionIndex) =>
    resolveByIndex(commissionIndex, new Set<number>()),
  );
}

export function mapScenarioCommissionsToPulledCommissions({
  commissions,
  startDate,
}: {
  commissions: ProductCommission[];
  startDate: string;
}): SaleCommissionValues[] {
  const effectivePercentagesByCommissionIndex = resolveEffectivePercentages(commissions);

  return commissions.map((commission, commissionIndex) => ({
    sourceType: "PULLED",
    recipientType: commission.recipientType,
    direction: deriveDirection(commission.recipientType),
    beneficiaryId: commission.beneficiaryId ?? "",
    beneficiaryLabel: commission.beneficiaryLabel ?? "",
    startDate,
    totalPercentage: fromScaledPercentage(
      effectivePercentagesByCommissionIndex[commissionIndex]?.totalScaled ??
        toScaledPercentage(commission.totalPercentage),
    ),
    installments: commission.installments.map((installment, installmentIndex) => ({
      installmentNumber: installment.installmentNumber,
      percentage: fromScaledPercentage(
        effectivePercentagesByCommissionIndex[commissionIndex]?.installmentsScaled[
          installmentIndex
        ] ?? toScaledPercentage(installment.percentage),
      ),
    })),
  }));
}
