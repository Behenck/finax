export const PERCENTAGE_SCALE = 10_000;
export const DEFAULT_SCENARIO_NAME = "Venda padrão";

export const LINKED_COMPANY_CONDITION_ID =
	"00000000-0000-0000-0000-000000000000";
export const LINKED_PARTNER_CONDITION_ID =
	"ffffffff-ffff-ffff-ffff-ffffffffffff";
export const LINKED_UNIT_CONDITION_ID =
	"11111111-1111-4111-8111-111111111111";
export const LINKED_SELLER_CONDITION_ID =
	"22222222-2222-4222-8222-222222222222";

export const LINKED_CONDITION_VALUE_BY_TYPE = {
	COMPANY: LINKED_COMPANY_CONDITION_ID,
	PARTNER: LINKED_PARTNER_CONDITION_ID,
	UNIT: LINKED_UNIT_CONDITION_ID,
	SELLER: LINKED_SELLER_CONDITION_ID,
} as const;

export const LINKED_CONDITION_LABEL_BY_TYPE = {
	COMPANY: "Empresa vinculada",
	PARTNER: "Parceiro vinculado",
	UNIT: "Unidade vinculada",
	SELLER: "Vendedor vinculado",
} as const;

export const CONDITION_OPTIONS = [
	{ value: "COMPANY", label: "Empresa" },
	{ value: "PARTNER", label: "Parceiro" },
	{ value: "UNIT", label: "Unidade" },
	{ value: "SELLER", label: "Vendedor" },
	{ value: "SUPERVISOR", label: "Supervisor" },
] as const;

export const RECIPIENT_OPTIONS = [
	{ value: "COMPANY", label: "Empresa" },
	{ value: "UNIT", label: "Unidade" },
	{ value: "PARTNER", label: "Parceiro" },
	{ value: "SELLER", label: "Vendedor" },
	{ value: "SUPERVISOR", label: "Supervisor" },
	{ value: "OTHER", label: "Outro" },
] as const;
