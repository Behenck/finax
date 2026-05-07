import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CommissionsFiltersPanel } from "../src/pages/_app/commissions/-components/commissions-data-table/commissions-filters-panel";

describe("CommissionsFiltersPanel", () => {
	it("should call handlers for search and clear filters", () => {
		const onSearchChange = vi.fn();
		const onClearFilters = vi.fn();

		render(
			<CommissionsFiltersPanel
				searchFilter=""
				companyIdFilter="company-1"
				unitIdFilter=""
				productIdFilter=""
				statusFilter="ALL"
				effectiveExpectedFrom="2026-03-01"
				effectiveExpectedTo="2026-03-31"
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

	it("should allow searching and selecting company, unit and product filters", async () => {
		const user = userEvent.setup();
		const onCompanyIdChange = vi.fn();
		const onUnitIdChange = vi.fn();
		const onProductIdChange = vi.fn();

		render(
			<CommissionsFiltersPanel
				searchFilter=""
				companyIdFilter="company-1"
				unitIdFilter=""
				productIdFilter=""
				statusFilter="ALL"
				effectiveExpectedFrom="2026-03-01"
				effectiveExpectedTo="2026-03-31"
				companies={[
					{ id: "company-1", name: "Empresa Chapecó" },
					{ id: "company-2", name: "Empresa Pelotas" },
				]}
				unitsBySelectedCompany={[
					{ id: "unit-1", name: "Unidade Centro" },
					{ id: "unit-2", name: "Unidade Norte" },
				]}
				productOptions={[
					{ id: "product-1", label: "Produto Premium" },
					{ id: "product-2", label: "Produto Essencial" },
				]}
				onSearchChange={vi.fn()}
				onCompanyIdChange={onCompanyIdChange}
				onUnitIdChange={onUnitIdChange}
				onProductIdChange={onProductIdChange}
				onStatusChange={vi.fn()}
				onExpectedFromChange={vi.fn()}
				onExpectedToChange={vi.fn()}
				onClearFilters={vi.fn()}
			/>,
		);

		await user.click(screen.getByRole("combobox", { name: "Todas as empresas" }));
		let dialog = screen.getByRole("dialog");
		await user.type(
			within(dialog).getByPlaceholderText("Buscar empresa..."),
			"pelotas",
		);
		await user.click(within(dialog).getByRole("button", { name: "Empresa Pelotas" }));

		expect(onCompanyIdChange).toHaveBeenCalledWith("company-2");

		await user.click(screen.getByRole("combobox", { name: "Todas as unidades" }));
		dialog = screen.getByRole("dialog");
		await user.type(
			within(dialog).getByPlaceholderText("Buscar unidade..."),
			"norte",
		);
		await user.click(within(dialog).getByRole("button", { name: "Unidade Norte" }));

		expect(onUnitIdChange).toHaveBeenCalledWith("unit-2");

		await user.click(
			screen.getByRole("combobox", { name: "Todos os produtos" }),
		);
		dialog = screen.getByRole("dialog");
		await user.type(
			within(dialog).getByPlaceholderText("Buscar produto..."),
			"premium",
		);
		await user.click(within(dialog).getByRole("button", { name: "Produto Premium" }));

		expect(onProductIdChange).toHaveBeenCalledWith("product-1");
	});
});
