import { describe, expect, it } from "vitest";
import {
	type SaleHistoryEvent,
	formatSaleHistoryChange,
	toSaleHistoryTimelineEvent,
} from "../src/pages/_app/sales/-components/sale-history-presenter";

function createEvent(
	overrides: Partial<SaleHistoryEvent> & {
		changes?: SaleHistoryEvent["changes"];
	},
): SaleHistoryEvent {
	return {
		id: overrides.id ?? "event-id",
		action: overrides.action ?? "UPDATED",
		createdAt: overrides.createdAt ?? "2026-03-10T12:00:00.000Z",
		actor: overrides.actor ?? {
			id: "actor-id",
			name: "Usuário Teste",
			avatarUrl: null,
		},
		changes: overrides.changes ?? [],
	};
}

describe("sale-history-presenter", () => {
	it("should return only creation sentence for CREATED action", () => {
		const timelineEvent = toSaleHistoryTimelineEvent(
			createEvent({
				action: "CREATED",
				changes: [
					{
						path: "sale.totalAmount",
						before: null,
						after: 100_000,
					},
				],
			}),
		);

		expect(timelineEvent.messages).toEqual(["Venda criada."]);
	});

	it("should format total amount and status as human sentences", () => {
		const amountSentence = formatSaleHistoryChange({
			path: "sale.totalAmount",
			before: 200_000,
			after: 300_000,
		});
		const statusSentence = formatSaleHistoryChange({
			path: "sale.status",
			before: "PENDING",
			after: "APPROVED",
		});

		expect(amountSentence).toMatch(
			/Valor total alterado de R\$\s*2\.000,00 para R\$\s*3\.000,00\./u,
		);
		expect(statusSentence).toBe("Status alterado de Pendente para Aprovada.");
	});

	it("should format commission and installment changes with context", () => {
		const percentageSentence = formatSaleHistoryChange({
			path: "commissions[0].totalPercentage",
			before: 10,
			after: 12.5,
		});
		const installmentStatusSentence = formatSaleHistoryChange({
			path: "commissions[0].installments[1].status",
			before: "PENDING",
			after: "PAID",
		});
		const installmentAmountSentence = formatSaleHistoryChange({
			path: "commissions[0].installments[1].amount",
			before: 2_500,
			after: 3_000,
		});

		expect(percentageSentence).toBe(
			"Comissão 1: percentual total alterado de 10% para 12,5%.",
		);
		expect(installmentStatusSentence).toBe(
			"Comissão 1, parcela 2: status alterado de Pendente para Paga.",
		);
		expect(installmentAmountSentence).toMatch(
			/Comissão 1, parcela 2: valor alterado de R\$\s*25,00 para R\$\s*30,00\./u,
		);
	});

	it("should use fallback sentence for unknown fields", () => {
		const sentence = formatSaleHistoryChange({
			path: "sale.customInternalFlag",
			before: true,
			after: false,
		});

		expect(sentence).toBe(
			"Campo custom internal flag alterado de sim para não.",
		);
	});

	it("should format null and dates in human-readable format", () => {
		const dateSentence = formatSaleHistoryChange({
			path: "commissions[0].installments[0].paymentDate",
			before: null,
			after: "2026-03-15",
		});
		const dateTimeSentence = formatSaleHistoryChange({
			path: "sale.lastUpdatedAt",
			before: "2026-03-10T10:30:00.000Z",
			after: "2026-03-10T11:45:00.000Z",
		});

		expect(dateSentence).toBe(
			"Comissão 1, parcela 1: data de pagamento alterada de vazio para 15/03/2026.",
		);
		expect(dateTimeSentence).toMatch(
			/Campo last updated at alterado de 10\/03\/2026 \d{2}:\d{2} para 10\/03\/2026 \d{2}:\d{2}\./,
		);
	});
});

