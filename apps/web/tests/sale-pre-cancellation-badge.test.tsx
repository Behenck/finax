import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SalePreCancellationBadge } from "../src/pages/_app/sales/-components/sale-pre-cancellation-badge";

describe("sale pre-cancellation badge", () => {
	it("should render the badge when open delinquencies reach the threshold", () => {
		render(
			<SalePreCancellationBadge
				threshold={2}
				summary={{
					openCount: 2,
				}}
			/>,
		);

		expect(screen.getByText("Pré-cancelamento")).toBeInTheDocument();
	});

	it("should hide the badge when the rule is disabled or below the threshold", () => {
		const { rerender } = render(
			<SalePreCancellationBadge
				threshold={null}
				summary={{
					openCount: 4,
				}}
			/>,
		);

		expect(screen.queryByText("Pré-cancelamento")).not.toBeInTheDocument();

		rerender(
			<SalePreCancellationBadge
				threshold={3}
				summary={{
					openCount: 2,
				}}
			/>,
		);

		expect(screen.queryByText("Pré-cancelamento")).not.toBeInTheDocument();
	});
});
