import { deleteOrganizationsSlugTransactionsTransactionid } from "../generated";

export async function deleteTransaction(transactionId: string) {
	const slug = "behenck";
	await deleteOrganizationsSlugTransactionsTransactionid(slug, transactionId);
}
