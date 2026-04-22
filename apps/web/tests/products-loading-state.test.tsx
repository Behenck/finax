import { render, screen } from "@testing-library/react";
import type { ComponentProps, ComponentType } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Products } from "../src/pages/_app/registers/products";

const mocks = vi.hoisted(() => ({
	productsQueryMock: vi.fn(),
}));

vi.mock("@tanstack/react-router", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@tanstack/react-router")>();

	return {
		...actual,
		createFileRoute: () => (options: { component: ComponentType }) => options,
		Link: ({ children, ...props }: ComponentProps<"a">) => (
			<a {...props}>{children}</a>
		),
	};
});

vi.mock("nuqs", async (importOriginal) => {
	const actual = await importOriginal<typeof import("nuqs")>();

	return {
		...actual,
		useQueryState: () => ["", vi.fn()],
	};
});

vi.mock("@/context/app-context", () => ({
	useApp: () => ({
		organization: {
			slug: "org-teste",
		},
	}),
}));

vi.mock("@/http/generated", () => ({
	useGetOrganizationsSlugProducts: (...args: unknown[]) =>
		mocks.productsQueryMock(...args),
}));

describe("products loading state", () => {
	beforeEach(() => {
		mocks.productsQueryMock.mockReset();
	});

	it("should render skeleton instead of loading text", () => {
		mocks.productsQueryMock.mockReturnValue({
			data: undefined,
			isLoading: true,
			isError: false,
		});

		render(<Products />);

		expect(
			document.querySelectorAll('[data-slot="skeleton"]').length,
		).toBeGreaterThan(0);
		expect(screen.queryByText("Carregando...")).not.toBeInTheDocument();
	});

	it("should render loaded content inside the reveal wrapper", () => {
		mocks.productsQueryMock.mockReturnValue({
			data: {
				products: [],
			},
			isLoading: false,
			isError: false,
		});

		const { container } = render(<Products />);

		expect(
			container.querySelector('[data-slot="loading-reveal"]'),
		).toBeInTheDocument();
	});
});
