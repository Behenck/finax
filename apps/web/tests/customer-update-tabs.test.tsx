import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps, ComponentType } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UpdateCustomer } from "../src/pages/_app/registers/customers/update";

const mocks = vi.hoisted(() => ({
	customerQueryMock: vi.fn(),
}));

function buildCustomerResponse(params?: {
	sales?: Array<{
		id: string;
		productName: string;
		totalAmount: number;
		status: "PENDING" | "APPROVED" | "COMPLETED" | "CANCELED";
		hasOpenDelinquency: boolean;
		openCount: number;
		oldestDueDate: string | null;
		openDelinquencies: Array<{ id: string; dueDate: string }>;
	}>;
}) {
	const sales =
		params?.sales?.map((sale) => ({
			id: sale.id,
			saleDate: "2026-04-10T00:00:00.000Z",
			totalAmount: sale.totalAmount,
			status: sale.status,
			createdAt: "2026-04-10T00:00:00.000Z",
			updatedAt: "2026-04-10T00:00:00.000Z",
			product: {
				id: "product-1",
				name: sale.productName,
			},
			company: {
				id: "company-1",
				name: "Empresa Alpha",
			},
			unit: null,
			responsible: {
				type: "PARTNER" as const,
				id: "partner-1",
				name: "Parceiro 1",
			},
			delinquencySummary: {
				hasOpen: sale.hasOpenDelinquency,
				openCount: sale.openCount,
				oldestDueDate: sale.oldestDueDate,
				latestDueDate: sale.oldestDueDate,
			},
			openDelinquencies: sale.openDelinquencies.map((occurrence) => ({
				id: occurrence.id,
				dueDate: occurrence.dueDate,
				resolvedAt: null,
				createdAt: "2026-04-01T00:00:00.000Z",
				updatedAt: "2026-04-01T00:00:00.000Z",
				createdBy: {
					id: "user-1",
					name: "Usuário 1",
					avatarUrl: null,
				},
				resolvedBy: null,
			})),
		})) ?? [];

	return {
		customer: {
			id: "customer-1",
			name: "Cliente Teste",
			sales,
		},
	};
}

vi.mock("@tanstack/react-router", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@tanstack/react-router")>();

	return {
		...actual,
		createFileRoute: () => (options: { component: ComponentType }) => ({
			...options,
			useSearch: () => ({
				customerId: "customer-1",
			}),
		}),
		Link: ({ children, ...props }: ComponentProps<"a">) => (
			<a {...props}>{children}</a>
		),
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
	useGetOrganizationsSlugCustomersCustomerid: (...args: unknown[]) =>
		mocks.customerQueryMock(...args),
}));

vi.mock("@/permissions/access", () => ({
	useAbility: () => ({
		can: () => true,
	}),
}));

vi.mock("@/hooks/sales", () => ({
	useCustomerSalesDelinquencyBulkActions: () => ({
		markCustomerSalesAsDelinquent: vi.fn(),
		isMarkingCustomerSalesAsDelinquent: false,
		resolveCustomerSalesDelinquencies: vi.fn(),
		isResolvingCustomerSalesDelinquencies: false,
	}),
}));

vi.mock("../src/pages/_app/registers/customers/-components/form-customer", () => ({
	FormCustomer: () => <div>FormCustomerMock</div>,
}));

describe("customer update tabs", () => {
	beforeEach(() => {
		mocks.customerQueryMock.mockReset();
		mocks.customerQueryMock.mockReturnValue({
			data: buildCustomerResponse({
				sales: [
					{
						id: "sale-1",
						productName: "Seguro Auto",
						totalAmount: 150000,
						status: "COMPLETED",
						hasOpenDelinquency: true,
						openCount: 1,
						oldestDueDate: "2026-04-01T00:00:00.000Z",
						openDelinquencies: [
							{
								id: "delinq-1",
								dueDate: "2026-04-01T00:00:00.000Z",
							},
						],
					},
				],
			}),
		});
	});

	it("should render Dados and Vendas tabs with Dados as default", () => {
		render(<UpdateCustomer />);

		const dadosTab = screen.getByRole("tab", { name: "Dados" });
		expect(dadosTab).toBeInTheDocument();
		expect(dadosTab).toHaveAttribute("aria-selected", "true");
		expect(screen.getByRole("tab", { name: "Vendas" })).toBeInTheDocument();
		expect(screen.getByText("FormCustomerMock")).toBeInTheDocument();
	});

	it("should show customer sales in Vendas tab", async () => {
		const user = userEvent.setup();
		render(<UpdateCustomer />);

		await user.click(screen.getByRole("tab", { name: "Vendas" }));

		expect(screen.getByText("Vendas do cliente")).toBeInTheDocument();
		expect(screen.getAllByText("Seguro Auto").length).toBeGreaterThan(0);
		expect(screen.getAllByText("1 inadimplência").length).toBeGreaterThan(0);
	});

	it("should show empty state in Vendas tab when customer has no sales", async () => {
		const user = userEvent.setup();
		mocks.customerQueryMock.mockReturnValue({
			data: buildCustomerResponse(),
		});

		render(<UpdateCustomer />);
		await user.click(screen.getByRole("tab", { name: "Vendas" }));

		expect(
			screen.getByText("Este cliente ainda não possui vendas visíveis."),
		).toBeInTheDocument();
	});
});
