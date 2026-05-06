import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SalesDataTable } from "../src/pages/_app/sales/-components/sales-data-table";

const mocks = vi.hoisted(() => {
	const queryDefaults: Record<string, unknown> = {
		q: "",
		companyId: "",
		unitId: "",
		status: "ALL",
		responsibleType: "ALL",
		responsibleId: "",
		saleDateFrom: "",
		saleDateTo: "",
		page: 1,
		pageSize: 10,
	};
	const queryValues = new Map<string, unknown>(Object.entries(queryDefaults));
	const canMock = vi.fn();
	const useQueriesMock = vi.fn();
	const getOrganizationsSlugSalesSaleidQueryOptionsMock = vi.fn();

	function resetQueryValues(overrides: Partial<typeof queryDefaults> = {}) {
		queryValues.clear();
		for (const [key, value] of Object.entries({
			...queryDefaults,
			...overrides,
		})) {
			queryValues.set(key, value);
		}
	}

	return {
		queryValues,
		resetQueryValues,
		canMock,
		useQueriesMock,
		getOrganizationsSlugSalesSaleidQueryOptionsMock,
	};
});

vi.mock("@tanstack/react-router", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@tanstack/react-router")>();

	return {
		...actual,
		Link: ({
			children,
			to,
		}: {
			children?: ReactNode;
			to?: string;
		}) => <a href={typeof to === "string" ? to : "#"}>{children}</a>,
	};
});

vi.mock("nuqs", async (importOriginal) => {
	const actual = await importOriginal<typeof import("nuqs")>();
	const React = await import("react");

	return {
		...actual,
		useQueryState: (key: string) => {
			const [value, setValue] = React.useState(() => mocks.queryValues.get(key));

			const setQueryState = (
				next: unknown | ((previous: unknown) => unknown),
			) => {
				setValue((previous) => {
					const resolvedValue =
						typeof next === "function"
							? (next as (previous: unknown) => unknown)(previous)
							: next;
					mocks.queryValues.set(key, resolvedValue);
					return resolvedValue;
				});

				return Promise.resolve(null);
			};

			return [
				value,
				setQueryState as Dispatch<SetStateAction<unknown>>,
			] as const;
		},
	};
});

vi.mock("@tanstack/react-query", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@tanstack/react-query")>();

	return {
		...actual,
		useQueries: (...args: unknown[]) => mocks.useQueriesMock(...args),
	};
});

vi.mock("@/components/filter-panel", () => ({
	FilterPanel: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/responsive-data-view", () => ({
	ResponsiveDataView: ({ desktop }: { desktop: ReactNode }) => <>{desktop}</>,
}));

vi.mock("@/components/ui/context-menu", () => ({
	ContextMenu: ({ children }: { children: ReactNode }) => <>{children}</>,
	ContextMenuTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
	ContextMenuContent: () => null,
	ContextMenuItem: () => null,
	ContextMenuLabel: () => null,
	ContextMenuSeparator: () => null,
}));

vi.mock("@/components/ui/dropdown-menu", () => ({
	DropdownMenu: ({ children }: { children: ReactNode }) => <>{children}</>,
	DropdownMenuTrigger: ({ children }: { children: ReactNode }) => (
		<>{children}</>
	),
	DropdownMenuContent: () => null,
	DropdownMenuItem: () => null,
	DropdownMenuLabel: () => null,
	DropdownMenuSeparator: () => null,
	DropdownMenuCheckboxItem: () => null,
}));

vi.mock("@/components/ui/select", async () => {
	const React = await import("react");

	type SelectContextValue = {
		value?: string;
		onValueChange?: (value: string) => void;
		disabled?: boolean;
	};

	const SelectContext = React.createContext<SelectContextValue>({});

	return {
		Select: ({
			value,
			onValueChange,
			disabled,
			children,
		}: {
			value?: string;
			onValueChange?: (value: string) => void;
			disabled?: boolean;
			children: ReactNode;
		}) => (
			<SelectContext.Provider
				value={{
					value,
					onValueChange,
					disabled,
				}}
			>
				<div>{children}</div>
			</SelectContext.Provider>
		),
		SelectTrigger: ({ children }: { children: ReactNode }) => (
			<button type="button" role="combobox">
				{children}
			</button>
		),
		SelectValue: ({ placeholder }: { placeholder?: string }) => {
			const context = React.useContext(SelectContext);
			return <span>{context.value || placeholder}</span>;
		},
		SelectContent: ({ children }: { children: ReactNode }) => (
			<div>{children}</div>
		),
		SelectItem: ({
			value,
			children,
		}: {
			value: string;
			children: ReactNode;
		}) => {
			const context = React.useContext(SelectContext);
			return (
				<button
					type="button"
					role="option"
					onClick={() => context.onValueChange?.(value)}
					disabled={context.disabled}
				>
					{children}
				</button>
			);
		},
	};
});

vi.mock("@/context/app-context", () => ({
	useApp: () => ({
		organization: {
			slug: "org-teste",
			preCancellationDelinquencyThreshold: null,
		},
	}),
}));

vi.mock("@/hooks/sales", () => ({
	useDeleteSale: () => ({
		mutateAsync: vi.fn(),
		isPending: false,
	}),
	useDeleteSalesBulk: () => ({
		mutateAsync: vi.fn(),
		isPending: false,
	}),
	usePatchSaleStatus: () => ({
		mutateAsync: vi.fn(),
		isPending: false,
	}),
	usePatchSalesStatusBulk: () => ({
		mutateAsync: vi.fn(),
		isPending: false,
	}),
}));

vi.mock("@/hooks/sales/use-sale-navigation", () => ({
	persistSaleNavigationContext: vi.fn(),
}));

