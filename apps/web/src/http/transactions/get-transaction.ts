import {
	getOrganizationsSlugTransactionsTransactionid,
	type GetOrganizationsSlugTransactionsTransactionid200,
} from "../generated";

export async function getTransaction(
	transactionId: string
): Promise<GetOrganizationsSlugTransactionsTransactionid200["transaction"]> {
	const slug = "behenck";

	const data = await getOrganizationsSlugTransactionsTransactionid({
		slug,
		transactionId,
	});

	return data.transaction;
}
