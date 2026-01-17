import z from "zod";
import {
	TransactionNatureSchema,
	TransactionTypeSchema,
} from "./types/transactions";

export const transactionSchema = z.object({
	type: TransactionTypeSchema,
	nature: TransactionNatureSchema,
	description: z.string(),
	dueDate: z.date(),
	expectedPaymentDate: z.date(),
	companyId: z.uuid(),
	unitId: z.uuid().optional(),
	costCenterId: z.uuid(),
	categoryId: z.uuid(),
	subCategoryId: z.uuid(),
	totalAmount: z.number(),
	installmentRecurrence: z.enum(["SINGLE", "MONTH", "YEAR", "INSTALLMENTS"]),
	userIdReimbursement: z.uuid().optional(),
	notes: z.string(),
	items: z.array(
		z.object({
			description: z.string(),
			amount: z.number(),
			categoryId: z.uuid(),
		subCategoryId: z.uuid(),
		})
	).optional()
});

export type TransactionFormData = z.infer<typeof transactionSchema>;
