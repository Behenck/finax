import { parseAsBoolean, parseAsString, parseAsStringLiteral } from "nuqs";

const ROLE_FILTER_VALUES = ["ALL", "ADMIN", "MEMBER"] as const;

export const textFilterParser = parseAsString
	.withDefault("")
	.withOptions({ history: "replace" });

export const roleFilterParser = parseAsStringLiteral(ROLE_FILTER_VALUES)
	.withDefault("ALL")
	.withOptions({ history: "replace" });

export const showZeroInstallmentsParser = parseAsBoolean
	.withDefault(false)
	.withOptions({ history: "replace" });
