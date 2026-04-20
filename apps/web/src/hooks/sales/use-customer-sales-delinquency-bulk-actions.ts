import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApp } from "@/context/app-context";
import {
	getOrganizationsSlugCustomersCustomeridQueryKey,
	getOrganizationsSlugPartnersPartneridQueryKey,
	getOrganizationsSlugSalesDelinquencyQueryKey,
	getOrganizationsSlugSalesQueryKey,
	getOrganizationsSlugSalesSaleidHistoryQueryKey,
	getOrganizationsSlugSalesSaleidQueryKey,
	patchOrganizationsSlugSalesSaleidDelinquenciesDelinquencyidResolve,
	postOrganizationsSlugSalesSaleidDelinquencies,
} from "@/http/generated";

export type LinkedSalesOwner =
	| {
			type: "CUSTOMER";
			id: string;
	  }
	| {
			type: "PARTNER";
			id: string;
	  };

export type LinkedSaleForDelinquencyActions = {
	id: string;
	status: string;
	openDelinquencies: Array<{
		id: string;
	}>;
};

interface LinkedSalesDelinquencyBulkInput {
	owner: LinkedSalesOwner;
	sales: LinkedSaleForDelinquencyActions[];
	selectedSaleIds: string[];
}

interface MarkLinkedSalesAsDelinquentInput
	extends LinkedSalesDelinquencyBulkInput {
	dueDate: string;
}

export interface MarkLinkedSalesAsDelinquentResult {
	selectedCount: number;
	attemptedCount: number;
	successCount: number;
	failedCount: number;
	ignoredNotCompletedCount: number;
}

export interface ResolveLinkedSalesDelinquenciesResult {
	selectedCount: number;
	attemptedOccurrenceCount: number;
	resolvedCount: number;
	failedCount: number;
	skippedWithoutOpenCount: number;
}

export type MarkCustomerSalesAsDelinquentResult =
	MarkLinkedSalesAsDelinquentResult;
export type ResolveCustomerSalesDelinquenciesResult =
	ResolveLinkedSalesDelinquenciesResult;

function getSelectedSales(
	sales: LinkedSaleForDelinquencyActions[],
	selectedSaleIds: string[],
) {
	const selectedIds = new Set(selectedSaleIds);
	return sales.filter((sale) => selectedIds.has(sale.id));
}

async function invalidateLinkedSalesQueries(params: {
	queryClient: ReturnType<typeof useQueryClient>;
	slug: string;
	owner: LinkedSalesOwner;
	saleIds: string[];
}) {
	const uniqueSaleIds = Array.from(new Set(params.saleIds));
	const ownerQueryKey =
		params.owner.type === "CUSTOMER"
			? getOrganizationsSlugCustomersCustomeridQueryKey({
					slug: params.slug,
					customerId: params.owner.id,
				})
			: getOrganizationsSlugPartnersPartneridQueryKey({
					slug: params.slug,
					partnerId: params.owner.id,
				});

	await Promise.all([
		params.queryClient.invalidateQueries({
			queryKey: getOrganizationsSlugSalesQueryKey({
				slug: params.slug,
			}),
		}),
		params.queryClient.invalidateQueries({
			queryKey: getOrganizationsSlugSalesDelinquencyQueryKey({
				slug: params.slug,
			}),
		}),
		params.queryClient.invalidateQueries({
			queryKey: ownerQueryKey,
		}),
		...uniqueSaleIds.flatMap((saleId) => [
			params.queryClient.invalidateQueries({
				queryKey: getOrganizationsSlugSalesSaleidQueryKey({
					slug: params.slug,
					saleId,
				}),
			}),
			params.queryClient.invalidateQueries({
				queryKey: getOrganizationsSlugSalesSaleidHistoryQueryKey({
					slug: params.slug,
					saleId,
				}),
			}),
		]),
	]);
}

