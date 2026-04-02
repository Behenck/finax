import { z } from "zod";

export const SaleStatusSchema = z.enum([
	"PENDING",
	"APPROVED",
	"COMPLETED",
	"CANCELED",
]);

export type SaleStatus = z.infer<typeof SaleStatusSchema>;

export const SaleResponsibleTypeSchema = z.enum(["SELLER", "PARTNER"]);

export type SaleResponsibleType = z.infer<typeof SaleResponsibleTypeSchema>;

export const SaleCommissionSourceTypeSchema = z.enum(["PULLED", "MANUAL"]);

export type SaleCommissionSourceType = z.infer<
	typeof SaleCommissionSourceTypeSchema
>;

export const SaleCommissionRecipientTypeSchema = z.enum([
	"COMPANY",
	"UNIT",
	"SELLER",
	"PARTNER",
	"SUPERVISOR",
	"OTHER",
]);

export type SaleCommissionRecipientType = z.infer<
	typeof SaleCommissionRecipientTypeSchema
>;

export const SaleCommissionDirectionSchema = z.enum(["INCOME", "OUTCOME"]);

export type SaleCommissionDirection = z.infer<
	typeof SaleCommissionDirectionSchema
>;

export const SaleCommissionInstallmentStatusSchema = z.enum([
	"PENDING",
	"PAID",
	"CANCELED",
	"REVERSED",
]);

export type SaleCommissionInstallmentStatus = z.infer<
	typeof SaleCommissionInstallmentStatusSchema
>;

export const SALE_STATUS_LABEL: Record<SaleStatus, string> = {
	PENDING: "Pendente",
	APPROVED: "Aprovada",
	COMPLETED: "Concluída",
	CANCELED: "Cancelada",
};

export const SALE_RESPONSIBLE_TYPE_LABEL: Record<SaleResponsibleType, string> =
	{
		SELLER: "Vendedor",
		PARTNER: "Parceiro",
	};

export const SALE_COMMISSION_SOURCE_TYPE_LABEL: Record<
	SaleCommissionSourceType,
	string
> = {
	PULLED: "Vinculo",
	MANUAL: "Manual",
};

export const SALE_COMMISSION_RECIPIENT_TYPE_LABEL: Record<
	SaleCommissionRecipientType,
	string
> = {
	COMPANY: "Empresa",
	UNIT: "Unidade",
	SELLER: "Vendedor",
	PARTNER: "Parceiro",
	SUPERVISOR: "Supervisor",
	OTHER: "Outro",
};

export const SALE_COMMISSION_DIRECTION_LABEL: Record<
	SaleCommissionDirection,
	string
> = {
	INCOME: "Entrada",
	OUTCOME: "Saída",
};

export const SALE_COMMISSION_INSTALLMENT_STATUS_LABEL: Record<
	SaleCommissionInstallmentStatus,
	string
> = {
	PENDING: "Pendente",
	PAID: "Paga",
	CANCELED: "Cancelada",
	REVERSED: "Estornada",
};

export const SALE_STATUS_TRANSITIONS: Record<SaleStatus, SaleStatus[]> = {
	PENDING: ["APPROVED", "COMPLETED", "CANCELED"],
	APPROVED: ["COMPLETED", "CANCELED"],
	COMPLETED: [],
	CANCELED: [],
};
