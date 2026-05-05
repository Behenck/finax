import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SalesDataTable } from "../src/pages/_app/sales/-components/sales-data-table";

const mocks = vi.hoisted(() => ({
	canMock: vi.fn(),
	deleteSaleMock: vi.fn(),
	deleteSalesBulkMock: vi.fn(),
	patchSaleStatusMock: vi.fn(),
	patchSalesStatusBulkMock: vi.fn(),
	persistSaleNavigationContextMock: vi.fn(),
}));

function createParserMock<T>(defaultValue?: T) {
	return {
		defaultValue,
		withDefault(nextDefaultValue: T) {
			return createParserMock(nextDefaultValue);
		},
		withOptions() {
			return createParserMock(defaultValue);
		},
	};
}

vi.mock("@tanstack/react-router", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@tanstack/react-router")>();

	return {
		...actual,
		Link: (props: {
			children: ReactNode;
			to?: string;
			params?: unknown;
			search?: unknown;
		} & ComponentProps<"a">) => {
			const { children, ...rest } = props;
			const linkProps = {
				...rest,
			};

			delete linkProps.to;
			delete linkProps.params;
			delete linkProps.search;

			return <a {...linkProps}>{children}</a>;
		},
	};
});

vi.mock("@tanstack/react-query", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@tanstack/react-query")>();

	return {
		...actual,
		useQueries: ({ queries }: { queries: unknown[] }) =>
			queries.map(() => ({
				data: {
					sale: {
						dynamicFieldSchema: [],
						dynamicFieldValues: {},
					},
				},
			})),
	};
});

vi.mock("nuqs", () => ({
	parseAsBoolean: createParserMock(false),
	parseAsInteger: createParserMock(0),
	parseAsString: createParserMock(""),
	parseAsStringLiteral: () => createParserMock(""),
	useQueryState: (key: string) => {
		const values: Record<string, string | number> = {
			q: "",
			companyId: "",
			unitId: "",
			status: "ALL",
			responsibleType: "ALL",
			responsibleId: "",
			saleDateFrom: "",
			saleDateTo: "",
			page: 1,
		};

		return [values[key] ?? "", vi.fn()];
	},
}));

vi.mock("@/components/filter-panel", () => ({
	FilterPanel: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/context-menu", async () => {
	const React = await import("react");
	const ReactDOM = await import("react-dom");

	type ContextMenuState = {
		open: boolean;
		setOpen(open: boolean): void;
	};

	const ContextMenuStateContext =
		React.createContext<ContextMenuState | null>(null);

	function useContextMenuState() {
		const state = React.useContext(ContextMenuStateContext);
		if (!state) {
			throw new Error("context menu state is unavailable");
		}
		return state;
	}

	return {
		ContextMenu: ({ children }: { children: ReactNode }) => {
			const [open, setOpen] = React.useState(false);

			return (
				<ContextMenuStateContext.Provider value={{ open, setOpen }}>
					{children}
				</ContextMenuStateContext.Provider>
			);
		},
		ContextMenuTrigger: ({
			children,
			asChild,
		}: {
			children: React.ReactElement;
			asChild?: boolean;
		}) => {
			const { setOpen } = useContextMenuState();

			if (asChild && React.isValidElement(children)) {
				return React.cloneElement(children, {
					onContextMenu: (event: MouseEvent) => {
						event.preventDefault();
						children.props.onContextMenu?.(event);
						setOpen(true);
					},
				});
			}

			return <div onContextMenu={() => setOpen(true)}>{children}</div>;
		},
		ContextMenuContent: ({ children }: { children: ReactNode }) => {
			const { open } = useContextMenuState();
			return open
				? ReactDOM.createPortal(<div role="menu">{children}</div>, document.body)
				: null;
		},
		ContextMenuItem: ({
			children,
			asChild,
			onSelect,
			disabled,
		}: {
			children: ReactNode;
			asChild?: boolean;
			onSelect?: (event: { preventDefault(): void }) => void;
			disabled?: boolean;
		}) => {
			const { setOpen } = useContextMenuState();

			if (asChild && React.isValidElement(children)) {
				return React.cloneElement(children, {
					onClick: (event: MouseEvent) => {
						children.props.onClick?.(event);
						setOpen(false);
					},
				});
			}

			return (
				<button
					type="button"
					disabled={disabled}
					onClick={() => {
						onSelect?.({
							preventDefault() {},
						});
						setOpen(false);
					}}
				>
					{children}
				</button>
			);
		},
		ContextMenuLabel: ({ children }: { children: ReactNode }) => (
			<div>{children}</div>
		),
		ContextMenuSeparator: () => <hr />,
	};
});

vi.mock("@/components/loading-skeletons", () => ({
	CardSectionSkeleton: () => <div>loading</div>,
}));

vi.mock("@/components/responsive-data-view", () => ({
	ResponsiveDataView: ({ desktop }: { desktop: ReactNode }) => <>{desktop}</>,
}));

vi.mock("@/context/app-context", () => ({
	useApp: () => ({
		organization: {
			slug: "acme",
			preCancellationDelinquencyThreshold: null,
		},
	}),
}));

vi.mock("@/hooks/sales", () => ({
	useDeleteSale: () => ({
		mutateAsync: mocks.deleteSaleMock,
		isPending: false,
	}),
	useDeleteSalesBulk: () => ({
		mutateAsync: mocks.deleteSalesBulkMock,
		isPending: false,
	}),
	usePatchSaleStatus: () => ({
		mutateAsync: mocks.patchSaleStatusMock,
		isPending: false,
	}),
	usePatchSalesStatusBulk: () => ({
		mutateAsync: mocks.patchSalesStatusBulkMock,
		isPending: false,
	}),
}));

vi.mock("@/hooks/sales/use-sale-navigation", () => ({
	persistSaleNavigationContext: mocks.persistSaleNavigationContextMock,
}));

vi.mock("@/http/generated", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/http/generated")>();

	return {
		...actual,
		useGetOrganizationsSlugCompanies: () => ({
			data: {
				companies: [],
			},
		}),
		useGetOrganizationsSlugProducts: () => ({
			data: {
				products: [],
			},
		}),
	};
});

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

