import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentPropsWithoutRef } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CustomerSalesList } from "../src/pages/_app/registers/customers/-components/customer-sales-list";

const mocks = vi.hoisted(() => ({
	markCustomerSalesAsDelinquentMock: vi.fn(),
	resolveCustomerSalesDelinquenciesMock: vi.fn(),
	toastSuccessMock: vi.fn(),
	toastWarningMock: vi.fn(),
	toastInfoMock: vi.fn(),
	toastErrorMock: vi.fn(),
	queryValues: new Map<string, unknown>([
		["page", 1],
		["pageSize", 20],
	]),
	setQueryStateCalls: vi.fn<(key: string, value: unknown) => void>(),
	resetQueryState(nextValues?: Record<string, unknown>) {
		mocks.queryValues.clear();
		for (const [key, value] of Object.entries({
			page: 1,
			pageSize: 20,
			...nextValues,
		})) {
			mocks.queryValues.set(key, value);
		}
		mocks.setQueryStateCalls.mockReset();
	},
}));

function buildSales() {
	return [
		{
			id: "sale-completed",
			saleDate: "2026-04-10T00:00:00.000Z",
			totalAmount: 150000,
			status: "COMPLETED" as const,
			createdAt: "2026-04-10T00:00:00.000Z",
			updatedAt: "2026-04-10T00:00:00.000Z",
			product: {
				id: "product-1",
				name: "Seguro Auto",
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
				hasOpen: true,
				openCount: 1,
				oldestDueDate: "2026-04-01T00:00:00.000Z",
				latestDueDate: "2026-04-01T00:00:00.000Z",
			},
			openDelinquencies: [
				{
					id: "delinq-1",
					dueDate: "2026-04-01T00:00:00.000Z",
					resolvedAt: null,
					createdAt: "2026-04-01T00:00:00.000Z",
					updatedAt: "2026-04-01T00:00:00.000Z",
					createdBy: {
						id: "user-1",
						name: "Usuário 1",
						avatarUrl: null,
					},
					resolvedBy: null,
				},
			],
		},
		{
			id: "sale-pending",
			saleDate: "2026-04-11T00:00:00.000Z",
			totalAmount: 99000,
			status: "PENDING" as const,
			createdAt: "2026-04-11T00:00:00.000Z",
			updatedAt: "2026-04-11T00:00:00.000Z",
			product: {
				id: "product-2",
				name: "Seguro Vida",
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
				hasOpen: false,
				openCount: 0,
				oldestDueDate: null,
				latestDueDate: null,
			},
			openDelinquencies: [],
		},
	];
}

function buildPaginatedSales(total: number) {
	return Array.from({ length: total }, (_, index) => ({
		id: `sale-${index + 1}`,
		saleDate: "2026-04-10T00:00:00.000Z",
		totalAmount: 100000 + index,
		status: "COMPLETED" as const,
		createdAt: "2026-04-10T00:00:00.000Z",
		updatedAt: "2026-04-10T00:00:00.000Z",
		product: {
			id: `product-${index + 1}`,
			name: `Produto ${index + 1}`,
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
			hasOpen: false,
			openCount: 0,
			oldestDueDate: null,
			latestDueDate: null,
		},
		openDelinquencies: [],
	}));
}

vi.mock("@tanstack/react-router", () => ({
	Link: ({
		children,
		...props
	}: ComponentPropsWithoutRef<"a"> & { to?: string }) => (
		<a {...props}>{children}</a>
	),
}));

vi.mock("nuqs", async (importOriginal) => {
	const actual = await importOriginal<typeof import("nuqs")>();
	const React = await import("react");

	return {
		...actual,
		useQueryState: (key: string) => {
			const [value, setValue] = React.useState(() =>
				mocks.queryValues.get(key),
			);

			const setQueryState = (
				next: unknown | ((previous: unknown) => unknown),
			) => {
				setValue((previous) => {
					const resolvedValue =
						typeof next === "function"
							? (next as (previous: unknown) => unknown)(previous)
							: next;
					mocks.queryValues.set(key, resolvedValue);
					mocks.setQueryStateCalls(key, resolvedValue);
					return resolvedValue;
				});

				return Promise.resolve(null);
			};

			return [value, setQueryState] as const;
		},
	};
});

vi.mock("@/hooks/sales", () => ({
	useLinkedSalesDelinquencyBulkActions: () => ({
		markLinkedSalesAsDelinquent: mocks.markCustomerSalesAsDelinquentMock,
		isMarkingLinkedSalesAsDelinquent: false,
		resolveLinkedSalesDelinquencies:
			mocks.resolveCustomerSalesDelinquenciesMock,
		isResolvingLinkedSalesDelinquencies: false,
	}),
}));

vi.mock("sonner", () => ({
	toast: {
		success: mocks.toastSuccessMock,
		warning: mocks.toastWarningMock,
		info: mocks.toastInfoMock,
		error: mocks.toastErrorMock,
	},
}));

vi.mock("@/components/ui/calendar-date-input", () => ({
	CalendarDateInput: ({
		value,
		onChange,
	}: {
		value?: string;
		onChange: (value: string) => void;
	}) => (
		<input
			aria-label="Data de vencimento"
			value={value ?? ""}
			onChange={(event) => onChange(event.target.value)}
		/>
	),
}));

