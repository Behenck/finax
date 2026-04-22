import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { Toaster } from "../src/components/ui/sonner";

vi.mock("next-themes", () => ({
	useTheme: () => ({
		theme: "light",
	}),
}));

describe("Toaster", () => {
	beforeEach(() => {
		toast.dismiss();
	});

	it("renders in the top center and keeps styled variants for the main toast types", async () => {
		render(<Toaster visibleToasts={10} />);

		toast.success("Sucesso");
		toast.warning("Aviso");
		toast.error("Erro");
		toast.info("Informacao");
		toast.loading("Carregando");

		await waitFor(() => {
			expect(screen.getByText("Sucesso")).toBeInTheDocument();
			expect(screen.getByText("Aviso")).toBeInTheDocument();
			expect(screen.getByText("Erro")).toBeInTheDocument();
			expect(screen.getByText("Informacao")).toBeInTheDocument();
			expect(screen.getByText("Carregando")).toBeInTheDocument();
		});

		const toaster = document.querySelector("[data-sonner-toaster]");

		expect(toaster).toHaveAttribute("data-x-position", "center");
		expect(toaster).toHaveAttribute("data-y-position", "top");
		expect(toaster).toHaveClass("finax-toaster");

		expect(screen.getByText("Sucesso").closest("[data-sonner-toast]")).toHaveClass(
			"finax-toast",
			"finax-toast-success",
		);
		expect(screen.getByText("Aviso").closest("[data-sonner-toast]")).toHaveClass(
			"finax-toast",
			"finax-toast-warning",
		);
		expect(screen.getByText("Erro").closest("[data-sonner-toast]")).toHaveClass(
			"finax-toast",
			"finax-toast-error",
		);
		expect(
			screen.getByText("Informacao").closest("[data-sonner-toast]"),
		).toHaveClass("finax-toast", "finax-toast-info");
		expect(
			screen.getByText("Carregando").closest("[data-sonner-toast]"),
		).toHaveClass("finax-toast", "finax-toast-loading");
	});
});
