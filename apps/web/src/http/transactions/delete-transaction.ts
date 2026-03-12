import { deleteOrganizationsSlugTransactionsTransactionid } from "../generated";

export async function deleteTransaction(params: {
	slug: string;
	transactionId: string;
}) {
	await deleteOrganizationsSlugTransactionsTransactionid({
		slug: params.slug,
		transactionId: params.transactionId,
	});
}
