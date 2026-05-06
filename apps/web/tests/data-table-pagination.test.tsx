import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
	DataTablePagination,
	buildPaginationTokens,
} from "../src/components/data-table-pagination";

describe("DataTablePagination", () => {
	it("should render summary, page buttons and trigger navigation handlers", async () => {
		const user = userEvent.setup();
		const onPageChange = vi.fn();
		const onPageSizeChange = vi.fn();
		const originalHasPointerCapture = Element.prototype.hasPointerCapture;
		const originalSetPointerCapture = Element.prototype.setPointerCapture;
		const originalReleasePointerCapture =
			Element.prototype.releasePointerCapture;
		const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;

		Object.defineProperty(Element.prototype, "hasPointerCapture", {
			configurable: true,
			value: () => false,
		});
		Object.defineProperty(Element.prototype, "setPointerCapture", {
			configurable: true,
			value: () => {},
		});
		Object.defineProperty(Element.prototype, "releasePointerCapture", {
			configurable: true,
			value: () => {},
		});
		Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
			configurable: true,
			value: () => {},
		});

		render(
			<DataTablePagination
				page={4}
				pageSize={20}
				totalItems={200}
				totalPages={10}
				onPageChange={onPageChange}
				onPageSizeChange={onPageSizeChange}
			/>,
		);

		expect(
			screen.getByText((_, element) => {
				return element?.textContent === "Página 4 de 10";
			}),
		).toBeInTheDocument();
		expect(
			screen.getByText((_, element) => {
				return element?.textContent === "200 linhas totais";
			}),
		).toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: "Página anterior" }));
		await user.click(screen.getByRole("button", { name: "Próxima página" }));
		await user.click(screen.getByRole("button", { name: "Ir para página 6" }));

		expect(onPageChange).toHaveBeenCalledWith(3);
		expect(onPageChange).toHaveBeenCalledWith(5);
		expect(onPageChange).toHaveBeenCalledWith(6);

		await user.click(
			screen.getByRole("combobox", { name: "Linhas por página" }),
		);
		await user.click(await screen.findByText("50"));

		expect(onPageSizeChange).toHaveBeenCalledWith(50);

		if (originalHasPointerCapture) {
			Object.defineProperty(Element.prototype, "hasPointerCapture", {
				configurable: true,
				value: originalHasPointerCapture,
			});
		}
		if (originalSetPointerCapture) {
			Object.defineProperty(Element.prototype, "setPointerCapture", {
				configurable: true,
				value: originalSetPointerCapture,
			});
		}
		if (originalReleasePointerCapture) {
			Object.defineProperty(Element.prototype, "releasePointerCapture", {
				configurable: true,
				value: originalReleasePointerCapture,
			});
		}
		if (originalScrollIntoView) {
			Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
				configurable: true,
				value: originalScrollIntoView,
			});
		}
	});

	it("should build compact tokens with ellipsis when needed", () => {
		expect(buildPaginationTokens(5, 10)).toEqual([
			1,
			"start-ellipsis",
			3,
			4,
			5,
			6,
			7,
			"end-ellipsis",
			10,
		]);
	});
});
