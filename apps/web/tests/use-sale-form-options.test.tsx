import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSaleFormOptions } from "../src/hooks/sales/use-sale-form-options";

const mocks = vi.hoisted(() => ({
	companiesQuery: vi.fn(),
	customersQuery: vi.fn(),
	productsQuery: vi.fn(),
	sellersQuery: vi.fn(),
	partnersQuery: vi.fn(),
	supervisorsQuery: vi.fn(),
	can: vi.fn(),
}));

vi.mock("@/context/app-context", () => ({
	useApp: () => ({
		organization: {
			slug: "org-teste",
		},
	}),
}));

vi.mock("@/permissions/access", () => ({
	useAbility: () => ({
		can: mocks.can,
	}),
}));

vi.mock("@/http/generated", () => ({
	useGetOrganizationsSlugCompanies: (...args: unknown[]) =>
		mocks.companiesQuery(...args),
	useGetOrganizationsSlugCustomers: (...args: unknown[]) =>
		mocks.customersQuery(...args),
	useGetOrganizationsSlugProducts: (...args: unknown[]) =>
		mocks.productsQuery(...args),
	useGetOrganizationsSlugSellers: (...args: unknown[]) =>
		mocks.sellersQuery(...args),
	useGetOrganizationsSlugPartners: (...args: unknown[]) =>
		mocks.partnersQuery(...args),
	useGetOrganizationsSlugMembersRole: (...args: unknown[]) =>
		mocks.supervisorsQuery(...args),
}));

function createIdleQuery<TData>(data: TData) {
	return {
		data,
		isLoading: false,
		isFetching: false,
		isError: false,
		error: null,
		refetch: vi.fn(),
	};
}

describe("useSaleFormOptions", () => {
	beforeEach(() => {
		mocks.companiesQuery.mockReset();
		mocks.customersQuery.mockReset();
		mocks.productsQuery.mockReset();
		mocks.sellersQuery.mockReset();
		mocks.partnersQuery.mockReset();
		mocks.supervisorsQuery.mockReset();
		mocks.can.mockReset();

		mocks.can.mockImplementation(
			(_action: string, permissionKey: string) =>
				permissionKey === "sales.create",
		);

		mocks.companiesQuery.mockReturnValue(createIdleQuery({ companies: [] }));
		mocks.customersQuery.mockReturnValue(createIdleQuery({ customers: [] }));
		mocks.productsQuery.mockReturnValue(createIdleQuery({ products: [] }));
		mocks.sellersQuery.mockReturnValue(createIdleQuery({ sellers: [] }));
		mocks.partnersQuery.mockReturnValue(
			createIdleQuery({
				partners: [
					{
						id: "partner-1",
						name: "Parceiro 1",
						companyName: null,
						status: "ACTIVE",
						supervisors: [],
					},
					{
						id: "partner-2",
						name: "Parceiro 2",
						companyName: null,
						status: "INACTIVE",
						supervisors: [],
					},
				],
			}),
		);
		mocks.supervisorsQuery.mockReturnValue(createIdleQuery({ members: [] }));
	});

	it("loads partners for sales even without registers.partners.view permission", () => {
		const { result } = renderHook(() => useSaleFormOptions());

		expect(mocks.partnersQuery).toHaveBeenCalledWith(
			{ slug: "org-teste" },
			expect.objectContaining({
				query: expect.objectContaining({
					enabled: true,
				}),
			}),
		);
		expect(result.current.partners).toEqual([
			{
				id: "partner-1",
				name: "Parceiro 1",
				status: "ACTIVE",
				supervisors: [],
			},
		]);
	});
});
