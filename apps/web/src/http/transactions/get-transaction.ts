import {
	getOrganizationsSlugTransactionsTransactionid,
	type GetOrganizationsSlugTransactionsTransactionid200,
} from "../generated";

export async function getTransaction(
	params: {
		slug: string;
		transactionId: string;
	},
): Promise<GetOrganizationsSlugTransactionsTransactionid200["transaction"]> {
	const data = await getOrganizationsSlugTransactionsTransactionid({
		slug: params.slug,
		transactionId: params.transactionId,
	});

	return data.transaction;
}
