import { parseBRLCurrencyToCents } from "@/utils/format-amount";
import { z } from "zod";
import { SaleResponsibleTypeSchema } from "./types/sales";

export const saleSchema = z.object({
	saleDate: z.coerce.date({ error: "Selecione a data da venda" }),
	customerId: z.uuid({ error: "Selecione o cliente" }),
	productId: z.uuid({ error: "Selecione o produto" }),
	companyId: z.uuid({ error: "Selecione a empresa" }),
	unitId: z.preprocess(
		(value) => (value === "" ? undefined : value),
		z.uuid().optional(),
	),
	responsibleType: SaleResponsibleTypeSchema,
	responsibleId: z.uuid({ error: "Selecione o responsável" }),
	totalAmount: z
		.string({ error: "Defina um valor" })
		.min(1)
		.refine((value) => parseBRLCurrencyToCents(value) > 0, {
			message: "Defina um valor válido",
		}),
	notes: z.string().max(500, "A observação deve ter no máximo 500 caracteres").optional(),
});

export type SaleFormInput = z.input<typeof saleSchema>;
export type SaleFormData = z.output<typeof saleSchema>;
