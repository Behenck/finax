import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SalesPage } from "../src/pages/_app/sales/index";

const mocks = vi.hoisted(() => {
	const queryDefaults: Record<string, unknown> = {
		q: "",
		companyId: "",
		unitId: "",
		status: "ALL",
		responsibleType: "ALL",
		responsibleId: "",
		page: 1,
	};
	const queryValues = new Map<string, unknown>(Object.entries(queryDefaults));

	const useSalesMock = vi.fn();
	const canMock = vi.fn();
	const useGetOrganizationsSlugCompaniesMock = vi.fn();
	const useGetOrganizationsSlugProductsMock = vi.fn();
	const useGetOrganizationsSlugSellersMock = vi.fn();
	const useGetOrganizationsSlugPartnersMock = vi.fn();
	const getOrganizationsSlugSalesSaleidQueryOptionsMock = vi.fn();
	const useDeleteSaleMock = vi.fn();
	const useDeleteSalesBulkMock = vi.fn();
	const usePatchSalesStatusBulkMock = vi.fn();
	const usePatchSaleStatusMock = vi.fn();
	const useQueriesMock = vi.fn();

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
		useSalesMock,
		canMock,
		useGetOrganizationsSlugCompaniesMock,
		useGetOrganizationsSlugProductsMock,
		useGetOrganizationsSlugSellersMock,
		useGetOrganizationsSlugPartnersMock,
		getOrganizationsSlugSalesSaleidQueryOptionsMock,
		useDeleteSaleMock,
		useDeleteSalesBulkMock,
		usePatchSalesStatusBulkMock,
		usePatchSaleStatusMock,
		useQueriesMock,
	};
});

