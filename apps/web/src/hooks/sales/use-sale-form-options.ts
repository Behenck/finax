import { useMemo } from "react";
import { useApp } from "@/context/app-context";
import {
	useGetOrganizationsSlugCompanies,
	useGetOrganizationsSlugCustomers,
	useGetOrganizationsSlugMembersRole,
	useGetOrganizationsSlugPartners,
	useGetOrganizationsSlugProducts,
	useGetOrganizationsSlugSellers,
} from "@/http/generated";
import { isAxiosError } from "@/lib/axios";
import { useAbility } from "@/permissions/access";
import { getPartnerDisplayName } from "@/utils/partner-display";

export interface SaleProductOption {
	id: string;
	name: string;
	path: string[];
	label: string;
}

export interface SaleHierarchicalProductOption extends SaleProductOption {
	rootId: string;
	rootName: string;
	depth: number;
	relativeLabel: string;
	fullLabel: string;
}

export interface SaleRootProductOption {
	id: string;
	name: string;
	label: string;
}

export interface SalePartnerOption {
	id: string;
	name: string;
	status: "ACTIVE" | "INACTIVE";
	supervisors: Array<{
		id: string;
		userId: string;
		name: string;
	}>;
}

export interface SaleSupervisorOption {
	id: string;
	userId: string;
	name: string;
}

type ProductTreeNode = {
	id: string;
	name: string;
	parentId: string | null;
	isActive: boolean;
	children?: ProductTreeNode[];
};

function flattenActiveProductOptions(
	nodes: ProductTreeNode[],
	parentPath: string[] = [],
	rootNode?: Pick<ProductTreeNode, "id" | "name">,
): SaleHierarchicalProductOption[] {
	return nodes.flatMap((node) => {
		const currentPath = [...parentPath, node.name];
		const children = Array.isArray(node.children) ? node.children : [];
		const resolvedRootNode = rootNode ?? {
			id: node.id,
			name: node.name,
		};
		const depth = currentPath.length - 1;
		const fullLabel = currentPath.join(" -> ");
		const relativeLabel =
			depth === 0 ? node.name : currentPath.slice(1).join(" -> ");

		const currentNodeOptions = node.isActive
			? [
					{
						id: node.id,
						name: node.name,
						path: currentPath,
						label: fullLabel,
						rootId: resolvedRootNode.id,
						rootName: resolvedRootNode.name,
						depth,
						relativeLabel,
						fullLabel,
					},
				]
			: [];

		return [
			...currentNodeOptions,
			...flattenActiveProductOptions(children, currentPath, resolvedRootNode),
		];
	});
}

