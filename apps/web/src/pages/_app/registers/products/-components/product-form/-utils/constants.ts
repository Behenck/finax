export const PERCENTAGE_SCALE = 10_000;
export const DEFAULT_SCENARIO_NAME = "Venda padrão";

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