vi.mock("@/http/generated", () => ({
	useGetOrganizationsSlugCompanies: () => ({
		data: {
			companies: [
				{
					id: "company-1",
					name: "Empresa Alpha",
					units: [
						{
							id: "unit-1",
							name: "Matriz",
						},
					],
				},
			],
		},
	}),
	useGetOrganizationsSlugProducts: () => ({
		data: {
			products: [
				{
					id: "product-1",
					name: "Produto Premium",
					children: [],
				},
				{
					id: "product-2",
					name: "Produto Standard",
					children: [],
				},
			],
		},
	}),
	getOrganizationsSlugSalesSaleidQueryOptions: (...args: unknown[]) =>
		mocks.getOrganizationsSlugSalesSaleidQueryOptionsMock(...args),
}));

vi.mock("@/permissions/access", () => ({
	useAbility: () => ({
		can: mocks.canMock,
	}),
}));

vi.mock("../src/pages/_app/sales/-components/sale-delinquency-badge", () => ({
	SaleDelinquencyBadge: () => <span>Sem inadimplência</span>,
}));

vi.mock(
	"../src/pages/_app/sales/-components/sale-installments-drawer",
	() => ({
		SaleInstallmentsDrawer: () => null,
	}),
);

vi.mock(
	"../src/pages/_app/sales/-components/sale-pre-cancellation-badge",
	() => ({
		SalePreCancellationBadge: () => null,
	}),
);

vi.mock("../src/pages/_app/sales/-components/sale-status-badge", () => ({
	SaleStatusBadge: ({ status }: { status: string }) => <span>{status}</span>,
}));

const salesFixture = [
	{
		id: "sale-1",
		saleDate: "2026-05-01T00:00:00.000Z",
		totalAmount: 150000,
		status: "COMPLETED" as const,
		notes: null,
		createdAt: "2026-05-01T10:00:00.000Z",
		updatedAt: "2026-05-01T11:00:00.000Z",
		customer: {
			id: "customer-1",
			name: "Maria Silva",
		},
		product: {
			id: "product-1",
			name: "Produto Premium",
		},
		company: {
			id: "company-1",
			name: "Empresa Alpha",
		},
		unit: {
			id: "unit-1",
			name: "Matriz",
		},
		createdBy: {
			id: "user-1",
			name: "Usuário 1",
			avatarUrl: null,
		},
		responsible: null,
		responsibleLabel: null,
		commissionInstallmentsSummary: {
			total: 0,
			pending: 0,
			paid: 0,
			canceled: 0,
			reversed: 0,
		},
		delinquencySummary: {
			hasOpen: false,
			openCount: 0,
			oldestDueDate: null,
			latestDueDate: null,
		},
	},
	{
		id: "sale-2",
		saleDate: "2026-05-02T00:00:00.000Z",
		totalAmount: 99000,
		status: "COMPLETED" as const,
		notes: null,
		createdAt: "2026-05-02T10:00:00.000Z",
		updatedAt: "2026-05-02T11:00:00.000Z",
		customer: {
			id: "customer-2",
			name: "Ana Souza",
		},
		product: {
			id: "product-2",
			name: "Produto Standard",
		},
		company: {
			id: "company-1",
			name: "Empresa Alpha",
		},
		unit: {
			id: "unit-1",
			name: "Matriz",
		},
		createdBy: {
			id: "user-2",
			name: "Usuário 2",
			avatarUrl: null,
		},
		responsible: null,
		responsibleLabel: null,
		commissionInstallmentsSummary: {
			total: 0,
			pending: 0,
			paid: 0,
			canceled: 0,
			reversed: 0,
		},
		delinquencySummary: {
			hasOpen: false,
			openCount: 0,
			oldestDueDate: null,
			latestDueDate: null,
		},
	},
];

describe("sales data table search", () => {
	beforeEach(() => {
		window.localStorage.clear();
		mocks.resetQueryValues();
		mocks.canMock.mockReset();
		mocks.useQueriesMock.mockReset();
		mocks.getOrganizationsSlugSalesSaleidQueryOptionsMock.mockReset();

		mocks.canMock.mockReturnValue(true);
		mocks.getOrganizationsSlugSalesSaleidQueryOptionsMock.mockImplementation(
			({ saleId }: { saleId: string }) => ({
				queryKey: ["sale", saleId],
				queryFn: vi.fn(),
			}),
		);
		mocks.useQueriesMock.mockImplementation(
			({ queries }: { queries: Array<{ queryKey?: unknown[] }> }) =>
				queries.map((query) => {
					const saleId = query.queryKey?.[1];

					return {
						data: {
							sale: {
								dynamicFieldSchema: [
									{
										fieldId: "field-contract",
										label: "Contrato",
										type: "TEXT",
										options: [],
									},
								],
								dynamicFieldValues: {
									"field-contract":
										saleId === "sale-1" ? "ABC-123" : "ZZZ-999",
								},
							},
						},
					};
				}),
		);
	});

	it("should search by custom field value even when the field column is hidden", async () => {
		const user = userEvent.setup();

		render(
			<SalesDataTable
				sales={salesFixture}
				isLoading={false}
				isError={false}
				showFilters
				onRetry={vi.fn()}
			/>,
		);

		await user.type(
			screen.getByPlaceholderText(
				"Buscar por cliente, produto, empresa ou campo personalizado...",
			),
			"ABC-123",
		);

		await waitFor(() => {
			expect(screen.getAllByText("Maria Silva").length).toBeGreaterThan(0);
		});
		expect(screen.queryByText("Ana Souza")).not.toBeInTheDocument();
	});
});
