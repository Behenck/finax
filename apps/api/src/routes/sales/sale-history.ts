import type { Prisma } from "generated/prisma/client";
import {
  SaleHistoryAction,
  type SaleCommissionCalculationBase,
  type SaleCommissionDirection,
  type SaleCommissionInstallmentStatus,
  type SaleCommissionRecipientType,
  type SaleCommissionSourceType,
  type SaleResponsibleType,
  type SaleStatus,
} from "generated/prisma/enums";
import { fromScaledPercentage } from "./sale-schemas";
import {
  buildSaleDynamicFieldHistoryValues,
  parseSaleDynamicFieldSchemaJson,
  parseSaleDynamicFieldValuesJson,
  type SaleDynamicFieldHistoryValue,
  type SaleDynamicFieldSchemaSnapshot,
  type SaleDynamicFieldValuesSnapshot,
} from "./sale-dynamic-fields";

export type SaleHistoryChange = {
  path: string;
  before: unknown | null;
  after: unknown | null;
};

export type SaleHistorySnapshot = {
  sale: {
    companyId: string;
    unitId: string | null;
    customerId: string;
    productId: string;
    saleDate: string;
    totalAmount: number;
    status: SaleStatus;
    responsibleType: SaleResponsibleType | null;
    responsibleId: string | null;
    responsibleLabel: string | null;
    notes: string | null;
    dynamicFieldSchema: SaleDynamicFieldSchemaSnapshot;
    dynamicFieldValues: SaleDynamicFieldValuesSnapshot;
  };
  commissions: Array<{
    id: string;
    sourceType: SaleCommissionSourceType;
    recipientType: SaleCommissionRecipientType;
    direction: SaleCommissionDirection;
    calculationBase: SaleCommissionCalculationBase;
    baseCommissionIndex: number | undefined;
    beneficiaryCompanyId: string | null;
    beneficiaryUnitId: string | null;
    beneficiarySellerId: string | null;
    beneficiaryPartnerId: string | null;
    beneficiarySupervisorId: string | null;
    beneficiaryLabel: string | null;
    startDate: string;
    totalPercentage: number;
    sortOrder: number;
    installments: Array<{
      id: string;
      installmentNumber: number;
      percentage: number;
      amount: number;
      status: SaleCommissionInstallmentStatus;
      expectedPaymentDate: string | null;
      paymentDate: string | null;
    }>;
  }>;
};

type SaleHistoryDbClient = Pick<
  Prisma.TransactionClient,
  "sale" | "saleHistoryEvent"
>;

type BaseSaleHistoryEventInput = {
  saleId: string;
  organizationId: string;
  actorId: string;
  action: SaleHistoryAction;
};

function toDateOnlyIso(value: Date) {
  return value.toISOString().slice(0, 10);
}

function toNullableDateOnlyIso(value: Date | null) {
  return value ? toDateOnlyIso(value) : null;
}

function normalizeHistoryValue(value: unknown) {
  if (value === undefined) {
    return null;
  }

  return value;
}

type ComparableSaleHistorySnapshot = Omit<SaleHistorySnapshot, "sale"> & {
  sale: Omit<SaleHistorySnapshot["sale"], "dynamicFieldValues"> & {
    dynamicFieldValues: Record<string, SaleDynamicFieldHistoryValue>;
  };
};

function toComparableSaleHistorySnapshot(
  snapshot: SaleHistorySnapshot,
): ComparableSaleHistorySnapshot {
  return {
    ...snapshot,
    sale: {
      ...snapshot.sale,
      dynamicFieldValues: buildSaleDynamicFieldHistoryValues(
        snapshot.sale.dynamicFieldSchema,
        snapshot.sale.dynamicFieldValues,
      ),
    },
  };
}

