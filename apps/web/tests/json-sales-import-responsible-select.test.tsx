import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import {
	SearchableResponsibleSelect,
	type SearchableResponsibleOption,
} from "../src/pages/_app/sales/-components/import-sales/searchable-responsible-select";

const RESPONSIBLE_OPTIONS: SearchableResponsibleOption[] = [
	{
		id: "partner-1",
		label: "Racon Chapecó - Fernandes Vend",
	},
	{
		id: "partner-2",
		label: "Racon Pelotas - Joel E Cia",
	},
];

function ControlledResponsibleSelect({
	disabled = false,
}: {
	disabled?: boolean;
}) {
	const [value, setValue] = useState<string | undefined>();

	return (
		<SearchableResponsibleSelect
			ariaLabel="Responsável"
			options={RESPONSIBLE_OPTIONS}
			value={value}
			onChange={setValue}
			disabled={disabled}
			placeholder="Selecione o responsável"
			emptyLabel="Nenhum responsável encontrado."
		/>
	);
}

describe("SearchableResponsibleSelect", () => {
	it("renders the searchable combobox and respects the disabled state", async () => {
		const user = userEvent.setup();
		render(<ControlledResponsibleSelect disabled />);

		const combobox = screen.getByRole("combobox", { name: "Responsável" });
		expect(combobox).toBeDisabled();

		await user.click(combobox);

		expect(
			screen.queryByPlaceholderText("Buscar responsável..."),
		).not.toBeInTheDocument();
	});

	it("filters responsibles by partial text and without accents", async () => {
		const user = userEvent.setup();
		render(<ControlledResponsibleSelect />);

		await user.click(screen.getByRole("combobox", { name: "Responsável" }));

		const input = screen.getByPlaceholderText("Buscar responsável...");
		await user.type(input, "chapeco");

		expect(
			screen.getByText("Racon Chapecó - Fernandes Vend"),
		).toBeInTheDocument();
		expect(
			screen.queryByText("Racon Pelotas - Joel E Cia"),
		).not.toBeInTheDocument();
	});

	it("updates the displayed value after selecting a responsible", async () => {
		const user = userEvent.setup();
		render(<ControlledResponsibleSelect />);

		const combobox = screen.getByRole("combobox", { name: "Responsável" });
		await user.click(combobox);
		await user.click(screen.getByText("Racon Pelotas - Joel E Cia"));

		expect(screen.getByRole("combobox", { name: "Responsável" })).toHaveTextContent(
			"Racon Pelotas - Joel E Cia",
		);
		expect(
			screen.queryByPlaceholderText("Buscar responsável..."),
		).not.toBeInTheDocument();
	});

	it("shows the empty state when no responsible matches the search", async () => {
		const user = userEvent.setup();
		render(<ControlledResponsibleSelect />);

		await user.click(screen.getByRole("combobox", { name: "Responsável" }));
		await user.type(screen.getByPlaceholderText("Buscar responsável..."), "zzz");

		expect(
			screen.getByText("Nenhum responsável encontrado."),
		).toBeInTheDocument();
	});
});
