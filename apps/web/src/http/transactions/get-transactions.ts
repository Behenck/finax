import {
	getOrganizationsSlugTransactions,
	type GetOrganizationsSlugTransactions200,
} from "../generated";

export async function getTransactions(): Promise<
	GetOrganizationsSlugTransactions200["transactions"]
> {
	const slug = "behenck";
	const data = await getOrganizationsSlugTransactions(slug);

	return data.transactions;
}