vi.mock("@tanstack/react-router", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@tanstack/react-router")>();

	return {
		...actual,
		createFileRoute: () => (options: unknown) => options,
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
		SelectTrigger: ({
			children,
			"aria-label": ariaLabel,
		}: {
			children: ReactNode;
			"aria-label"?: string;
		}) => (
			<button type="button" role="combobox" aria-label={ariaLabel}>
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

vi.mock("@tanstack/react-query", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@tanstack/react-query")>();

	return {
		...actual,
		useQueries: (...args: unknown[]) => mocks.useQueriesMock(...args),
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

vi.mock("@/hooks/sales", () => ({
	useSales: () => mocks.useSalesMock(),
	useDeleteSale: () => mocks.useDeleteSaleMock(),
	useDeleteSalesBulk: () => mocks.useDeleteSalesBulkMock(),
	usePatchSalesStatusBulk: () => mocks.usePatchSalesStatusBulkMock(),
	usePatchSaleStatus: () => mocks.usePatchSaleStatusMock(),
}));

vi.mock("@/http/generated", () => ({
	useGetOrganizationsSlugCompanies: (...args: unknown[]) =>
		mocks.useGetOrganizationsSlugCompaniesMock(...args),
	useGetOrganizationsSlugProducts: (...args: unknown[]) =>
		mocks.useGetOrganizationsSlugProductsMock(...args),
	useGetOrganizationsSlugSellers: (...args: unknown[]) =>
		mocks.useGetOrganizationsSlugSellersMock(...args),
	useGetOrganizationsSlugPartners: (...args: unknown[]) =>
		mocks.useGetOrganizationsSlugPartnersMock(...args),
	getOrganizationsSlugSalesSaleidQueryOptions: (...args: unknown[]) =>
		mocks.getOrganizationsSlugSalesSaleidQueryOptionsMock(...args),
}));

function buildSales() {
	return [
		{
			id: "sale-seller",
			saleDate: "2026-04-10T00:00:00.000Z",
			totalAmount: 150000,
			status: "COMPLETED" as const,
			notes: null,
			createdAt: "2026-04-10T00:00:00.000Z",
			updatedAt: "2026-04-10T00:00:00.000Z",
			customer: {
				id: "customer-seller",
				name: "Cliente Vendedor",
			},
			product: {
				id: "product-seller",
				name: "Seguro Auto",
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
			responsible: {
				type: "SELLER" as const,
				id: "seller-1",
				name: "Bruno Vendedor",
			},
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
			id: "sale-partner",
			saleDate: "2026-04-11T00:00:00.000Z",
			totalAmount: 98000,
			status: "COMPLETED" as const,
			notes: null,
			createdAt: "2026-04-11T00:00:00.000Z",
			updatedAt: "2026-04-11T00:00:00.000Z",
			customer: {
				id: "customer-partner",
				name: "Cliente Parceiro",
			},
			product: {
				id: "product-partner",
				name: "Seguro Vida",
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
			responsible: {
				type: "PARTNER" as const,
				id: "partner-1",
				name: "Paula Parceira",
			},
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
			id: "sale-no-responsible",
			saleDate: "2026-04-12T00:00:00.000Z",
			totalAmount: 50000,
			status: "PENDING" as const,
			notes: null,
			createdAt: "2026-04-12T00:00:00.000Z",
			updatedAt: "2026-04-12T00:00:00.000Z",
			customer: {
				id: "customer-no-responsible",
				name: "Cliente Sem Responsável",
			},
			product: {
				id: "product-no-responsible",
				name: "Seguro Residencial",
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
				id: "user-3",
				name: "Usuário 3",
				avatarUrl: null,
			},
			responsible: null,
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
}

describe("sales filters panel", () => {
	beforeEach(() => {
		window.localStorage.clear();
		mocks.resetQueryValues();
		mocks.useSalesMock.mockReset();
		mocks.canMock.mockReset();
		mocks.useGetOrganizationsSlugCompaniesMock.mockReset();
		mocks.useGetOrganizationsSlugProductsMock.mockReset();
		mocks.useGetOrganizationsSlugSellersMock.mockReset();
		mocks.useGetOrganizationsSlugPartnersMock.mockReset();
		mocks.getOrganizationsSlugSalesSaleidQueryOptionsMock.mockReset();
		mocks.useDeleteSaleMock.mockReset();
		mocks.useDeleteSalesBulkMock.mockReset();
		mocks.usePatchSalesStatusBulkMock.mockReset();
		mocks.usePatchSaleStatusMock.mockReset();
		mocks.useQueriesMock.mockReset();

		mocks.useSalesMock.mockReturnValue({
			data: { sales: buildSales() },
			isLoading: false,
			isError: false,
			refetch: vi.fn(),
		});
		mocks.canMock.mockReturnValue(true);
		mocks.useGetOrganizationsSlugCompaniesMock.mockReturnValue({
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
		});
		mocks.useGetOrganizationsSlugProductsMock.mockReturnValue({
			data: {
				products: [
					{
						id: "product-seller",
						name: "Seguro Auto",
						children: [],
					},
					{
						id: "product-partner",
						name: "Seguro Vida",
						children: [],
					},
					{
						id: "product-no-responsible",
						name: "Seguro Residencial",
						children: [],
					},
				],
			},
		});
		mocks.useGetOrganizationsSlugSellersMock.mockReturnValue({
			data: { sellers: [] },
		});
		mocks.useGetOrganizationsSlugPartnersMock.mockReturnValue({
			data: { partners: [] },
		});
		mocks.getOrganizationsSlugSalesSaleidQueryOptionsMock.mockImplementation(
			({ saleId }: { saleId: string }) => ({
				queryKey: ["sale", saleId],
				queryFn: vi.fn(),
			}),
		);
		mocks.useDeleteSaleMock.mockReturnValue({
			mutateAsync: vi.fn(),
			isPending: false,
		});
		mocks.useDeleteSalesBulkMock.mockReturnValue({
			mutateAsync: vi.fn(),
			isPending: false,
		});
		mocks.usePatchSalesStatusBulkMock.mockReturnValue({
			mutateAsync: vi.fn(),
			isPending: false,
		});
		mocks.usePatchSaleStatusMock.mockReturnValue({
			mutateAsync: vi.fn(),
			isPending: false,
		});
		mocks.useQueriesMock.mockImplementation(
			({ queries }: { queries: unknown[] }) => queries.map(() => ({})),
		);
	});

	it("should keep filters hidden by default and show them after clicking Filtro", async () => {
		const user = userEvent.setup();
		render(<SalesPage />);

		expect(screen.getByRole("link", { name: "Inadimplência" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Filtro" })).toBeInTheDocument();
		expect(screen.queryByText("Tipo de responsável")).not.toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: "Filtro" }));

		expect(screen.getByText("Tipo de responsável")).toBeInTheDocument();
	});

	it("should open filters automatically when there are active filters in localStorage", async () => {
		window.localStorage.setItem(
			"finax:sales:list:filters",
			JSON.stringify({
				status: "COMPLETED",
			}),
		);

		render(<SalesPage />);

		await waitFor(() => {
			expect(screen.getByText("Tipo de responsável")).toBeInTheDocument();
		});
	});

	it("should filter by seller and by specific seller using only sales list options", async () => {
		const user = userEvent.setup();
		render(<SalesPage />);
		await user.click(screen.getByRole("button", { name: "Filtro" }));

		await user.click(screen.getAllByRole("option", { name: "Vendedor" })[0]!);

		expect(screen.getByRole("combobox", { name: "Vendedor" })).toBeInTheDocument();

		await user.click(screen.getAllByRole("option", { name: "Bruno Vendedor" })[0]!);

		expect(screen.getAllByText("Cliente Vendedor").length).toBeGreaterThan(0);
		expect(screen.queryByText("Cliente Parceiro")).not.toBeInTheDocument();
		expect(screen.queryByText("Cliente Sem Responsável")).not.toBeInTheDocument();
		expect(mocks.useGetOrganizationsSlugSellersMock).not.toHaveBeenCalled();
		expect(mocks.useGetOrganizationsSlugPartnersMock).not.toHaveBeenCalled();
	});

	it("should filter by partner and clear responsible selection when changing type", async () => {
		const user = userEvent.setup();
		render(<SalesPage />);
		await user.click(screen.getByRole("button", { name: "Filtro" }));

		await user.click(screen.getAllByRole("option", { name: "Vendedor" })[0]!);
		await user.click(screen.getAllByRole("option", { name: "Bruno Vendedor" })[0]!);

		expect(screen.getAllByText("Cliente Vendedor").length).toBeGreaterThan(0);
		expect(screen.queryByText("Cliente Parceiro")).not.toBeInTheDocument();

		await user.click(screen.getAllByRole("option", { name: "Parceiro" })[0]!);

		expect(screen.getByRole("combobox", { name: "Parceiro" })).toBeInTheDocument();
		expect(screen.getAllByText("Cliente Parceiro").length).toBeGreaterThan(0);
		expect(screen.queryByText("Cliente Vendedor")).not.toBeInTheDocument();
	});

	it("should reset responsible filters when clearing filters", async () => {
		const user = userEvent.setup();
		render(<SalesPage />);
		await user.click(screen.getByRole("button", { name: "Filtro" }));

		await user.click(screen.getAllByRole("option", { name: "Parceiro" })[0]!);
		await user.click(screen.getAllByRole("option", { name: "Paula Parceira" })[0]!);

		expect(screen.getAllByText("Cliente Parceiro").length).toBeGreaterThan(0);
		expect(screen.queryByText("Cliente Vendedor")).not.toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: "Limpar" }));

		expect(screen.queryByRole("combobox", { name: "Parceiro" })).not.toBeInTheDocument();
		expect(screen.queryByRole("combobox", { name: "Vendedor" })).not.toBeInTheDocument();
		expect(screen.getAllByText("Cliente Vendedor").length).toBeGreaterThan(0);
		expect(screen.getAllByText("Cliente Parceiro").length).toBeGreaterThan(0);
		expect(screen.getAllByText("Cliente Sem Responsável").length).toBeGreaterThan(0);
	});
});
