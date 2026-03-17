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
			...flattenActiveProductOptions(
				children,
				currentPath,
				resolvedRootNode,
			),
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
		hierarchicalProducts,
		rootProducts,
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
