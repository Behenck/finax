import z from "zod";
import {
	TransactionNatureSchema,
	TransactionTypeSchema,
} from "./types/transactions";
import { parseBRLCurrencyToNumber } from "@/utils/format-amount";

export const transactionSchema = z.object({
	type: TransactionTypeSchema,
	nature: TransactionNatureSchema,
	description: z.string(),
	dueDate: z.coerce.date({ error: "Selecione a data de vencimento" }),
	expectedPaymentDate: z.coerce.date({ error: "Selecione a data de previsão" }),
	companyId: z.uuid({ error: "Selecione uma unidade" }),
	unitId: z.uuid().optional(),
	costCenterId: z.uuid({ error: "Selecione um centro de custo" }),
	categoryId: z.uuid({ error: "Selecione uma categoria" }),
	subCategoryId: z.uuid().optional(),
	totalAmount: z
		.string({ error: "Defina um valor" })
		.min(1)
		.refine((value) => parseBRLCurrencyToNumber(value) > 0, {
			message: "Defina um valor válido",
		}),
	installmentRecurrenceType: z.enum(["SINGLE", "MONTH", "YEAR", "INSTALLMENTS"]),
	installmentRecurrenceQuantity: z.coerce.number(),
	employeeIdRefunded: z.preprocess(
		(value) => (value === "" ? undefined : value),
		z.uuid().optional()
	),
	notes: z.string().optional(),
	items: z.array(
		z.object({
			description: z.string(),
			amount: z
				.string({ error: "Defina um valor" })
				.min(1)
				.refine((value) => parseBRLCurrencyToNumber(value) > 0, {
					message: "Defina um valor válido",
				}),
			categoryId: z.preprocess(
				(value) => (value === "" ? undefined : value),
				z.uuid({ error: "Selecione uma categoria" })
			),

			subCategoryId: z.preprocess(
				(value) => (value === "" ? undefined : value),
				z.uuid().optional()
			),
		})
	).optional()
});

export type TransactionFormData = z.infer<typeof transactionSchema>;
