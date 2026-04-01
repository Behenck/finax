import { z } from "zod";
import { parseBRLCurrencyToCents } from "@/utils/format-amount";
import { SaleResponsibleTypeSchema } from "./types/sales";

export const QUICK_SALE_BATCH_MAX_ITEMS = 50;

const saleDateRegex = /^\d{4}-\d{2}-\d{2}$/;

function isValidSaleDate(value: string) {
	const parsed = new Date(`${value}T00:00:00.000Z`);
	return (
		!Number.isNaN(parsed.getTime()) &&
		parsed.toISOString().slice(0, 10) === value
	);
}

export const quickSaleBatchItemSchema = z.object({
	customerId: z.uuid({ error: "Selecione o cliente do item" }),
	productId: z.uuid({ error: "Selecione o produto do item" }),
	quantity: z
		.string({ error: "Defina a quantidade" })
		.trim()
		.min(1, "Defina a quantidade")
		.refine((value) => /^\d+$/.test(value), {
			message: "Informe uma quantidade inteira",
		})
		.refine((value) => Number(value) >= 1, {
			message: "A quantidade mínima é 1",
		})
		.default("1"),
	saleDate: z
		.string()
		.regex(saleDateRegex, "Selecione a data da venda")
		.refine((value) => isValidSaleDate(value), {
			message: "Selecione uma data válida",
		}),
	totalAmount: z
		.string({ error: "Defina um valor para o item" })
		.min(1, "Defina um valor para o item")
		.refine((value) => parseBRLCurrencyToCents(value) > 0, {
			message: "Defina um valor válido para o item",
		}),
	dynamicFields: z.record(z.string(), z.unknown()).default({}),
});

export const quickSaleBatchSchema = z
	.object({
		parentProductId: z.uuid({ error: "Selecione o produto pai" }),
		companyId: z.uuid({ error: "Selecione a empresa" }),
		unitId: z.preprocess(
			(value) => (value === "" ? undefined : value),
			z.uuid().optional(),
		),
		responsibleType: SaleResponsibleTypeSchema,
		responsibleId: z.uuid({ error: "Selecione o responsável" }),
		items: z
			.array(quickSaleBatchItemSchema)
			.min(1, "Adicione ao menos um item")
			.max(
				QUICK_SALE_BATCH_MAX_ITEMS,
				`Você pode adicionar no máximo ${QUICK_SALE_BATCH_MAX_ITEMS} itens`,
			),
	})
	.superRefine((values, context) => {
		const replicatedItemsCount = values.items.reduce(
			(total, item) => total + Number.parseInt(item.quantity, 10),
			0,
		);

		if (replicatedItemsCount <= QUICK_SALE_BATCH_MAX_ITEMS) {
			return;
		}

		context.addIssue({
			code: "custom",
			path: ["items"],
			message: `A soma das quantidades dos itens não pode ultrapassar ${QUICK_SALE_BATCH_MAX_ITEMS} vendas`,
		});
	});

export type QuickSaleBatchFormInput = z.input<typeof quickSaleBatchSchema>;
export type QuickSaleBatchFormData = z.output<typeof quickSaleBatchSchema>;
