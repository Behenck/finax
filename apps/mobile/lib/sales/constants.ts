export const SALE_STATUS_LABEL: Record<
  "PENDING" | "APPROVED" | "COMPLETED" | "CANCELED",
  string
> = {
  PENDING: "Pendente",
  APPROVED: "Aprovada",
  COMPLETED: "Concluída",
  CANCELED: "Cancelada",
};

export const SALE_RESPONSIBLE_TYPE_LABEL: Record<"SELLER" | "PARTNER", string> = {
  SELLER: "Vendedor",
  PARTNER: "Parceiro",
};

export const SALE_COMMISSION_SOURCE_TYPE_LABEL: Record<"PULLED" | "MANUAL", string> = {
  PULLED: "Vínculo",
  MANUAL: "Manual",
};

export const SALE_COMMISSION_RECIPIENT_TYPE_LABEL: Record<
  "COMPANY" | "UNIT" | "SELLER" | "PARTNER" | "SUPERVISOR" | "OTHER",
  string
> = {
  COMPANY: "Empresa",
  UNIT: "Unidade",
  SELLER: "Vendedor",
  PARTNER: "Parceiro",
  SUPERVISOR: "Supervisor",
  OTHER: "Outro",
};

export const SALE_COMMISSION_DIRECTION_LABEL: Record<"INCOME" | "OUTCOME", string> = {
  INCOME: "Entrada",
  OUTCOME: "Saída",
};

export const SALE_COMMISSION_INSTALLMENT_STATUS_LABEL: Record<
  "PENDING" | "PAID" | "CANCELED",
  string
> = {
  PENDING: "Pendente",
  PAID: "Paga",
  CANCELED: "Cancelada",
};

export const SALE_STATUS_TRANSITIONS: Record<
  "PENDING" | "APPROVED" | "COMPLETED" | "CANCELED",
  Array<"PENDING" | "APPROVED" | "COMPLETED" | "CANCELED">
> = {
  PENDING: ["APPROVED", "CANCELED"],
  APPROVED: ["COMPLETED", "CANCELED"],
  COMPLETED: [],
  CANCELED: [],
};
