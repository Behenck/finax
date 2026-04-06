import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useApp } from "@/context/app-context";
import { resolveErrorMessage } from "@/errors";
import { normalizeApiError } from "@/errors/api-error";
import { api } from "@/lib/axios";

export type ProductCommissionReversalRule = {
	installmentNumber: number;
	percentage: number;
};

export type ProductCommissionReversalMode =
	| "INSTALLMENT_BY_NUMBER"
	| "TOTAL_PAID_PERCENTAGE";

export type ProductCommissionReversalRulesResponse = {
	mode: ProductCommissionReversalMode | null;
	totalPaidPercentage: number | null;
	rules: ProductCommissionReversalRule[];
};

function buildProductCommissionReversalRulesQueryKey(
	slug: string,
	productId: string,
	includeInherited: boolean,
) {
	return [
		"product-commission-reversal-rules",
		slug,
		productId,
		includeInherited ? "inherited" : "direct",
	] as const;
}

export function useProductCommissionReversalRules(
	productId?: string,
	options?: {
		enabled?: boolean;
		includeInherited?: boolean;
	},
) {
	const { organization } = useApp();
	const slug = organization?.slug ?? "";
	const includeInherited = options?.includeInherited ?? false;

	return useQuery({
		queryKey: buildProductCommissionReversalRulesQueryKey(
			slug,
			productId ?? "",
			includeInherited,
		),
		queryFn: async () => {
			const response = await api.get<ProductCommissionReversalRulesResponse>(
				`/organizations/${slug}/products/${productId}/commission-reversal-rules`,
				{
					params: includeInherited ? { includeInherited: true } : undefined,
				},
			);

			return response.data;
		},
		enabled:
			Boolean(slug && productId) &&
			(options?.enabled === undefined ? true : options.enabled),
	});
}

interface ReplaceProductCommissionReversalRulesInput {
	productId: string;
	mode: ProductCommissionReversalMode | null;
	totalPaidPercentage?: number | null;
	rules: ProductCommissionReversalRule[];
	silent?: boolean;
}

export function useReplaceProductCommissionReversalRules() {
	const { organization } = useApp();
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({
			productId,
			mode,
			totalPaidPercentage,
			rules,
		}: ReplaceProductCommissionReversalRulesInput) => {
			if (!organization?.slug) {
				throw new Error("Organização não encontrada");
			}

			await api.put(
				`/organizations/${organization.slug}/products/${productId}/commission-reversal-rules`,
				{
					mode,
					totalPaidPercentage:
						mode === "TOTAL_PAID_PERCENTAGE"
							? totalPaidPercentage ?? null
							: undefined,
					rules,
				},
			);
		},
		onSuccess: async (_, variables) => {
			if (!organization?.slug) {
				return;
			}

			await queryClient.invalidateQueries({
				queryKey: buildProductCommissionReversalRulesQueryKey(
					organization.slug,
					variables.productId,
					false,
				),
			});
			await queryClient.invalidateQueries({
				queryKey: buildProductCommissionReversalRulesQueryKey(
					organization.slug,
					variables.productId,
					true,
				),
			});
			await queryClient.invalidateQueries({
				queryKey: ["product-commission-reversal-rules", organization.slug],
			});
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
