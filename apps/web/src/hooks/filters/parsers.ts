import {
	parseAsBoolean,
	parseAsInteger,
	parseAsString,
	parseAsStringLiteral,
} from "nuqs";

const ROLE_FILTER_VALUES = ["ALL", "ADMIN", "MEMBER"] as const;
const COMMISSION_DIRECTION_VALUES = ["INCOME", "OUTCOME"] as const;
const COMMISSION_INSTALLMENT_STATUS_FILTER_VALUES = [
	"ALL",
	"PENDING",
	"PAID",
	"CANCELED",
] as const;
const MEMBER_VIEW_VALUES = ["access", "role"] as const;

export const textFilterParser = parseAsString
	.withDefault("")
	.withOptions({ history: "replace" });

export const roleFilterParser = parseAsStringLiteral(ROLE_FILTER_VALUES)
	.withDefault("ALL")
	.withOptions({ history: "replace" });

export const memberTargetParser = parseAsString.withOptions({
	history: "replace",
});

export const memberViewParser = parseAsStringLiteral(MEMBER_VIEW_VALUES).withOptions(
	{ history: "replace" },
);

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

export const dateFilterParser = parseAsString
	.withDefault("")
	.withOptions({ history: "replace" });

export const pageParser = parseAsInteger
	.withDefault(1)
	.withOptions({ history: "replace" });

export const pageSizeParser = parseAsInteger
	.withDefault(20)
	.withOptions({ history: "replace" });

export const productFilterParser = parseAsString
	.withDefault("")
	.withOptions({ history: "replace" });
