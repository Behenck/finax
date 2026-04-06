import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useApp } from "@/context/app-context";
import { resolveErrorMessage } from "@/errors";
import { normalizeApiError } from "@/errors/api-error";
import {
	getOrganizationsSlugSalesQueryKey,
	getOrganizationsSlugSalesSaleidCommissionInstallmentsQueryKey,
	getOrganizationsSlugSalesSaleidQueryKey,
	patchOrganizationsSlugCommissionsInstallmentsStatusBulk,
	type PatchOrganizationsSlugCommissionsInstallmentsStatusBulkMutationRequestStatusEnumKey,
} from "@/http/generated";

const BULK_SKIP_REASON_LABEL: Record<string, string> = {
	INVALID_STATUS_TRANSITION: "transição inválida",
	REVERSED_NOT_ALLOWED: "parcela estornada",
	SALE_NOT_EDITABLE: "venda não editável",
};

interface PatchCommissionInstallmentsStatusBulkInput {
	installmentIds: string[];
	saleIds: string[];
	status: PatchOrganizationsSlugCommissionsInstallmentsStatusBulkMutationRequestStatusEnumKey;
	paymentDate?: string;
	reversalDate?: string;
	silent?: boolean;
}

function formatSkippedInstallmentsMessage(skipped: Array<{ reason: string }>) {
	const countsByReason = new Map<string, number>();

	for (const item of skipped) {
		countsByReason.set(item.reason, (countsByReason.get(item.reason) ?? 0) + 1);
	}

	return Array.from(countsByReason.entries())
		.map(
			([reason, count]) =>
				`${count} ${BULK_SKIP_REASON_LABEL[reason] ?? reason.toLowerCase()}`,
		)
		.join(" · ");
}

export function usePatchCommissionInstallmentsStatusBulk() {
	const { organization } = useApp();
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({
			installmentIds,
			status,
			paymentDate,
			reversalDate,
		}: PatchCommissionInstallmentsStatusBulkInput) => {
			if (!organization?.slug) {
				throw new Error("Organização não encontrada");
			}

			return patchOrganizationsSlugCommissionsInstallmentsStatusBulk({
				slug: organization.slug,
				data: {
					installmentIds,
					status,
					paymentDate,
					reversalDate,
				},
			});
		},
		onSuccess: async (response, variables) => {
			if (!organization?.slug) {
				return;
			}

			const uniqueSaleIds = Array.from(new Set(variables.saleIds));
			await Promise.all([
				queryClient.invalidateQueries({
					queryKey: getOrganizationsSlugSalesQueryKey({
						slug: organization.slug,
					}),
				}),
				queryClient.invalidateQueries({
					queryKey: [
						{
							url: "/organizations/:slug/commissions/installments",
							params: {
								slug: organization.slug,
							},
						},
					],
				}),
				...uniqueSaleIds.flatMap((saleId) => [
					queryClient.invalidateQueries({
						queryKey: getOrganizationsSlugSalesSaleidQueryKey({
							slug: organization.slug,
							saleId,
						}),
					}),
					queryClient.invalidateQueries({
						queryKey:
							getOrganizationsSlugSalesSaleidCommissionInstallmentsQueryKey({
								slug: organization.slug,
								saleId,
							}),
					}),
				]),
			]);

			if (variables.silent) {
				return;
			}

			if (response.updatedCount > 0) {
				toast.success(`${response.updatedCount} parcela(s) atualizada(s).`);
			}

			if (response.skipped.length > 0) {
				toast.warning(
					`${response.skipped.length} parcela(s) ignorada(s): ${formatSkippedInstallmentsMessage(
						response.skipped,
					)}.`,
				);
			}
		},
		onError: (error, variables) => {
			if (variables?.silent) {
				return;
			}

			const message = resolveErrorMessage(normalizeApiError(error));
			toast.error(message);
		},
	});
}
