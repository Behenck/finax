import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { Prisma } from "generated/prisma/client";
import {
  SaleCommissionInstallmentStatus,
  SaleResponsibleType,
  SaleStatus,
} from "generated/prisma/enums";
import z from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import { BadRequestError } from "../_errors/bad-request-error";
import { loadSaleDelinquencySummaryBySaleIds } from "./sale-delinquencies";
import {
  isSaleInPreCancellation,
  normalizePreCancellationDelinquencyThreshold,
} from "./sale-pre-cancellation";
import {
  GetSalesDashboardQuerySchema,
  SalesDashboardResponseSchema,
} from "./sale-schemas";

const dashboardSaleStatuses = [
  SaleStatus.PENDING,
  SaleStatus.APPROVED,
  SaleStatus.COMPLETED,
  SaleStatus.CANCELED,
] as const;

const headlineSaleStatuses = [
  SaleStatus.PENDING,
  SaleStatus.APPROVED,
  SaleStatus.COMPLETED,
] as const;

type PeriodRange = {
  month: string;
  from: Date;
  to: Date;
};

type SummaryBucket = {
  count: number;
  amount: number;
};

type InstallmentSummaryBucket = {
  count: number;
  amount: number;
};

type InstallmentDirectionSummary = {
  total: InstallmentSummaryBucket;
  pending: InstallmentSummaryBucket;
  paid: InstallmentSummaryBucket;
  canceled: InstallmentSummaryBucket;
  reversed: InstallmentSummaryBucket;
};

function createUtcDate(year: number, monthIndex: number, day: number) {
  return new Date(Date.UTC(year, monthIndex, day));
}

