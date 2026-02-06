import {
	postOrganizationsSlugTransactions,
	type PostOrganizationsSlugTransactionsMutationRequest,
} from "../generated";

export async function createTransaction(
	data: PostOrganizationsSlugTransactionsMutationRequest,
) {
	const slug = "behenck";
	await postOrganizationsSlugTransactions(slug, data);
}