export function useSaleFormOptions() {
	const { organization } = useApp();
	const ability = useAbility();
	const slug = organization?.slug ?? "";
	const enabled = Boolean(organization?.slug);
	const canViewCompanies = ability.can("access", "registers.companies.view");
	const canViewCustomers = ability.can("access", "registers.customers.view");
	const canViewProducts = ability.can("access", "registers.products.view");
	const canViewSales = ability.can("access", "sales.view");
	const canCreateSales = ability.can("access", "sales.create");
	const canUpdateSales = ability.can("access", "sales.update");
	const canReadCompaniesForSales =
		canViewCompanies || canViewSales || canCreateSales || canUpdateSales;
	const canReadProductsForSales =
		canViewProducts || canViewSales || canCreateSales || canUpdateSales;
	const canViewSellers = ability.can("access", "registers.sellers.view");
	const canViewPartners = ability.can("access", "registers.partners.view");
	const canViewSupervisors = ability.can("access", "settings.members.view");
	const canReadPartnersForSales =
		canViewPartners || canViewSales || canCreateSales || canUpdateSales;

	const companiesQuery = useGetOrganizationsSlugCompanies(
		{ slug },
		{
			query: { enabled: enabled && canReadCompaniesForSales },
		},
	);
	const customersQuery = useGetOrganizationsSlugCustomers(
		{ slug },
		{
			query: { enabled: enabled && canViewCustomers },
		},
	);
	const productsQuery = useGetOrganizationsSlugProducts(
		{ slug },
		{
			query: { enabled: enabled && canReadProductsForSales },
		},
	);
	const sellersQuery = useGetOrganizationsSlugSellers(
		{ slug },
		{
			query: { enabled: enabled && canViewSellers },
		},
	);
	const partnersQuery = useGetOrganizationsSlugPartners(
		{ slug },
		{
			query: { enabled: enabled && canReadPartnersForSales },
		},
	);
	const supervisorsQuery = useGetOrganizationsSlugMembersRole(
		{
			slug,
			role: "SUPERVISOR",
		},
		{
			query: { enabled: enabled && canViewSupervisors },
		},
	);

	const companies = useMemo(
		() => companiesQuery.data?.companies ?? [],
		[companiesQuery.data?.companies],
	);
	const customers = useMemo(
		() =>
			(customersQuery.data?.customers ?? []).filter(
				(customer) => customer.status === "ACTIVE",
			),
		[customersQuery.data?.customers],
	);
	const hierarchicalProducts = useMemo(
		() =>
			flattenActiveProductOptions(
				(productsQuery.data?.products ?? []) as ProductTreeNode[],
			),
		[productsQuery.data?.products],
	);
	const products = hierarchicalProducts;
	const rootProducts = useMemo<SaleRootProductOption[]>(
		() =>
			hierarchicalProducts
				.filter((product) => product.depth === 0)
				.map((product) => ({
					id: product.id,
					name: product.name,
					label: product.name,
				})),
		[hierarchicalProducts],
	);
	const sellers = useMemo(
		() =>
			(sellersQuery.data?.sellers ?? []).filter(
				(seller) => seller.status === "ACTIVE",
			),
		[sellersQuery.data?.sellers],
	);
	const partnersWithStatus = useMemo<SalePartnerOption[]>(
		() =>
			(partnersQuery.data?.partners ?? []).map((partner) => ({
				id: partner.id,
				name: getPartnerDisplayName(partner),
				status: partner.status as "ACTIVE" | "INACTIVE",
				supervisors:
					(
						partner.supervisors as
							| Array<{
									id: string;
									name: string | null;
							  }>
							| undefined
					)?.map((supervisor) => ({
						id: supervisor.id,
						userId: supervisor.id,
						name: supervisor.name ?? "Supervisor",
					})) ?? [],
			})),
		[partnersQuery.data?.partners],
	);
	const partners = useMemo(
		() => partnersWithStatus.filter((partner) => partner.status === "ACTIVE"),
		[partnersWithStatus],
	);
	const supervisors = useMemo<SaleSupervisorOption[]>(
		() =>
			(supervisorsQuery.data?.members ?? []).map((member) => ({
				id: member.id,
				userId: member.userId,
				name: member.name ?? member.email,
			})),
		[supervisorsQuery.data?.members],
	);

	const queries = [
		{
			query: companiesQuery,
			enabled: enabled && canReadCompaniesForSales,
		},
		{
			query: customersQuery,
			enabled: enabled && canViewCustomers,
		},
		{
			query: productsQuery,
			enabled: enabled && canReadProductsForSales,
		},
		{
			query: sellersQuery,
			enabled: enabled && canViewSellers,
		},
		{
			query: partnersQuery,
			enabled: enabled && canReadPartnersForSales,
		},
		{
			query: supervisorsQuery,
			enabled: enabled && canViewSupervisors,
		},
	];

	return {
		companies,
		customers,
		products,
		hierarchicalProducts,
		rootProducts,
		sellers,
		partners,
		partnersWithStatus,
		supervisors,
		isLoading: queries.some(({ query, enabled: isEnabled }) => {
			if (!isEnabled) {
				return false;
			}

			return query.isLoading;
		}),
		isError: queries.some(({ query, enabled: isEnabled }) => {
			if (!isEnabled || !query.isError) {
				return false;
			}

			return !isAxiosError(query.error) || query.error.response?.status !== 403;
		}),
		refetch: async () => {
			await Promise.all(
				queries
					.filter(({ enabled: isEnabled }) => isEnabled)
					.map(({ query }) => query.refetch()),
			);
		},
	};
}