function getMonthValue(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function parseDashboardMonth(month: string) {
  const [yearString, monthString] = month.split("-");
  const year = Number(yearString);
  const monthIndex = Number(monthString) - 1;

  return {
    year,
    monthIndex,
  };
}

function getMonthRange(month: string): PeriodRange {
  const { year, monthIndex } = parseDashboardMonth(month);
  const from = createUtcDate(year, monthIndex, 1);
  const to = createUtcDate(year, monthIndex + 1, 0);

  return {
    month,
    from,
    to,
  };
}

function getPreviousMonthRange(month: string): PeriodRange {
  const currentRange = getMonthRange(month);
  const previousMonthDate = createUtcDate(
    currentRange.from.getUTCFullYear(),
    currentRange.from.getUTCMonth() - 1,
    1,
  );

  return getMonthRange(getMonthValue(previousMonthDate));
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addUtcDays(date: Date, days: number) {
  return createUtcDate(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate() + days,
  );
}

function buildMonthDays(from: Date, to: Date) {
  const days: Date[] = [];

  for (let cursor = from; cursor <= to; cursor = addUtcDays(cursor, 1)) {
    days.push(cursor);
  }

  return days;
}

function toSummaryBucket(aggregate: {
  _count: { _all: number };
  _sum: { totalAmount: number | null };
}): SummaryBucket {
  return {
    count: aggregate._count._all,
    amount: aggregate._sum.totalAmount ?? 0,
  };
}

function toSalesHeadlineSummary(aggregate: {
  _count: { _all: number };
  _sum: { totalAmount: number | null };
}) {
  const count = aggregate._count._all;
  const grossAmount = aggregate._sum.totalAmount ?? 0;

  return {
    count,
    grossAmount,
    averageTicket: count > 0 ? Math.round(grossAmount / count) : 0,
  };
}

function sortRankedItems<
  T extends { name: string; count: number; grossAmount: number },
>(items: T[]) {
  return [...items].sort(
    (a, b) =>
      b.grossAmount - a.grossAmount ||
      b.count - a.count ||
      a.name.localeCompare(b.name, "pt-BR"),
  );
}

function buildSalesDateWhere(
  organizationId: string,
  range: PeriodRange,
): Prisma.SaleWhereInput {
  return {
    organizationId,
    saleDate: {
      gte: range.from,
      lte: range.to,
    },
  };
}

function buildHeadlineSalesWhere(
  organizationId: string,
  range: PeriodRange,
): Prisma.SaleWhereInput {
  return {
    ...buildSalesDateWhere(organizationId, range),
    status: {
      in: [...headlineSaleStatuses],
    },
  };
}

async function loadSalesHeadlineSummary(
  organizationId: string,
  range: PeriodRange,
) {
  const aggregate = await prisma.sale.aggregate({
    where: buildHeadlineSalesWhere(organizationId, range),
    _count: {
      _all: true,
    },
    _sum: {
      totalAmount: true,
    },
  });

  return toSalesHeadlineSummary(aggregate);
}

async function loadSalesStatusSummary(
  organizationId: string,
  range: PeriodRange,
) {
  const groups = await prisma.sale.groupBy({
    by: ["status"],
    where: buildSalesDateWhere(organizationId, range),
    _count: {
      _all: true,
    },
    _sum: {
      totalAmount: true,
    },
  });

  const bucketsByStatus = new Map(
    groups.map((group) => [group.status, toSummaryBucket(group)]),
  );

  return Object.fromEntries(
    dashboardSaleStatuses.map((status) => [
      status,
      bucketsByStatus.get(status) ?? { count: 0, amount: 0 },
    ]),
  ) as Record<(typeof dashboardSaleStatuses)[number], SummaryBucket>;
}

async function loadSalesPreCancellationSummary(
  organizationId: string,
  range: PeriodRange,
  threshold: number | null | undefined,
) {
  const normalizedThreshold =
    normalizePreCancellationDelinquencyThreshold(threshold);

  if (normalizedThreshold === null) {
    return {
      count: 0,
      threshold: null,
    };
  }

  const sales = await prisma.sale.findMany({
    where: buildSalesDateWhere(organizationId, range),
    select: {
      id: true,
    },
  });

  const saleIds = sales.map((sale) => sale.id);
  const delinquencySummaryBySaleId = await loadSaleDelinquencySummaryBySaleIds(
    prisma,
    organizationId,
    saleIds,
  );

  const count = saleIds.reduce((total, saleId) => {
    const delinquencySummary = delinquencySummaryBySaleId.get(saleId);

    if (
      !delinquencySummary ||
      !isSaleInPreCancellation({
        threshold: normalizedThreshold,
        openDelinquencyCount: delinquencySummary.openCount,
      })
    ) {
      return total;
    }

    return total + 1;
  }, 0);

  return {
    count,
    threshold: normalizedThreshold,
  };
}

async function loadSalesTimeline(organizationId: string, range: PeriodRange) {
  const groups = await prisma.sale.groupBy({
    by: ["saleDate"],
    where: buildHeadlineSalesWhere(organizationId, range),
    _count: {
      _all: true,
    },
    _sum: {
      totalAmount: true,
    },
  });

  const timelineByDate = new Map(
    groups.map((group) => [
      toDateKey(group.saleDate),
      {
        count: group._count._all,
        amount: group._sum.totalAmount ?? 0,
      },
    ]),
  );

  return buildMonthDays(range.from, range.to).map((date) => {
    const key = toDateKey(date);
    const summary = timelineByDate.get(key) ?? { count: 0, amount: 0 };

    return {
      date,
      count: summary.count,
      amount: summary.amount,
    };
  });
}

async function loadTopProducts(organizationId: string, range: PeriodRange) {
  const groups = await prisma.sale.groupBy({
    by: ["productId"],
    where: buildHeadlineSalesWhere(organizationId, range),
    _count: {
      _all: true,
    },
    _sum: {
      totalAmount: true,
    },
  });

  const productIds = groups.map((group) => group.productId);
  const products = productIds.length
    ? await prisma.product.findMany({
        where: {
          organizationId,
          id: {
            in: productIds,
          },
        },
        select: {
          id: true,
          name: true,
        },
      })
    : [];

  const productsById = new Map(
    products.map((product) => [product.id, product.name]),
  );

  return sortRankedItems(
    groups.map((group) => ({
      id: group.productId,
      name: productsById.get(group.productId) ?? "Produto removido",
      count: group._count._all,
      grossAmount: group._sum.totalAmount ?? 0,
    })),
  ).slice(0, 5);
}

async function loadTopResponsibles(organizationId: string, range: PeriodRange) {
  const groups = await prisma.sale.groupBy({
    by: ["responsibleType", "responsibleId"],
    where: {
      ...buildHeadlineSalesWhere(organizationId, range),
      responsibleType: {
        not: null,
      },
      responsibleId: {
        not: null,
      },
    },
    _count: {
      _all: true,
    },
    _sum: {
      totalAmount: true,
    },
  });

  const validGroups = groups.filter(
    (
      group,
    ): group is (typeof groups)[number] & {
      responsibleType: SaleResponsibleType;
      responsibleId: string;
    } => group.responsibleType !== null && group.responsibleId !== null,
  );

  const sellerIds = Array.from(
    new Set(
      validGroups
        .filter((group) => group.responsibleType === SaleResponsibleType.SELLER)
        .map((group) => group.responsibleId),
    ),
  );
  const companyIds = Array.from(
    new Set(
      validGroups
        .filter(
          (group) => group.responsibleType === SaleResponsibleType.COMPANY,
        )
        .map((group) => group.responsibleId),
    ),
  );
  const unitIds = Array.from(
    new Set(
      validGroups
        .filter((group) => group.responsibleType === SaleResponsibleType.UNIT)
        .map((group) => group.responsibleId),
    ),
  );
  const partnerIds = Array.from(
    new Set(
      validGroups
        .filter(
          (group) => group.responsibleType === SaleResponsibleType.PARTNER,
        )
        .map((group) => group.responsibleId),
    ),
  );
  const supervisorIds = Array.from(
    new Set(
      validGroups
        .filter(
          (group) => group.responsibleType === SaleResponsibleType.SUPERVISOR,
        )
        .map((group) => group.responsibleId),
    ),
  );

  const [companies, units, sellers, partners, supervisors] = await Promise.all([
    companyIds.length
      ? prisma.company.findMany({
          where: {
            organizationId,
            id: {
              in: companyIds,
            },
          },
          select: {
            id: true,
            name: true,
          },
        })
      : Promise.resolve([]),
    unitIds.length
      ? prisma.unit.findMany({
          where: {
            id: {
              in: unitIds,
            },
            company: { organizationId },
          },
          select: {
            id: true,
            name: true,
            company: { select: { name: true } },
          },
        })
      : Promise.resolve([]),
    sellerIds.length
      ? prisma.seller.findMany({
          where: {
            organizationId,
            id: {
              in: sellerIds,
            },
          },
          select: {
            id: true,
            name: true,
          },
        })
      : Promise.resolve([]),
    partnerIds.length
      ? prisma.partner.findMany({
          where: {
            organizationId,
            id: {
              in: partnerIds,
            },
          },
          select: {
            id: true,
            name: true,
          },
        })
      : Promise.resolve([]),
    supervisorIds.length
      ? prisma.member.findMany({
          where: {
            organizationId,
            role: "SUPERVISOR",
            id: {
              in: supervisorIds,
            },
          },
          select: {
            id: true,
            user: { select: { name: true, email: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  const namesByResponsibleKey = new Map<string, string>();

  for (const company of companies) {
    namesByResponsibleKey.set(
      `${SaleResponsibleType.COMPANY}:${company.id}`,
      company.name,
    );
  }

  for (const unit of units) {
    namesByResponsibleKey.set(
      `${SaleResponsibleType.UNIT}:${unit.id}`,
      `${unit.company.name} -> ${unit.name}`,
    );
  }

  for (const seller of sellers) {
    namesByResponsibleKey.set(
      `${SaleResponsibleType.SELLER}:${seller.id}`,
      seller.name,
    );
  }

  for (const partner of partners) {
    namesByResponsibleKey.set(
      `${SaleResponsibleType.PARTNER}:${partner.id}`,
      partner.name,
    );
  }

  for (const supervisor of supervisors) {
    namesByResponsibleKey.set(
      `${SaleResponsibleType.SUPERVISOR}:${supervisor.id}`,
      supervisor.user.name ?? supervisor.user.email,
    );
  }

  return sortRankedItems(
    validGroups.map((group) => ({
      id: group.responsibleId,
      type: group.responsibleType,
      name:
        namesByResponsibleKey.get(
          `${group.responsibleType}:${group.responsibleId}`,
        ) ?? "Responsável removido",
      count: group._count._all,
      grossAmount: group._sum.totalAmount ?? 0,
    })),
  ).slice(0, 5);
}

async function loadCommissionPeriodSummary(
  organizationId: string,
  range: PeriodRange,
) {
  const loadDirectionSummary = async (
    direction: "INCOME" | "OUTCOME",
  ): Promise<InstallmentDirectionSummary> => {
    const buildWhere = (
      status?: SaleCommissionInstallmentStatus,
    ): Prisma.SaleCommissionInstallmentWhereInput => ({
      saleCommission: {
        direction,
        sale: {
          organizationId,
          status: {
            in: [...headlineSaleStatuses],
          },
          saleDate: {
            gte: range.from,
            lte: range.to,
          },
        },
      },
      ...(status ? { status } : {}),
    });

    const toBucket = (aggregate: {
      _count: { _all: number };
      _sum: { amount: number | null };
    }): InstallmentSummaryBucket => ({
      count: aggregate._count._all,
      amount: aggregate._sum.amount ?? 0,
    });

    const [total, pending, paid, canceled, reversed] = await Promise.all([
      prisma.saleCommissionInstallment.aggregate({
        where: buildWhere(),
        _count: { _all: true },
        _sum: { amount: true },
      }),
      prisma.saleCommissionInstallment.aggregate({
        where: buildWhere(SaleCommissionInstallmentStatus.PENDING),
        _count: { _all: true },
        _sum: { amount: true },
      }),
      prisma.saleCommissionInstallment.aggregate({
        where: buildWhere(SaleCommissionInstallmentStatus.PAID),
        _count: { _all: true },
        _sum: { amount: true },
      }),
      prisma.saleCommissionInstallment.aggregate({
        where: buildWhere(SaleCommissionInstallmentStatus.CANCELED),
        _count: { _all: true },
        _sum: { amount: true },
      }),
      prisma.saleCommissionInstallment.aggregate({
        where: buildWhere(SaleCommissionInstallmentStatus.REVERSED),
        _count: { _all: true },
        _sum: { amount: true },
      }),
    ]);

    return {
      total: toBucket(total),
      pending: toBucket(pending),
      paid: toBucket(paid),
      canceled: toBucket(canceled),
      reversed: toBucket(reversed),
    };
  };

  const [income, outcome] = await Promise.all([
    loadDirectionSummary("INCOME"),
    loadDirectionSummary("OUTCOME"),
  ]);

  return {
    INCOME: income,
    OUTCOME: outcome,
    netAmount: income.total.amount - outcome.total.amount,
  };
}

export async function getSalesDashboard(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .get(
      "/organizations/:slug/sales/dashboard",
      {
        schema: {
          tags: ["sales"],
          summary: "Get sales dashboard",
          security: [{ bearerAuth: [] }],
          params: z.object({
            slug: z.string(),
          }),
          querystring: GetSalesDashboardQuerySchema,
          response: {
            200: SalesDashboardResponseSchema,
          },
        },
      },
      async (request) => {
        const { slug } = request.params;
        const { month } = request.query;

        const organization = await prisma.organization.findUnique({
          where: {
            slug,
          },
          select: {
            id: true,
            preCancellationDelinquencyThreshold: true,
          },
        });

        if (!organization) {
          throw new BadRequestError("Organization not found");
        }

        const currentPeriod = getMonthRange(month);
        const previousPeriod = getPreviousMonthRange(month);

        const [
          currentSales,
          previousSales,
          preCancellationSummary,
          byStatus,
          timeline,
          topProducts,
          topResponsibles,
          currentCommissions,
          previousCommissions,
        ] = await Promise.all([
          loadSalesHeadlineSummary(organization.id, currentPeriod),
          loadSalesHeadlineSummary(organization.id, previousPeriod),
          loadSalesPreCancellationSummary(
            organization.id,
            currentPeriod,
            organization.preCancellationDelinquencyThreshold,
          ),
          loadSalesStatusSummary(organization.id, currentPeriod),
          loadSalesTimeline(organization.id, currentPeriod),
          loadTopProducts(organization.id, currentPeriod),
          loadTopResponsibles(organization.id, currentPeriod),
          loadCommissionPeriodSummary(organization.id, currentPeriod),
          loadCommissionPeriodSummary(organization.id, previousPeriod),
        ]);

        return {
          period: {
            selectedMonth: month,
            current: currentPeriod,
            previous: previousPeriod,
          },
          sales: {
            current: currentSales,
            previous: previousSales,
            preCancellation: preCancellationSummary,
            byStatus,
            timeline,
            topProducts,
            topResponsibles,
          },
          commissions: {
            reference: "SALE_DATE" as const,
            current: currentCommissions,
            previous: previousCommissions,
          },
        };
      },
    );
}