function flattenHistorySnapshot(
  value: unknown,
  path = "",
  entries = new Map<string, unknown>(),
) {
  if (
    path.startsWith("sale.dynamicFieldValues.") &&
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    "fieldId" in value &&
    "label" in value &&
    "type" in value &&
    "value" in value
  ) {
    entries.set(path, normalizeHistoryValue(value));
    return entries;
  }

  if (Array.isArray(value)) {
    if (value.length === 0 && path) {
      entries.set(path, []);
      return entries;
    }

    for (const [index, item] of value.entries()) {
      const itemPath = path ? `${path}[${index}]` : `[${index}]`;
      flattenHistorySnapshot(item, itemPath, entries);
    }

    return entries;
  }

  if (value && typeof value === "object") {
    const objectValue = value as Record<string, unknown>;
    const keys = Object.keys(objectValue).sort((a, b) => a.localeCompare(b));

    if (keys.length === 0 && path) {
      entries.set(path, {});
      return entries;
    }

    for (const key of keys) {
      const nextPath = path ? `${path}.${key}` : key;
      flattenHistorySnapshot(objectValue[key], nextPath, entries);
    }

    return entries;
  }

  if (path) {
    entries.set(path, normalizeHistoryValue(value));
  }

  return entries;
}

function areHistoryValuesEqual(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export async function loadSaleHistorySnapshot(
  client: SaleHistoryDbClient,
  saleId: string,
  organizationId: string,
): Promise<SaleHistorySnapshot | null> {
  const sale = await client.sale.findFirst({
    where: {
      id: saleId,
      organizationId,
    },
    select: {
      companyId: true,
      unitId: true,
      customerId: true,
      productId: true,
      saleDate: true,
      totalAmount: true,
      status: true,
      responsibleType: true,
      responsibleId: true,
      responsibleLabel: true,
      notes: true,
      dynamicFieldSchema: true,
      dynamicFieldValues: true,
      commissions: {
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        select: {
          id: true,
          sourceType: true,
          recipientType: true,
          direction: true,
          calculationBase: true,
          baseCommission: {
            select: {
              sortOrder: true,
            },
          },
          beneficiaryCompanyId: true,
          beneficiaryUnitId: true,
          beneficiarySellerId: true,
          beneficiaryPartnerId: true,
          beneficiarySupervisorId: true,
          beneficiaryLabel: true,
          startDate: true,
          totalPercentage: true,
          sortOrder: true,
          installments: {
            orderBy: [{ installmentNumber: "asc" }, { id: "asc" }],
            select: {
              id: true,
              installmentNumber: true,
              percentage: true,
              amount: true,
              status: true,
              expectedPaymentDate: true,
              paymentDate: true,
            },
          },
        },
      },
    },
  });

  if (!sale) {
    return null;
  }

  return {
    sale: {
      companyId: sale.companyId,
      unitId: sale.unitId,
      customerId: sale.customerId,
      productId: sale.productId,
      saleDate: toDateOnlyIso(sale.saleDate),
      totalAmount: sale.totalAmount,
      status: sale.status,
      responsibleType: sale.responsibleType,
      responsibleId: sale.responsibleId,
      responsibleLabel: sale.responsibleLabel,
      notes: sale.notes,
      dynamicFieldSchema: parseSaleDynamicFieldSchemaJson(
        sale.dynamicFieldSchema,
      ),
      dynamicFieldValues: parseSaleDynamicFieldValuesJson(
        sale.dynamicFieldValues,
      ),
    },
    commissions: sale.commissions.map((commission) => ({
      id: commission.id,
      sourceType: commission.sourceType,
      recipientType: commission.recipientType,
      direction: commission.direction,
      calculationBase: commission.calculationBase,
      baseCommissionIndex:
        commission.calculationBase === "COMMISSION" && commission.baseCommission
          ? commission.baseCommission.sortOrder
          : undefined,
      beneficiaryCompanyId: commission.beneficiaryCompanyId,
      beneficiaryUnitId: commission.beneficiaryUnitId,
      beneficiarySellerId: commission.beneficiarySellerId,
      beneficiaryPartnerId: commission.beneficiaryPartnerId,
      beneficiarySupervisorId: commission.beneficiarySupervisorId,
      beneficiaryLabel: commission.beneficiaryLabel,
      startDate: toDateOnlyIso(commission.startDate),
      totalPercentage: fromScaledPercentage(commission.totalPercentage),
      sortOrder: commission.sortOrder,
      installments: commission.installments.map((installment) => ({
        id: installment.id,
        installmentNumber: installment.installmentNumber,
        percentage: fromScaledPercentage(installment.percentage),
        amount: installment.amount,
        status: installment.status,
        expectedPaymentDate: toNullableDateOnlyIso(
          installment.expectedPaymentDate,
        ),
        paymentDate: toNullableDateOnlyIso(installment.paymentDate),
      })),
    })),
  };
}

export function buildSaleHistoryCreationChanges(snapshot: SaleHistorySnapshot) {
  const comparableSnapshot = toComparableSaleHistorySnapshot(snapshot);
  const flattened = flattenHistorySnapshot(comparableSnapshot);

  return Array.from(flattened.entries())
    .sort(([leftPath], [rightPath]) => leftPath.localeCompare(rightPath))
    .map(([path, value]) => ({
      path,
      before: null,
      after: normalizeHistoryValue(value),
    }));
}

export function buildSaleHistoryDiff(
  beforeSnapshot: SaleHistorySnapshot,
  afterSnapshot: SaleHistorySnapshot,
): SaleHistoryChange[] {
  const beforeComparableSnapshot =
    toComparableSaleHistorySnapshot(beforeSnapshot);
  const afterComparableSnapshot =
    toComparableSaleHistorySnapshot(afterSnapshot);
  const beforeFlattened = flattenHistorySnapshot(beforeComparableSnapshot);
  const afterFlattened = flattenHistorySnapshot(afterComparableSnapshot);

  const paths = new Set<string>([
    ...beforeFlattened.keys(),
    ...afterFlattened.keys(),
  ]);

  return Array.from(paths)
    .sort((leftPath, rightPath) => leftPath.localeCompare(rightPath))
    .flatMap((path) => {
      const beforeValue = beforeFlattened.has(path)
        ? normalizeHistoryValue(beforeFlattened.get(path))
        : null;
      const afterValue = afterFlattened.has(path)
        ? normalizeHistoryValue(afterFlattened.get(path))
        : null;

      if (areHistoryValuesEqual(beforeValue, afterValue)) {
        return [];
      }

      return [
        {
          path,
          before: beforeValue,
          after: afterValue,
        },
      ];
    });
}

export async function createSaleHistoryEvent(
  client: SaleHistoryDbClient,
  {
    saleId,
    organizationId,
    actorId,
    action,
    changes,
  }: BaseSaleHistoryEventInput & { changes: SaleHistoryChange[] },
) {
  if (changes.length === 0) {
    return;
  }

  await client.saleHistoryEvent.create({
    data: {
      saleId,
      organizationId,
      actorId,
      action,
      changes: changes as unknown as Prisma.InputJsonValue,
    },
  });
}

export async function createSaleCreatedHistoryEvent(
  client: SaleHistoryDbClient,
  input: Omit<BaseSaleHistoryEventInput, "action"> & {
    snapshot: SaleHistorySnapshot;
  },
) {
  const changes = buildSaleHistoryCreationChanges(input.snapshot);

  await createSaleHistoryEvent(client, {
    saleId: input.saleId,
    organizationId: input.organizationId,
    actorId: input.actorId,
    action: SaleHistoryAction.CREATED,
    changes,
  });
}

export async function createSaleDiffHistoryEvent(
  client: SaleHistoryDbClient,
  input: BaseSaleHistoryEventInput & {
    beforeSnapshot: SaleHistorySnapshot;
    afterSnapshot: SaleHistorySnapshot;
  },
) {
  const changes = buildSaleHistoryDiff(
    input.beforeSnapshot,
    input.afterSnapshot,
  );

  await createSaleHistoryEvent(client, {
    saleId: input.saleId,
    organizationId: input.organizationId,
    actorId: input.actorId,
    action: input.action,
    changes,
  });
}