type SaleRow = ComponentProps<typeof SalesDataTable>["sales"][number];

const salesFixture = [
	{
		id: "sale-1",
		saleDate: "2026-05-01T00:00:00.000Z",
		createdAt: "2026-05-01T10:00:00.000Z",
		updatedAt: "2026-05-02T10:00:00.000Z",
		status: "PENDING",
		totalAmount: 150000,
		notes: "Primeira venda",
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
			name: "Empresa XPTO",
		},
		unit: {
			id: "unit-1",
			name: "Unidade Centro",
		},
		responsible: {
			id: "seller-1",
			name: "João",
			type: "SELLER",
		},
		commissionInstallmentsSummary: {
			total: 3,
			paid: 1,
		},
		delinquencySummary: {
			hasOpen: false,
		},
	} as SaleRow,
];

describe("sales data table context menu", () => {
	beforeEach(() => {
		mocks.canMock.mockReset();
		mocks.deleteSaleMock.mockReset();
		mocks.deleteSalesBulkMock.mockReset();
		mocks.patchSaleStatusMock.mockReset();
		mocks.patchSalesStatusBulkMock.mockReset();
		mocks.persistSaleNavigationContextMock.mockReset();

		mocks.deleteSaleMock.mockResolvedValue(undefined);
		mocks.deleteSalesBulkMock.mockResolvedValue(undefined);
		mocks.patchSaleStatusMock.mockResolvedValue(undefined);
		mocks.patchSalesStatusBulkMock.mockResolvedValue(undefined);
		mocks.canMock.mockReturnValue(true);
	});

	it("should show the same row actions in the context menu and the ellipsis menu", async () => {
		const user = userEvent.setup();
		render(
			<SalesDataTable
				sales={salesFixture}
				isLoading={false}
				isError={false}
				showFilters={false}
				onRetry={vi.fn()}
			/>,
		);

		const row = screen.getByText("Maria Silva").closest("tr");
		expect(row).not.toBeNull();

		fireEvent.contextMenu(row!);

		for (const label of [
			"Ver detalhes",
			"Editar",
			"Duplicar",
			"Ver parcelas",
			"Concluir venda",
			"Alterar status",
			"Excluir",
		]) {
			expect(await screen.findByText(label)).toBeInTheDocument();
		}

		fireEvent.keyDown(document, { key: "Escape" });

		await user.click(
			screen.getByRole("button", {
				name: "Ações da venda de Maria Silva",
			}),
		);

		const dropdownMenu = screen.getByRole("menu");

		for (const label of [
			"Ver detalhes",
			"Editar",
			"Duplicar",
			"Ver parcelas",
			"Concluir venda",
			"Alterar status",
			"Excluir",
		]) {
			expect(within(dropdownMenu).getByText(label)).toBeInTheDocument();
		}
	});

	it("should allow navigation and local actions from the row context menu", async () => {
		const user = userEvent.setup();
		render(
			<SalesDataTable
				sales={salesFixture}
				isLoading={false}
				isError={false}
				showFilters={false}
				onRetry={vi.fn()}
			/>,
		);

		const row = screen.getByText("Maria Silva").closest("tr");
		expect(row).not.toBeNull();

		fireEvent.contextMenu(row!);
		await user.click(await screen.findByText("Ver detalhes"));

		expect(mocks.persistSaleNavigationContextMock).toHaveBeenCalledWith([
			"sale-1",
		]);

		fireEvent.contextMenu(row!);
		await user.click(await screen.findByText("Concluir venda"));

		expect(mocks.patchSaleStatusMock).toHaveBeenCalledWith({
			saleId: "sale-1",
			status: "COMPLETED",
		});
	});

	it("should keep completed sales without status change action in the list context menu", async () => {
		const user = userEvent.setup();
		render(
			<SalesDataTable
				sales={[
					{
						...salesFixture[0],
						status: "COMPLETED",
					},
				]}
				isLoading={false}
				isError={false}
				showFilters={false}
				onRetry={vi.fn()}
			/>,
		);

		await user.click(
			screen.getByRole("button", {
				name: "Ações da venda de Maria Silva",
			}),
		);

		expect(screen.queryByText("Alterar status")).not.toBeInTheDocument();
		expect(screen.queryByText("Concluir venda")).not.toBeInTheDocument();
		expect(screen.getByText("Sem transição de status")).toBeInTheDocument();
	});
});
