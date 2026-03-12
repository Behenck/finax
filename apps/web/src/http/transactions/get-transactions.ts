import {
	getOrganizationsSlugTransactions,
	type GetOrganizationsSlugTransactions200,
	type GetOrganizationsSlugTransactionsQueryParams,
} from "../generated";

export async function getTransactions(params: {
	slug: string;
	filters?: GetOrganizationsSlugTransactionsQueryParams;
}): Promise<GetOrganizationsSlugTransactions200> {
	const data = await getOrganizationsSlugTransactions({
		slug: params.slug,
		params: params.filters,
	});

	return data;
}