describe("customer sales list bulk delinquency actions", () => {
	beforeEach(() => {
		mocks.markCustomerSalesAsDelinquentMock.mockReset();
		mocks.resolveCustomerSalesDelinquenciesMock.mockReset();
		mocks.toastSuccessMock.mockReset();
		mocks.toastWarningMock.mockReset();
		mocks.toastInfoMock.mockReset();
		mocks.toastErrorMock.mockReset();
		mocks.resetQueryState();
	});

	it("should render selection controls when user can manage delinquencies", async () => {
		const user = userEvent.setup();
		render(
			<CustomerSalesList
				sales={buildSales()}
				customerId="customer-1"
				canManageDelinquencies
			/>,
		);

		expect(
			screen.getAllByLabelText("Selecionar todas as vendas visíveis").length,
		).toBeGreaterThan(0);

		await user.click(
			screen.getAllByLabelText("Selecionar venda Seguro Auto")[0]!,
		);

		expect(screen.getByText("1 venda(s) selecionada(s)")).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Marcar inadimplente" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Remover inadimplências" }),
		).toBeInTheDocument();
	});

	it("should keep list as read-only when user cannot manage delinquencies", () => {
		render(
			<CustomerSalesList
				sales={buildSales()}
				customerId="customer-1"
				canManageDelinquencies={false}
			/>,
		);

		expect(
			screen.queryByLabelText("Selecionar todas as vendas visíveis"),
		).not.toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "Marcar inadimplente" }),
		).not.toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "Remover inadimplências" }),
		).not.toBeInTheDocument();
	});

	it("should mark selected sales as delinquent and show partial summary", async () => {
		const user = userEvent.setup();
		mocks.markCustomerSalesAsDelinquentMock.mockResolvedValue({
			selectedCount: 2,
			attemptedCount: 1,
			successCount: 1,
			failedCount: 0,
			ignoredNotCompletedCount: 1,
		});

		render(
			<CustomerSalesList
				sales={buildSales()}
				customerId="customer-1"
				canManageDelinquencies
			/>,
		);

		await user.click(
			screen.getAllByLabelText("Selecionar venda Seguro Auto")[0]!,
		);
		await user.click(
			screen.getAllByLabelText("Selecionar venda Seguro Vida")[0]!,
		);
		await user.click(
			screen.getByRole("button", { name: "Marcar inadimplente" }),
		);
		const markDialog = screen.getByRole("dialog", {
			name: "Marcar vendas como inadimplentes",
		});
		await user.type(
			within(markDialog).getByLabelText("Data de vencimento"),
			"2020-01-01",
		);
		await user.click(
			within(markDialog).getByRole("button", {
				name: "Marcar inadimplente",
			}),
		);

		await waitFor(() => {
			expect(mocks.markCustomerSalesAsDelinquentMock).toHaveBeenCalled();
		});

		expect(mocks.markCustomerSalesAsDelinquentMock).toHaveBeenCalledWith(
			expect.objectContaining({
				owner: {
					type: "CUSTOMER",
					id: "customer-1",
				},
				dueDate: "2020-01-01",
			}),
		);
		expect(mocks.toastWarningMock).toHaveBeenCalledWith(
			"1 venda(s) marcada(s) · 1 ignorada(s) por status",
		);
		expect(
			screen.queryByText("2 venda(s) selecionada(s)"),
		).not.toBeInTheDocument();
	});

	it("should resolve open delinquencies and show summary", async () => {
		const user = userEvent.setup();
		mocks.resolveCustomerSalesDelinquenciesMock.mockResolvedValue({
			selectedCount: 2,
			attemptedOccurrenceCount: 1,
			resolvedCount: 1,
			failedCount: 0,
			skippedWithoutOpenCount: 1,
		});

		render(
			<CustomerSalesList
				sales={buildSales()}
				customerId="customer-1"
				canManageDelinquencies
			/>,
		);

		await user.click(
			screen.getAllByLabelText("Selecionar venda Seguro Auto")[0]!,
		);
		await user.click(
			screen.getAllByLabelText("Selecionar venda Seguro Vida")[0]!,
		);
		await user.click(
			screen.getByRole("button", { name: "Remover inadimplências" }),
		);
		const resolveDialog = screen.getByRole("alertdialog", {
			name: "Remover inadimplências em lote",
		});
		await user.click(
			within(resolveDialog).getByRole("button", {
				name: "Remover inadimplências",
			}),
		);

		await waitFor(() => {
			expect(mocks.resolveCustomerSalesDelinquenciesMock).toHaveBeenCalled();
		});

		expect(mocks.resolveCustomerSalesDelinquenciesMock).toHaveBeenCalledWith(
			expect.objectContaining({
				owner: {
					type: "CUSTOMER",
					id: "customer-1",
				},
			}),
		);
		expect(mocks.toastWarningMock).toHaveBeenCalledWith(
			"1 ocorrência(s) resolvida(s) · 1 venda(s) sem ocorrência",
		);
		expect(
			screen.queryByText("2 venda(s) selecionada(s)"),
		).not.toBeInTheDocument();
	});

	it("should keep selections across pages while selecting only visible sales", async () => {
		const user = userEvent.setup();
		render(
			<CustomerSalesList
				sales={buildPaginatedSales(25)}
				customerId="customer-1"
				canManageDelinquencies
			/>,
		);

		await user.click(
			screen.getAllByLabelText("Selecionar todas as vendas visíveis")[0]!,
		);

		expect(screen.getByText("20 venda(s) selecionada(s)")).toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: "Próxima página" }));

		await waitFor(() => {
			expect(
				screen.getByRole("button", { name: "Ir para página 2" }),
			).toHaveAttribute("aria-current", "page");
		});

		expect(screen.getByText("20 venda(s) selecionada(s)")).toBeInTheDocument();
		expect(
			screen.getAllByLabelText("Selecionar venda Produto 21")[0],
		).not.toBeChecked();

		await user.click(
			screen.getAllByLabelText("Selecionar todas as vendas visíveis")[0]!,
		);

		expect(screen.getByText("25 venda(s) selecionada(s)")).toBeInTheDocument();
	});
});
