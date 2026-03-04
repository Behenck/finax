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

export const SALE_STATUS_LABEL: Record<SaleStatus, string> = {
	PENDING: "Pendente",
	APPROVED: "Aprovada",
	COMPLETED: "Concluída",
	CANCELED: "Cancelada",
};

export const SALE_RESPONSIBLE_TYPE_LABEL: Record<SaleResponsibleType, string> = {
	SELLER: "Vendedor",
	PARTNER: "Parceiro",
};

export const SALE_STATUS_TRANSITIONS: Record<SaleStatus, SaleStatus[]> = {
	PENDING: ["APPROVED", "CANCELED"],
	APPROVED: ["COMPLETED", "CANCELED"],
	COMPLETED: [],
	CANCELED: [],
};

