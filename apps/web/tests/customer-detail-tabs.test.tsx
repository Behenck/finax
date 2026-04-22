import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps, ComponentType } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CustomerDetailPage } from "../src/pages/_app/registers/customers/$customerId";

const mocks = vi.hoisted(() => ({
	canMock: vi.fn(),
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
			personType: "PF" as const,
			phone: "51999999999",
			email: "cliente@teste.com",
			documentType: "CPF" as const,
			documentNumber: "12345678900",
			status: "ACTIVE" as const,
			responsible: {
				type: "PARTNER" as const,
				id: "partner-1",
				name: "Parceiro 1",
			},
			pf: {
				birthDate: "1990-01-01T00:00:00.000Z",
				monthlyIncome: 500000,
				profession: "Analista",
				placeOfBirth: "Porto Alegre",
				fatherName: "Pai",
				motherName: "Mãe",
				naturality: "RS",
			},
			pj: null,
			sales,
		},
	};
}

vi.mock("@tanstack/react-router", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@tanstack/react-router")>();

	return {
		...actual,
		createFileRoute: () => (options: { component: ComponentType }) => ({
			...options,
			useParams: () => ({
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

vi.mock("@/permissions/access", () => ({
	useAbility: () => ({
		can: mocks.canMock,
	}),
}));

vi.mock("@/http/generated", () => ({
	useGetOrganizationsSlugCustomersCustomerid: (...args: unknown[]) =>
		mocks.customerQueryMock(...args),
}));

vi.mock("@/hooks/sales", () => ({
	useCustomerSalesDelinquencyBulkActions: () => ({
		markCustomerSalesAsDelinquent: vi.fn(),
		isMarkingCustomerSalesAsDelinquent: false,
		resolveCustomerSalesDelinquencies: vi.fn(),
		isResolvingCustomerSalesDelinquencies: false,
	}),
	useLinkedSalesDelinquencyBulkActions: () => ({
		markLinkedSalesAsDelinquent: vi.fn(),
		isMarkingLinkedSalesAsDelinquent: false,
		resolveLinkedSalesDelinquencies: vi.fn(),
		isResolvingLinkedSalesDelinquencies: false,
	}),
}));

describe("customer detail tabs", () => {
	beforeEach(() => {
		mocks.canMock.mockReset();
		mocks.customerQueryMock.mockReset();
		mocks.canMock.mockImplementation(
			(_action: string, permission: string) =>
				permission === "registers.customers.view" ||
				permission === "registers.customers.update" ||
				permission === "sales.create" ||
				permission === "sales.view",
		);
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
			isLoading: false,
			isError: false,
		});
	});

	it("should render tabs and keep Dados as default tab", () => {
		render(<CustomerDetailPage />);

		const dadosTab = screen.getByRole("tab", { name: "Dados" });
		expect(dadosTab).toBeInTheDocument();
		expect(screen.getByRole("tab", { name: "Vendas" })).toBeInTheDocument();
		expect(dadosTab).toHaveAttribute("aria-selected", "true");
		expect(screen.getByText("Dados do cliente")).toBeInTheDocument();
	});

	it("should render skeleton while customer data is loading", () => {
		mocks.customerQueryMock.mockReturnValue({
			data: undefined,
			isLoading: true,
			isError: false,
		});

		render(<CustomerDetailPage />);

		expect(
			document.querySelectorAll('[data-slot="skeleton"]').length,
		).toBeGreaterThan(0);
		expect(screen.queryByText("Carregando cliente...")).not.toBeInTheDocument();
	});

	it("should display sales and delinquency info when switching to Vendas tab", async () => {
		const user = userEvent.setup();
		render(<CustomerDetailPage />);

		await user.click(screen.getByRole("tab", { name: "Vendas" }));

		expect(screen.getByText("Vendas do cliente")).toBeInTheDocument();
		expect(screen.getAllByText("Seguro Auto").length).toBeGreaterThan(0);
		expect(screen.getAllByText("1 inadimplência").length).toBeGreaterThan(0);
		expect(screen.getByText("Ocorrências em aberto")).toBeInTheDocument();
	});

	it("should show empty sales state in Vendas tab", async () => {
		const user = userEvent.setup();
		mocks.customerQueryMock.mockReturnValue({
			data: buildCustomerResponse(),
			isLoading: false,
			isError: false,
		});

		render(<CustomerDetailPage />);
		await user.click(screen.getByRole("tab", { name: "Vendas" }));

		expect(
			screen.getByText("Este cliente ainda não possui vendas visíveis."),
		).toBeInTheDocument();
	});

	it("should still show Vendas tab when user has no sales.view permission", async () => {
		const user = userEvent.setup();
		mocks.canMock.mockImplementation(
			(_action: string, permission: string) =>
				permission === "registers.customers.view" ||
				permission === "registers.customers.update" ||
				permission === "sales.create",
		);

		render(<CustomerDetailPage />);

		expect(screen.getByRole("tab", { name: "Vendas" })).toBeInTheDocument();
		expect(screen.getByText("Dados do cliente")).toBeInTheDocument();

		await user.click(screen.getByRole("tab", { name: "Vendas" }));
		expect(screen.getByText("Vendas do cliente")).toBeInTheDocument();
	});
});
