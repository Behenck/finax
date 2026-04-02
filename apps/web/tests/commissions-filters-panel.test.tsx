import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CommissionsFiltersPanel } from "../src/pages/_app/commissions/-components/commissions-data-table/commissions-filters-panel";

describe("CommissionsFiltersPanel", () => {
	it("should call handlers for search and clear filters", () => {
		const onSearchChange = vi.fn();
		const onClearFilters = vi.fn();

		render(
			<CommissionsFiltersPanel
				searchFilter=""
				companyIdFilter=""
				unitIdFilter=""
				productIdFilter=""
				statusFilter="ALL"
				effectiveExpectedFrom="2026-03-01"
				effectiveExpectedTo="2026-03-31"
				currentPageSize={20}
				companies={[
					{
						id: "company-1",
						name: "Empresa 1",
					},
				]}
				unitsBySelectedCompany={[
					{
						id: "unit-1",
						name: "Unidade 1",
					},
				]}
				productOptions={[
					{
						id: "product-1",
						label: "Produto 1",
					},
				]}
				onSearchChange={onSearchChange}
				onCompanyIdChange={vi.fn()}
				onUnitIdChange={vi.fn()}
				onProductIdChange={vi.fn()}
				onStatusChange={vi.fn()}
				onExpectedFromChange={vi.fn()}
				onExpectedToChange={vi.fn()}
				onPageSizeChange={vi.fn()}
				onClearFilters={onClearFilters}
			/>,
		);

		fireEvent.change(
			screen.getByPlaceholderText("Cliente, produto, empresa, beneficiário..."),
			{ target: { value: "cliente 123" } },
		);
		expect(onSearchChange).toHaveBeenCalledWith("cliente 123");

		fireEvent.click(
			screen.getByRole("button", {
				name: "Limpar",
			}),
		);
		expect(onClearFilters).toHaveBeenCalledTimes(1);
	});
});
