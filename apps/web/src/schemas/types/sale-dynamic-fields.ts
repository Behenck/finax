import { z } from "zod";

export const SALE_DYNAMIC_FIELD_TYPE_VALUES = [
	"TEXT",
	"NUMBER",
	"CURRENCY",
	"RICH_TEXT",
	"PHONE",
	"SELECT",
	"MULTI_SELECT",
	"DATE",
	"DATE_TIME",
] as const;

export const SaleDynamicFieldTypeSchema = z.enum(SALE_DYNAMIC_FIELD_TYPE_VALUES);

export type SaleDynamicFieldType = z.infer<typeof SaleDynamicFieldTypeSchema>;

export interface SaleDynamicFieldOption {
	id: string;
	label: string;
}

export interface SaleDynamicFieldSchemaItem {
	fieldId: string;
	label: string;
	type: SaleDynamicFieldType;
	required: boolean;
	options: SaleDynamicFieldOption[];
}

export type SaleDynamicFieldValues = Record<string, unknown | null>;

export const SALE_DYNAMIC_FIELD_TYPE_LABEL: Record<SaleDynamicFieldType, string> = {
	TEXT: "Texto",
	NUMBER: "Número",
	CURRENCY: "Monetário",
	RICH_TEXT: "Texto corrido",
	PHONE: "Telefone",
	SELECT: "Seleção",
	MULTI_SELECT: "Múltipla seleção",
	DATE: "Data",
	DATE_TIME: "Data e hora",
};
