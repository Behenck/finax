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

export interface SaleProductOption {
	id: string;
	name: string;
	path: string[];
	label: string;
}

type ProductTreeNode = {
	id: string;
	name: string;
	isActive: boolean;
	children?: ProductTreeNode[];
};

function flattenActiveProductOptions(
	nodes: ProductTreeNode[],
	parentPath: string[] = [],
): SaleProductOption[] {
	return nodes.flatMap((node) => {
		const currentPath = [...parentPath, node.name];
		const children = Array.isArray(node.children) ? node.children : [];

		const currentNodeOptions = node.isActive
			? [
					{
						id: node.id,
						name: node.name,
						path: currentPath,
						label: currentPath.join(" -> "),
					},
				]
			: [];

		return [
			...currentNodeOptions,
			...flattenActiveProductOptions(children, currentPath),
		];
	});
}

export function useSaleFormOptions() {
	const { organization } = useApp();
	const slug = organization?.slug ?? "";
	const enabled = Boolean(organization?.slug);

	const companiesQuery = useGetOrganizationsSlugCompanies(
		{ slug },
		{
			query: { enabled },
		},
	);
	const customersQuery = useGetOrganizationsSlugCustomers(
		{ slug },
		{
			query: { enabled },
		},
	);
	const productsQuery = useGetOrganizationsSlugProducts(
		{ slug },
		{
			query: { enabled },
		},
	);
	const sellersQuery = useGetOrganizationsSlugSellers(
		{ slug },
		{
			query: { enabled },
		},
	);
	const partnersQuery = useGetOrganizationsSlugPartners(
		{ slug },
		{
			query: { enabled },
		},
	);
	const supervisorsQuery = useGetOrganizationsSlugMembersRole(
		{
			slug,
			role: "SUPERVISOR",
		},
		{
			query: { enabled },
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
	const baseProducts = useMemo(
		() =>
			flattenActiveProductOptions(
				(productsQuery.data?.products ?? []) as ProductTreeNode[],
			),
		[productsQuery.data?.products],
	);
	const products = baseProducts;
	const sellers = useMemo(
		() =>
			(sellersQuery.data?.sellers ?? []).filter(
				(seller) => seller.status === "ACTIVE",
			),
		[sellersQuery.data?.sellers],
	);
	const partners = useMemo(
		() =>
			(partnersQuery.data?.partners ?? []).filter(
				(partner) => partner.status === "ACTIVE",
			),
		[partnersQuery.data?.partners],
	);
	const supervisors = useMemo(
		() =>
			(supervisorsQuery.data?.members ?? []).map((member) => ({
				id: member.id,
				name: member.name ?? member.email,
			})),
		[supervisorsQuery.data?.members],
	);

	const queries = [
		companiesQuery,
		customersQuery,
		productsQuery,
		sellersQuery,
		partnersQuery,
		supervisorsQuery,
	];

	return {
		companies,
		customers,
		products,
		sellers,
		partners,
		supervisors,
		isLoading: queries.some((query) => query.isLoading),
		isError: queries.some((query) => query.isError),
		refetch: async () => {
			await Promise.all(queries.map((query) => query.refetch()));
		},
	};
}
