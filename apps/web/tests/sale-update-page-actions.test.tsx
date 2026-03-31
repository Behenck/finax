import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps, ComponentType } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UpdateSalePage } from "../src/pages/_app/sales/update/$saleId";

const mocks = vi.hoisted(() => ({
	canMock: vi.fn(),
	navigateMock: vi.fn(),
}));

vi.mock("@tanstack/react-router", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@tanstack/react-router")>();

	return {
		...actual,
		createFileRoute: () => (options: { component: ComponentType }) => ({
			...options,
			useParams: () => ({
				saleId: "sale-1",
			}),
		}),
		Link: ({ children, ...props }: ComponentProps<"a">) => (
			<a {...props}>{children}</a>
		),
		useNavigate: () => mocks.navigateMock,
	};
});

vi.mock("@/permissions/access", () => ({
	useAbility: () => ({
		can: mocks.canMock,
	}),
}));

vi.mock("@/hooks/sales", () => ({
	useSale: () => ({
		data: {
			sale: {
				id: "sale-1",
				status: "PENDING",
				customer: {
					id: "customer-1",
				},
			},
		},
		isLoading: false,
		isError: false,
	}),
	useSaleNavigation: () => ({
		previousSaleId: "sale-0",
		nextSaleId: "sale-2",
		isLoading: false,
	}),
	useDeleteSale: () => ({
		mutateAsync: vi.fn().mockResolvedValue(undefined),
		isPending: false,
	}),
}));

vi.mock("../src/pages/_app/sales/-components/sale-form", () => ({
	SaleForm: () => <div data-testid="sale-form" />,
}));

describe("sale update page actions", () => {
	beforeEach(() => {
		mocks.canMock.mockReset();
		mocks.navigateMock.mockReset();
		mocks.canMock.mockImplementation(
			(_action: string, permission: string) =>
				permission === "sales.update" || permission === "sales.create",
		);
	});

	it("should render navigation arrows and duplicate action in update page header", async () => {
		const user = userEvent.setup();
		render(<UpdateSalePage />);

		expect(
			screen.getByRole("button", {
				name: "Venda anterior",
			}),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", {
				name: "Venda próxima",
			}),
		).toBeInTheDocument();
		expect(screen.getByText("Voltar")).toBeInTheDocument();
		expect(
			screen.getByRole("button", {
				name: "Ações",
			}),
		).toBeInTheDocument();
		await user.click(
			screen.getByRole("button", {
				name: "Venda próxima",
			}),
		);
		expect(mocks.navigateMock).toHaveBeenCalledWith({
			to: "/sales/update/$saleId",
			params: {
				saleId: "sale-2",
			},
		});
		await user.click(
			screen.getByRole("button", {
				name: "Ações",
			}),
		);
		expect(screen.getByText("Criar venda")).toBeInTheDocument();
		expect(screen.getByText("Venda em massa")).toBeInTheDocument();
		expect(screen.getByText("Editar")).toBeInTheDocument();
		expect(screen.getByText("Duplicar")).toBeInTheDocument();
		expect(screen.getByTestId("sale-form")).toBeInTheDocument();
	});
});
