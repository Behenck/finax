import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { SearchableSelect } from "../src/components/ui/searchable-select";

const BASE_OPTIONS = [
	{ value: "1", label: "Racon Chapecó", group: "Ativos" },
	{ value: "2", label: "Racon Pelotas", group: "Ativos" },
	{ value: "3", label: "Parceiro Inativo", group: "Inativos" },
];

function ControlledSearchableSelect({
	disabled = false,
}: {
	disabled?: boolean;
}) {
	const [value, setValue] = useState<string | undefined>();

	return (
		<SearchableSelect
			options={BASE_OPTIONS}
			value={value}
			onValueChange={setValue}
			placeholder="Selecione um parceiro"
			searchPlaceholder="Buscar parceiro..."
			emptyMessage="Nenhum parceiro encontrado."
			clearOption={{ value: "NONE", label: "Sem seleção" }}
			disabled={disabled}
			ariaLabel="Parceiro"
		/>
	);
}

describe("SearchableSelect", () => {
	it("renders the combobox and respects the disabled state", async () => {
		const user = userEvent.setup();
		render(<ControlledSearchableSelect disabled />);

		const combobox = screen.getByRole("combobox", { name: "Parceiro" });
		expect(combobox).toBeDisabled();

		await user.click(combobox);

		expect(
			screen.queryByPlaceholderText("Buscar parceiro..."),
		).not.toBeInTheDocument();
	});

	it("filters options without accents and shows grouped results", async () => {
		const user = userEvent.setup();
		render(<ControlledSearchableSelect />);

		await user.click(screen.getByRole("combobox", { name: "Parceiro" }));

		const dialog = screen.getByRole("dialog");
		await user.type(
			within(dialog).getByPlaceholderText("Buscar parceiro..."),
			"chapeco",
		);

		expect(within(dialog).getByText("Ativos")).toBeInTheDocument();
		expect(within(dialog).getByText("Racon Chapecó")).toBeInTheDocument();
		expect(
			within(dialog).queryByText("Racon Pelotas"),
		).not.toBeInTheDocument();
	});

	it("updates the displayed value after selection and allows clearing", async () => {
		const user = userEvent.setup();
		render(<ControlledSearchableSelect />);

		const combobox = screen.getByRole("combobox", { name: "Parceiro" });
		await user.click(combobox);
		await user.click(screen.getByRole("button", { name: "Racon Pelotas" }));

		expect(combobox).toHaveTextContent("Racon Pelotas");

		await user.click(combobox);
		await user.click(screen.getByRole("button", { name: "Sem seleção" }));

		expect(combobox).toHaveTextContent("Sem seleção");
	});

	it("shows the empty state when no option matches the search", async () => {
		const user = userEvent.setup();
		render(<ControlledSearchableSelect />);

		await user.click(screen.getByRole("combobox", { name: "Parceiro" }));
		await user.type(screen.getByPlaceholderText("Buscar parceiro..."), "zzz");

		expect(
			screen.getByText("Nenhum parceiro encontrado."),
		).toBeInTheDocument();
	});

	it("supports searchText metadata for lookups by alias", async () => {
		const user = userEvent.setup();
		render(
			<SearchableSelect
				options={[
					{
						value: "rs",
						label: "Rio Grande do Sul (RS)",
						searchText: "rio grande do sul rs",
					},
				]}
				value={undefined}
				onValueChange={vi.fn()}
				placeholder="Selecione"
				searchPlaceholder="Buscar estado..."
				emptyMessage="Nenhum estado encontrado."
				ariaLabel="Estado"
			/>,
		);

		await user.click(screen.getByRole("combobox", { name: "Estado" }));
		await user.type(screen.getByPlaceholderText("Buscar estado..."), "rs");

		expect(screen.getByText("Rio Grande do Sul (RS)")).toBeInTheDocument();
	});
});
