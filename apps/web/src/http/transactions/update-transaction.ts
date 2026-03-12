import {
	putOrganizationsSlugTransactionsTransactionid,
	type PutOrganizationsSlugTransactionsTransactionidMutationRequest,
} from "../generated";

interface UpdateTransactionRequest {
	slug: string;
	transactionId: string;
	data: PutOrganizationsSlugTransactionsTransactionidMutationRequest;
}

export async function updateTransaction({
	slug,
	transactionId,
	data,
}: UpdateTransactionRequest) {
	await putOrganizationsSlugTransactionsTransactionid({
		slug,
		transactionId,
		data,
	});
}
