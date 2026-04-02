import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CommissionsSummaryCards } from "../src/pages/_app/commissions/-components/commissions-data-table/commissions-summary-cards";

describe("CommissionsSummaryCards", () => {
	it("should render pay/receive summary for users with all commissions permission", () => {
		render(
			<CommissionsSummaryCards
				canViewAllCommissions
				paySummary={{
					total: { count: 10, amount: 500_000 },
					pending: { count: 4, amount: 200_000 },
					paid: { count: 5, amount: 250_000 },
					canceled: { count: 1, amount: 50_000 },
					reversed: { count: 0, amount: 0 },
				}}
				receiveSummary={{
					total: { count: 8, amount: 320_000 },
					pending: { count: 3, amount: 120_000 },
					paid: { count: 5, amount: 200_000 },
					canceled: { count: 0, amount: 0 },
					reversed: { count: 0, amount: 0 },
				}}
				pendingSummaryForCurrentUser={{ count: 0, amount: 0 }}
				paidSummaryForCurrentUser={{ count: 0, amount: 0 }}
				reversedSummaryForCurrentUser={{ count: 0, amount: 0 }}
			/>,
		);

		expect(screen.getByText("A pagar")).toBeInTheDocument();
		expect(screen.getByText("A receber")).toBeInTheDocument();
		expect(screen.getByText(/4\/10 parcelas/)).toBeInTheDocument();
		expect(screen.getByText(/3\/8 parcelas/)).toBeInTheDocument();
		expect(screen.getByText(/R\$\s*2\.000,00/)).toBeInTheDocument();
		expect(screen.getByText(/R\$\s*1\.200,00/)).toBeInTheDocument();
	});

	it("should render current-user summary when user cannot view all commissions", () => {
		render(
			<CommissionsSummaryCards
				canViewAllCommissions={false}
				paySummary={{
					total: { count: 0, amount: 0 },
					pending: { count: 0, amount: 0 },
					paid: { count: 0, amount: 0 },
					canceled: { count: 0, amount: 0 },
					reversed: { count: 0, amount: 0 },
				}}
				receiveSummary={{
					total: { count: 0, amount: 0 },
					pending: { count: 0, amount: 0 },
					paid: { count: 0, amount: 0 },
					canceled: { count: 0, amount: 0 },
					reversed: { count: 0, amount: 0 },
				}}
				pendingSummaryForCurrentUser={{ count: 2, amount: 50_000 }}
				paidSummaryForCurrentUser={{ count: 7, amount: 140_000 }}
				reversedSummaryForCurrentUser={{ count: 1, amount: -20_000 }}
			/>,
		);

		expect(screen.queryByText("A pagar")).not.toBeInTheDocument();
		expect(screen.getByText("A receber")).toBeInTheDocument();
		expect(screen.getByText("Recebido")).toBeInTheDocument();
		expect(screen.getByText("2 parcela(s) pendente(s)")).toBeInTheDocument();
		expect(
			screen.getByText("7 parcela(s) recebida(s) · 1 estornada(s)"),
		).toBeInTheDocument();
	});
});
