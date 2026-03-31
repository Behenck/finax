import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps, ComponentType } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SaleDetailsPage } from "../src/pages/_app/sales/$saleId";

const mocks = vi.hoisted(() => ({
	canMock: vi.fn(),
	navigateMock: vi.fn(),
	deleteSaleMock: vi.fn().mockResolvedValue(undefined),
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

vi.mock("@/context/app-context", () => ({
	useApp: () => ({
		organization: {
			slug: "org-test",
		},
	}),
}));

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
				saleDate: "2026-03-10",
				totalAmount: 100_000,
				status: "COMPLETED",
				customer: {
					id: "customer-1",
					name: "Cliente Teste",
				},
				product: {
					id: "product-1",
					name: "Produto Teste",
				},
				company: {
					id: "company-1",
					name: "Empresa Teste",
				},
				unit: null,
				responsibleType: "SELLER",
				responsibleId: "seller-1",
				responsible: {
					id: "seller-1",
					type: "SELLER",
					name: "Vendedor Teste",
				},
				dynamicFieldSchema: [],
				dynamicFieldValues: {},
				commissions: [
					{
						id: "commission-1",
						sourceType: "PULLED",
						recipientType: "SELLER",
						direction: "OUTCOME",
						beneficiaryId: "seller-1",
						beneficiaryLabel: "Vendedor Teste",
						totalPercentage: 2,
						totalAmount: 2000,
						installments: [
							{
								installmentNumber: 1,
								percentage: 2,
								amount: 2000,
							},
						],
					},
					{
						id: "commission-2",
						sourceType: "MANUAL",
						recipientType: "PARTNER",
						direction: "OUTCOME",
						beneficiaryId: "partner-1",
						beneficiaryLabel: "Parceiro Teste",
						totalPercentage: 1,
						totalAmount: 1000,
						installments: [
							{
								installmentNumber: 1,
								percentage: 1,
								amount: 1000,
							},
						],
					},
				],
				createdBy: {
					name: "Usuário Teste",
				},
				createdAt: "2026-03-10T00:00:00.000Z",
				updatedAt: "2026-03-10T00:00:00.000Z",
				notes: null,
			},
		},
		isLoading: false,
		isError: false,
	}),
	useSaleHistory: () => ({
		data: {
			history: [],
		},
		isLoading: false,
		isError: false,
	}),
	useDeleteSale: () => ({
		mutateAsync: mocks.deleteSaleMock,
		isPending: false,
	}),
	useSaleNavigation: () => ({
		previousSaleId: "sale-0",
		nextSaleId: "sale-2",
		isLoading: false,
	}),
}));

vi.mock("@/http/generated", () => ({
	useGetOrganizationsSlugProducts: () => ({
		data: {
			products: [],
		},
	}),
}));

vi.mock("../src/pages/_app/sales/-components/sale-installments-drawer", () => ({
	SaleInstallmentsDrawer: ({
		open,
		saleCommissionId,
	}: {
		open: boolean;
		saleCommissionId?: string;
	}) =>
		open ? (
			<div
				data-testid="sale-installments-drawer"
				data-sale-commission-id={saleCommissionId ?? ""}
			/>
		) : null,
}));

describe("sale details commission actions", () => {
	beforeEach(() => {
		mocks.navigateMock.mockReset();
		mocks.deleteSaleMock.mockReset();
		mocks.canMock.mockImplementation(
			(_action: string, permission: string) =>
				permission === "sales.view" ||
				permission === "sales.create" ||
				permission === "sales.commissions.installments.status.change",
		);
	});

	it("should render Ver todas and Ver per commission and open drawer with correct scope", async () => {
		const user = userEvent.setup();

		render(<SaleDetailsPage />);

		expect(
			screen.getByRole("button", {
				name: "Ver todas",
			}),
		).toBeInTheDocument();
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
		expect(
			screen.getByRole("button", {
				name: "Ações",
			}),
		).toBeInTheDocument();
		expect(screen.getAllByRole("button", { name: "Ver" })).toHaveLength(2);
		await user.click(
			screen.getByRole("button", {
				name: "Venda próxima",
			}),
		);
		expect(mocks.navigateMock).toHaveBeenCalledWith({
			to: "/sales/$saleId",
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
		await user.keyboard("{Escape}");

		await user.click(
			screen.getAllByRole("button", { name: "Ver" })[0] as HTMLElement,
		);
		expect(screen.getByTestId("sale-installments-drawer")).toHaveAttribute(
			"data-sale-commission-id",
			"commission-1",
		);

		await user.click(
			screen.getByRole("button", {
				name: "Ver todas",
			}),
		);
		expect(screen.getByTestId("sale-installments-drawer")).toHaveAttribute(
			"data-sale-commission-id",
			"",
		);
	});
});