export function useLinkedSalesDelinquencyBulkActions() {
	const { organization } = useApp();
	const queryClient = useQueryClient();

	const markSalesAsDelinquentMutation = useMutation({
		mutationFn: async ({
			owner,
			sales,
			selectedSaleIds,
			dueDate,
		}: MarkLinkedSalesAsDelinquentInput): Promise<MarkLinkedSalesAsDelinquentResult> => {
			if (!organization?.slug) {
				throw new Error("Organização não encontrada");
			}

			const selectedSales = getSelectedSales(sales, selectedSaleIds);
			const eligibleSales = selectedSales.filter(
				(sale) => sale.status === "COMPLETED",
			);
			const ignoredNotCompletedCount = selectedSales.length - eligibleSales.length;

			if (eligibleSales.length === 0) {
				return {
					selectedCount: selectedSales.length,
					attemptedCount: 0,
					successCount: 0,
					failedCount: 0,
					ignoredNotCompletedCount,
				};
			}

			const responses = await Promise.allSettled(
				eligibleSales.map((sale) =>
					postOrganizationsSlugSalesSaleidDelinquencies({
						slug: organization.slug,
						saleId: sale.id,
						data: { dueDate },
					}),
				),
			);
			const successCount = responses.filter(
				(response) => response.status === "fulfilled",
			).length;
			const failedCount = responses.length - successCount;

			await invalidateLinkedSalesQueries({
				queryClient,
				slug: organization.slug,
				owner,
				saleIds: eligibleSales.map((sale) => sale.id),
			});

			return {
				selectedCount: selectedSales.length,
				attemptedCount: eligibleSales.length,
				successCount,
				failedCount,
				ignoredNotCompletedCount,
			};
		},
	});

	const resolveSalesDelinquenciesMutation = useMutation({
		mutationFn: async ({
			owner,
			sales,
			selectedSaleIds,
		}: LinkedSalesDelinquencyBulkInput): Promise<ResolveLinkedSalesDelinquenciesResult> => {
			if (!organization?.slug) {
				throw new Error("Organização não encontrada");
			}

			const selectedSales = getSelectedSales(sales, selectedSaleIds);
			const salesWithOpenDelinquencies = selectedSales.filter(
				(sale) => sale.openDelinquencies.length > 0,
			);
			const skippedWithoutOpenCount =
				selectedSales.length - salesWithOpenDelinquencies.length;
			const occurrencesToResolve = salesWithOpenDelinquencies.flatMap((sale) =>
				sale.openDelinquencies.map((occurrence) => ({
					saleId: sale.id,
					delinquencyId: occurrence.id,
				})),
			);

			if (occurrencesToResolve.length === 0) {
				return {
					selectedCount: selectedSales.length,
					attemptedOccurrenceCount: 0,
					resolvedCount: 0,
					failedCount: 0,
					skippedWithoutOpenCount,
				};
			}

			const responses = await Promise.allSettled(
				occurrencesToResolve.map((occurrence) =>
					patchOrganizationsSlugSalesSaleidDelinquenciesDelinquencyidResolve({
						slug: organization.slug,
						saleId: occurrence.saleId,
						delinquencyId: occurrence.delinquencyId,
					}),
				),
			);
			const resolvedCount = responses.filter(
				(response) => response.status === "fulfilled",
			).length;
			const failedCount = responses.length - resolvedCount;

			await invalidateLinkedSalesQueries({
				queryClient,
				slug: organization.slug,
				owner,
				saleIds: salesWithOpenDelinquencies.map((sale) => sale.id),
			});

			return {
				selectedCount: selectedSales.length,
				attemptedOccurrenceCount: occurrencesToResolve.length,
				resolvedCount,
				failedCount,
				skippedWithoutOpenCount,
			};
		},
	});

	const markLinkedSalesAsDelinquent = markSalesAsDelinquentMutation.mutateAsync;
	const resolveLinkedSalesDelinquencies =
		resolveSalesDelinquenciesMutation.mutateAsync;

	return {
		markLinkedSalesAsDelinquent,
		isMarkingLinkedSalesAsDelinquent: markSalesAsDelinquentMutation.isPending,
		resolveLinkedSalesDelinquencies,
		isResolvingLinkedSalesDelinquencies:
			resolveSalesDelinquenciesMutation.isPending,
		markCustomerSalesAsDelinquent: markLinkedSalesAsDelinquent,
		isMarkingCustomerSalesAsDelinquent:
			markSalesAsDelinquentMutation.isPending,
		resolveCustomerSalesDelinquencies: resolveLinkedSalesDelinquencies,
		isResolvingCustomerSalesDelinquencies:
			resolveSalesDelinquenciesMutation.isPending,
	};
}

export const useCustomerSalesDelinquencyBulkActions =
	useLinkedSalesDelinquencyBulkActions;
