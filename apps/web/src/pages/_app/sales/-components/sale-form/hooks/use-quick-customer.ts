import { useMutation, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { resolveErrorMessage } from "@/errors";
import { normalizeApiError } from "@/errors/api-error";
import {
	type GetOrganizationsSlugCustomersQueryResponse,
	getOrganizationsSlugCustomersQueryKey,
	postOrganizationsSlugCustomers,
} from "@/http/generated";
import { formatDocument } from "@/utils/format-document";
import {
	normalizeQuickCustomerName,
	resolveQuickCustomerDocumentType,
	type QuickCustomerData,
} from "../quick-customer-schema";
import type { SaleCustomerOption } from "../types";
import { useState } from "react";

interface UseQuickCustomerParams {
	organizationSlug?: string;
	queryClient: QueryClient;
	setSaleCustomerId(customerId: string): void;
	onQuickCustomerCreated(): void;
}

export function useQuickCustomer({
	organizationSlug,
	queryClient,
	setSaleCustomerId,
	onQuickCustomerCreated,
}: UseQuickCustomerParams) {
	const [quickCreatedCustomer, setQuickCreatedCustomer] =
		useState<SaleCustomerOption | null>(null);

	const {
		mutateAsync: createQuickCustomer,
		isPending: isCreatingQuickCustomer,
	} = useMutation({
		mutationFn: async (data: QuickCustomerData) => {
			if (!organizationSlug) {
				throw new Error("Organização não encontrada");
			}

			const documentType = resolveQuickCustomerDocumentType(
				data.documentNumber,
			);
			if (!documentType) {
				throw new Error("CPF/CNPJ inválido");
			}
			const personType = documentType === "CNPJ" ? "PJ" : "PF";
			const normalizedName = normalizeQuickCustomerName(data.name.trim());

			return postOrganizationsSlugCustomers({
				slug: organizationSlug,
				data: {
					name: normalizedName,
					personType,
					documentType,
					documentNumber: formatDocument({
						type: documentType,
						value: data.documentNumber,
					}),
					phone: data.phone?.trim() ? data.phone.trim() : undefined,
				},
			});
		},
		onSuccess: async (response, submittedData) => {
			if (!organizationSlug) {
				return;
			}

			const customersQueryKey = getOrganizationsSlugCustomersQueryKey({
				slug: organizationSlug,
			});
			const normalizedPhone = submittedData.phone?.trim()
				? submittedData.phone.trim()
				: null;
			const normalizedName = normalizeQuickCustomerName(submittedData.name.trim());
			const documentType =
				resolveQuickCustomerDocumentType(submittedData.documentNumber) ?? "CPF";
			const personType = documentType === "CNPJ" ? "PJ" : "PF";
			const normalizedDocumentNumber = formatDocument({
				type: documentType,
				value: submittedData.documentNumber,
			});

			const createdCustomer: SaleCustomerOption = {
				id: response.customerId,
				name: normalizedName,
				personType,
				phone: normalizedPhone,
				email: null,
				documentType,
				documentNumber: normalizedDocumentNumber,
				status: "ACTIVE",
				responsible: null,
				pf: null,
				pj: null,
			};

			setQuickCreatedCustomer(createdCustomer);
			setSaleCustomerId(response.customerId);
			onQuickCustomerCreated();

			await queryClient.invalidateQueries({
				queryKey: customersQueryKey,
			});
			await queryClient.refetchQueries({
				queryKey: customersQueryKey,
			});

			const refreshedCustomers =
				queryClient.getQueryData<GetOrganizationsSlugCustomersQueryResponse>(
					customersQueryKey,
				)?.customers ?? [];
			if (
				refreshedCustomers.some(
					(customer) => customer.id === response.customerId,
				)
			) {
				setQuickCreatedCustomer(null);
			}

			toast.success("Cliente cadastrado e selecionado.");
		},
		onError: (error) => {
			const message = resolveErrorMessage(normalizeApiError(error));
			toast.error(message);
		},
	});

	return {
		quickCreatedCustomer,
		createQuickCustomer,
		isCreatingQuickCustomer,
	};
}
