import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps, ComponentType } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UpdateSalePage } from "../src/pages/_app/sales/update/$saleId";

const mocks = vi.hoisted(() => ({
	canMock: vi.fn(),
	navigateMock: vi.fn(),
	saleStatus: "PENDING" as "PENDING" | "COMPLETED",
	patchSaleStatusMock: vi.fn().mockResolvedValue(undefined),
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
				status: mocks.saleStatus,
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
	usePatchSaleStatus: () => ({
		mutateAsync: mocks.patchSaleStatusMock,
		isPending: false,
	}),
}));

vi.mock("../src/pages/_app/sales/-components/sale-form/index", () => ({
	SaleForm: () => <div data-testid="sale-form" />,
}));

describe("sale update page actions", () => {
	beforeEach(() => {
		mocks.canMock.mockReset();
		mocks.navigateMock.mockReset();
		mocks.patchSaleStatusMock.mockReset();
		mocks.saleStatus = "PENDING";
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
		expect(screen.getByText("Duplicar")).toBeInTheDocument();
		await user.click(screen.getByText("Duplicar"));
		expect(await screen.findByText("Duplicar venda")).toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: "Duplicar" }));
		expect(mocks.navigateMock).toHaveBeenCalledWith({
			to: "/sales/create",
			search: {
				duplicateSaleId: "sale-1",
			},
		});
		expect(screen.getByTestId("sale-form")).toBeInTheDocument();
	});

	it("should allow changing a completed sale to canceled in update page header", async () => {
		const user = userEvent.setup();
		mocks.saleStatus = "COMPLETED";
		mocks.canMock.mockImplementation(
			(_action: string, permission: string) =>
				permission === "sales.update" ||
				permission === "sales.create" ||
				permission === "sales.status.change",
		);

		render(<UpdateSalePage />);

		await user.click(
			screen.getByRole("button", {
				name: "Ações",
			}),
		);

		expect(screen.getByText("Alterar status")).toBeInTheDocument();
		expect(screen.queryByText("Sem transição")).not.toBeInTheDocument();

		await user.click(screen.getByText("Alterar status"));

		expect(await screen.findByText("Alterar status da venda")).toBeInTheDocument();
		expect(screen.getByText("Cancelada")).toBeInTheDocument();
	});

	it("should render a direct conclude action for pending sale in update page header", async () => {
		const user = userEvent.setup();
		mocks.saleStatus = "PENDING";
		mocks.canMock.mockImplementation(
			(_action: string, permission: string) =>
				permission === "sales.update" ||
				permission === "sales.create" ||
				permission === "sales.status.change",
		);

		render(<UpdateSalePage />);

		expect(
			screen.getByRole("button", {
				name: "Concluir venda",
			}),
		).toBeInTheDocument();
		expect(screen.queryByText("Mudar status")).not.toBeInTheDocument();
		expect(screen.queryByText("Alterar status da venda")).not.toBeInTheDocument();

		await user.click(
			screen.getByRole("button", {
				name: "Concluir venda",
			}),
		);

		expect(mocks.patchSaleStatusMock).toHaveBeenCalledWith({
			saleId: "sale-1",
			status: "COMPLETED",
		});
	});
});
