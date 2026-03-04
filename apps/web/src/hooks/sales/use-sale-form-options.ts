import { useApp } from "@/context/app-context";
import {
	getOrganizationsSlugProductsIdCommissionScenariosQueryOptions,
	type GetOrganizationsSlugProductsIdCommissionScenariosQueryResponse,
	useGetOrganizationsSlugCompanies,
	useGetOrganizationsSlugCustomers,
	useGetOrganizationsSlugPartners,
	useGetOrganizationsSlugProducts,
	useGetOrganizationsSlugSellers,
} from "@/http/generated";
import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";

export interface SaleProductOption {
	id: string;
	name: string;
	path: string[];
	label: string;
	commissionPercentage?: number;
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

function resolveHighestCommissionPercentage(
	scenarios?: GetOrganizationsSlugProductsIdCommissionScenariosQueryResponse["scenarios"],
) {
	const percentages =
		scenarios?.flatMap((scenario) =>
			scenario.commissions
				.map((commission) => commission.totalPercentage)
				.filter((percentage) => Number.isFinite(percentage) && percentage > 0),
		) ?? [];

	if (percentages.length === 0) {
		return undefined;
	}

	return Math.max(...percentages);
}

const percentageFormatter = new Intl.NumberFormat("pt-BR", {
	maximumFractionDigits: 2,
});

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
				((productsQuery.data?.products ?? []) as ProductTreeNode[]),
			),
		[productsQuery.data?.products],
	);
	const productCommissionQueries = useQueries({
		queries: baseProducts.map((product) =>
			getOrganizationsSlugProductsIdCommissionScenariosQueryOptions({
				slug,
				id: product.id,
			}),
		),
	});
	const products = useMemo(() => {
		const percentageByProductId = new Map<string, number>();

		for (const [index, query] of productCommissionQueries.entries()) {
			const product = baseProducts[index];
			if (!product) {
				continue;
			}

			const percentage = resolveHighestCommissionPercentage(
				query.data?.scenarios,
			);
			if (percentage === undefined) {
				continue;
			}

			percentageByProductId.set(product.id, percentage);
		}

		return baseProducts.map((product) => {
			const commissionPercentage = percentageByProductId.get(product.id);

			if (commissionPercentage === undefined) {
				return product;
			}

			return {
				...product,
				commissionPercentage,
				label: `${product.label} -> ${percentageFormatter.format(commissionPercentage)}%`,
			};
		});
	}, [baseProducts, productCommissionQueries]);
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

	const queries = [
		companiesQuery,
		customersQuery,
		productsQuery,
		sellersQuery,
		partnersQuery,
	];

	return {
		companies,
		customers,
		products,
		sellers,
		partners,
		isLoading: queries.some((query) => query.isLoading),
		isError: queries.some((query) => query.isError),
		refetch: async () => {
			await Promise.all(queries.map((query) => query.refetch()));
		},
	};
}
