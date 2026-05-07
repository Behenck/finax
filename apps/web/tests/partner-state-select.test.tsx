import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PartnerStateSelect } from "@/pages/_app/registers/partners/-components/partner-state-select";

describe("partner-state-select", () => {
	it("shows the selected state with UF", () => {
		render(<PartnerStateSelect value="RS" onChange={vi.fn()} />);

		expect(
			screen.getByRole("combobox", {
				name: "Selecionar estado",
			}),
		).toHaveTextContent("Rio Grande do Sul (RS)");
	});

	it("allows searching by state name and UF", async () => {
		const user = userEvent.setup();
		const onChange = vi.fn();

		render(<PartnerStateSelect value="" onChange={onChange} />);

		await user.click(
			screen.getByRole("combobox", {
				name: "Selecionar estado",
			}),
		);

		const dialog = screen.getByRole("dialog");
		const searchInput = within(dialog).getByPlaceholderText("Buscar estado...");

		await user.type(searchInput, "rs");
		expect(
			within(dialog).getByRole("button", {
				name: "Rio Grande do Sul (RS)",
			}),
		).toBeInTheDocument();

		await user.clear(searchInput);
		await user.type(searchInput, "rio grande");
		await user.click(
			within(dialog).getByRole("button", {
				name: "Rio Grande do Sul (RS)",
			}),
		);

		expect(onChange).toHaveBeenCalledWith("RS");
	});
});
