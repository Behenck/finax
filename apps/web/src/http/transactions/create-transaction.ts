import {
	postOrganizationsSlugTransactions,
	type PostOrganizationsSlugTransactionsMutationRequest,
} from "../generated";

export async function createTransaction(
	params: {
		slug: string;
		data: PostOrganizationsSlugTransactionsMutationRequest;
	},
) {
	await postOrganizationsSlugTransactions({
		slug: params.slug,
		data: params.data,
	});
}
