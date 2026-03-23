import { resolveErrorMessage } from "@/errors";
import { normalizeApiError } from "@/errors/api-error";
import { useApp } from "@/context/app-context";
import {
	deleteOrganizationsSlugInvitesInviteid,
	getOrganizationsSlugInvitesQueryKey,
} from "@/http/generated";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface DeleteInviteInput {
	inviteId: string;
}

export function useDeleteInvite() {
	const { organization } = useApp();
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({ inviteId }: DeleteInviteInput) => {
			if (!organization?.slug) {
				throw new Error("Organização não encontrada");
			}

			await deleteOrganizationsSlugInvitesInviteid({
				slug: organization.slug,
				inviteId,
			});
		},
		onSuccess: async () => {
			if (!organization?.slug) {
				return;
			}

			await queryClient.invalidateQueries({
				queryKey: getOrganizationsSlugInvitesQueryKey({
					slug: organization.slug,
				}),
			});

			toast.success("Convite excluído com sucesso.");
		},
		onError: (error) => {
			const message = resolveErrorMessage(normalizeApiError(error));
			toast.error(message);
		},
	});
}
