import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApp } from "@/context/app-context";
import {
	getOrganizationsSlugCustomersCustomeridQueryKey,
	getOrganizationsSlugSalesDelinquencyQueryKey,
	getOrganizationsSlugSalesQueryKey,
	getOrganizationsSlugSalesSaleidHistoryQueryKey,
	getOrganizationsSlugSalesSaleidQueryKey,
	patchOrganizationsSlugSalesSaleidDelinquenciesDelinquencyidResolve,
	postOrganizationsSlugSalesSaleidDelinquencies,
	type GetOrganizationsSlugCustomersCustomerid200,
} from "@/http/generated";

type CustomerSale =
	GetOrganizationsSlugCustomersCustomerid200["customer"]["sales"][number];

interface CustomerSalesDelinquencyBulkInput {
	customerId: string;
	sales: CustomerSale[];
	selectedSaleIds: string[];
}

interface MarkCustomerSalesAsDelinquentInput
	extends CustomerSalesDelinquencyBulkInput {
	dueDate: string;
}

export interface MarkCustomerSalesAsDelinquentResult {
	selectedCount: number;
	attemptedCount: number;
	successCount: number;
	failedCount: number;
	ignoredNotCompletedCount: number;
}

export interface ResolveCustomerSalesDelinquenciesResult {
	selectedCount: number;
	attemptedOccurrenceCount: number;
	resolvedCount: number;
	failedCount: number;
	skippedWithoutOpenCount: number;
}

function getSelectedSales(sales: CustomerSale[], selectedSaleIds: string[]) {
	const selectedIds = new Set(selectedSaleIds);
	return sales.filter((sale) => selectedIds.has(sale.id));
}

async function invalidateCustomerSalesQueries(params: {
	queryClient: ReturnType<typeof useQueryClient>;
	slug: string;
	customerId: string;
	saleIds: string[];
}) {
	const uniqueSaleIds = Array.from(new Set(params.saleIds));

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
			queryKey: getOrganizationsSlugCustomersCustomeridQueryKey({
				slug: params.slug,
				customerId: params.customerId,
			}),
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

export function useCustomerSalesDelinquencyBulkActions() {
	const { organization } = useApp();
	const queryClient = useQueryClient();

	const markSalesAsDelinquentMutation = useMutation({
		mutationFn: async ({
			customerId,
			sales,
			selectedSaleIds,
			dueDate,
		}: MarkCustomerSalesAsDelinquentInput): Promise<MarkCustomerSalesAsDelinquentResult> => {
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

			await invalidateCustomerSalesQueries({
				queryClient,
				slug: organization.slug,
				customerId,
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
			customerId,
			sales,
			selectedSaleIds,
		}: CustomerSalesDelinquencyBulkInput): Promise<ResolveCustomerSalesDelinquenciesResult> => {
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

			await invalidateCustomerSalesQueries({
				queryClient,
				slug: organization.slug,
				customerId,
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

	return {
		markCustomerSalesAsDelinquent:
			markSalesAsDelinquentMutation.mutateAsync,
		isMarkingCustomerSalesAsDelinquent:
			markSalesAsDelinquentMutation.isPending,
		resolveCustomerSalesDelinquencies:
			resolveSalesDelinquenciesMutation.mutateAsync,
		isResolvingCustomerSalesDelinquencies:
			resolveSalesDelinquenciesMutation.isPending,
	};
}
