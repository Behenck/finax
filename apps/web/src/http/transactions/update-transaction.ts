import {
	putOrganizationsSlugTransactionsTransactionid,
	type PutOrganizationsSlugTransactionsTransactionidMutationRequest,
} from "../generated";

interface UpdateTransactionRequest {
	transactionId: string;
	data: PutOrganizationsSlugTransactionsTransactionidMutationRequest;
}

export async function updateTransaction({ transactionId, data }: UpdateTransactionRequest) {
	const slug = "behenck";

	await putOrganizationsSlugTransactionsTransactionid(transactionId, slug, data);
}
