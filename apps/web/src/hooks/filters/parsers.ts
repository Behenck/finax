import {
	parseAsBoolean,
	parseAsInteger,
	parseAsString,
	parseAsStringLiteral,
} from "nuqs";

const ROLE_FILTER_VALUES = [
	"ALL",
	"ADMIN",
	"MEMBER",
	"SUPERVISOR",
	"SELLER",
	"PARTNER",
] as const;
const COMMISSION_DIRECTION_VALUES = ["INCOME", "OUTCOME"] as const;
const COMMISSION_INSTALLMENT_STATUS_FILTER_VALUES = [
	"ALL",
	"PENDING",
	"PAID",
	"CANCELED",
	"REVERSED",
] as const;
const TRANSACTION_STATUS_FILTER_VALUES = [
	"ALL",
	"PENDING",
	"PAID",
	"CANCELED",
] as const;
const TRANSACTION_TYPE_FILTER_VALUES = ["ALL", "INCOME", "OUTCOME"] as const;
const TRANSACTION_SORT_BY_VALUES = [
	"dueDate",
	"expectedPaymentDate",
	"description",
	"totalAmount",
	"status",
	"createdAt",
] as const;
const PARTNER_STATUS_FILTER_VALUES = ["ALL", "ACTIVE", "INACTIVE"] as const;
const SORT_DIRECTION_VALUES = ["asc", "desc"] as const;
const MEMBER_VIEW_VALUES = ["access", "role"] as const;
const DASHBOARD_VIEW_VALUES = [
	"commercial",
	"operational",
	"partners",
] as const;
const PARTNERS_VIEW_VALUES = ["performance", "commission", "risk"] as const;
const PRODUCT_BREAKDOWN_DEPTH_VALUES = ["FIRST_LEVEL", "ALL_LEVELS"] as const;

export const textFilterParser = parseAsString
	.withDefault("")
	.withOptions({ history: "replace" });

export const roleFilterParser = parseAsStringLiteral(ROLE_FILTER_VALUES)
	.withDefault("ALL")
	.withOptions({ history: "replace" });

export const partnerStatusFilterParser = parseAsStringLiteral(
	PARTNER_STATUS_FILTER_VALUES,
)
	.withDefault("ALL")
	.withOptions({ history: "replace" });

export const memberTargetParser = parseAsString.withOptions({
	history: "replace",
});

export const memberViewParser = parseAsStringLiteral(
	MEMBER_VIEW_VALUES,
).withOptions({ history: "replace" });

export const dashboardViewParser = parseAsStringLiteral(DASHBOARD_VIEW_VALUES)
	.withDefault("commercial")
	.withOptions({ history: "replace" });

export const partnersViewParser = parseAsStringLiteral(PARTNERS_VIEW_VALUES)
	.withDefault("performance")
	.withOptions({ history: "replace" });

export const showZeroInstallmentsParser = parseAsBoolean
	.withDefault(false)
	.withOptions({ history: "replace" });

export const commissionDirectionParser = parseAsStringLiteral(
	COMMISSION_DIRECTION_VALUES,
)
	.withDefault("OUTCOME")
	.withOptions({ history: "replace" });

export const commissionInstallmentStatusParser = parseAsStringLiteral(
	COMMISSION_INSTALLMENT_STATUS_FILTER_VALUES,
)
	.withDefault("ALL")
	.withOptions({ history: "replace" });

export const transactionStatusFilterParser = parseAsStringLiteral(
	TRANSACTION_STATUS_FILTER_VALUES,
)
	.withDefault("ALL")
	.withOptions({ history: "replace" });

export const transactionTypeFilterParser = parseAsStringLiteral(
	TRANSACTION_TYPE_FILTER_VALUES,
)
	.withDefault("ALL")
	.withOptions({ history: "replace" });

export const transactionSortByParser = parseAsStringLiteral(
	TRANSACTION_SORT_BY_VALUES,
)
	.withDefault("dueDate")
	.withOptions({ history: "replace" });

export const sortDirectionParser = parseAsStringLiteral(SORT_DIRECTION_VALUES)
	.withDefault("desc")
	.withOptions({ history: "replace" });

export const dateFilterParser = parseAsString
	.withDefault("")
	.withOptions({ history: "replace" });

export const monthFilterParser = parseAsString.withOptions({
	history: "replace",
});

export const dashboardInactiveMonthsParser = parseAsInteger
	.withDefault(3)
	.withOptions({ history: "replace" });

export const productBreakdownDepthParser = parseAsStringLiteral(
	PRODUCT_BREAKDOWN_DEPTH_VALUES,
)
	.withDefault("FIRST_LEVEL")
	.withOptions({ history: "replace" });

export const pageParser = parseAsInteger
	.withDefault(1)
	.withOptions({ history: "replace" });

export const pageSizeParser = parseAsInteger
	.withDefault(10)
	.withOptions({ history: "replace" });

export const productFilterParser = parseAsString
	.withDefault("")
	.withOptions({ history: "replace" });

export const entityFilterParser = parseAsString
	.withDefault("")
	.withOptions({ history: "replace" });
