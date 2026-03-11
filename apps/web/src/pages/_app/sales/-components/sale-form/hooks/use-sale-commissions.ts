import { useCallback, useEffect, useMemo, useState } from "react";
import { type Control, useWatch, type UseFormGetValues, type UseFormSetValue } from "react-hook-form";
import { useGetOrganizationsSlugProductsIdCommissionScenarios } from "@/http/generated";
import {
	type SaleCommissionFormData,
	type SaleFormData,
	type SaleFormInput,
} from "@/schemas/sale-schema";
import type { SaleResponsibleType } from "@/schemas/types/sales";
import {
	createDefaultManualSaleCommission,
	distributeSaleCommissionInstallments,
	mapScenarioCommissionsToPulledSaleCommissions,
	replacePulledSaleCommissions,
	resolveMatchedCommissionScenario,
	type SaleCommissionMatchContext,
} from "../../sale-commission-helpers";

interface UseSaleCommissionsParams {
	organizationSlug?: string;
	selectedProductId: string;
	selectedCompanyId: string;
	selectedUnitId: string;
	selectedResponsibleType: SaleResponsibleType;
	selectedResponsibleId: string;
	control: Control<SaleFormInput, unknown, SaleFormData>;
	getValues: UseFormGetValues<SaleFormInput>;
	setValue: UseFormSetValue<SaleFormInput>;
	appendCommission: (value: SaleCommissionFormData) => void;
	removeCommission: (index: number) => void;
	replaceCommissions: (values: SaleCommissionFormData[]) => void;
}

export function useSaleCommissions({
	organizationSlug,
	selectedProductId,
	selectedCompanyId,
	selectedUnitId,
	selectedResponsibleType,
	selectedResponsibleId,
	control,
	getValues,
	setValue,
	appendCommission,
	removeCommission,
	replaceCommissions,
}: UseSaleCommissionsParams) {
	const [commissionRequestedProductId, setCommissionRequestedProductId] =
		useState<string | null>(null);

	const hasSelectedProduct = Boolean(selectedProductId);
	const hasRequestedCommissionForCurrentProduct =
		Boolean(selectedProductId) &&
		commissionRequestedProductId === selectedProductId;

	const saleCommissionContext = useMemo<SaleCommissionMatchContext>(
		() => ({
			companyId: selectedCompanyId || undefined,
			unitId: selectedUnitId || undefined,
			sellerId:
				selectedResponsibleType === "SELLER" && selectedResponsibleId
					? selectedResponsibleId
					: undefined,
			partnerId:
				selectedResponsibleType === "PARTNER" && selectedResponsibleId
					? selectedResponsibleId
					: undefined,
		}),
		[
			selectedCompanyId,
			selectedUnitId,
			selectedResponsibleId,
			selectedResponsibleType,
		],
	);

	const commissionScenariosQuery =
		useGetOrganizationsSlugProductsIdCommissionScenarios(
			{
				slug: organizationSlug ?? "",
				id: selectedProductId || "",
			},
			{
				query: {
					enabled: false,
				},
			},
		);

	const hasLoadedCommissionForCurrentProduct =
		hasRequestedCommissionForCurrentProduct &&
		Boolean(commissionScenariosQuery.data);

	const matchedCommissionScenario = useMemo(() => {
		if (!hasRequestedCommissionForCurrentProduct) {
			return undefined;
		}

		return resolveMatchedCommissionScenario(
			commissionScenariosQuery.data?.scenarios ?? [],
			saleCommissionContext,
		);
	}, [
		commissionScenariosQuery.data?.scenarios,
		hasRequestedCommissionForCurrentProduct,
		saleCommissionContext,
	]);

	const watchedCommissions =
		(useWatch({
			control,
			name: "commissions",
		}) as SaleCommissionFormData[] | undefined) ?? [];

	const pulledCommissionsCount = watchedCommissions.filter(
		(commission) => commission.sourceType === "PULLED",
	).length;

	const applyPulledCommissions = useCallback(
		(nextPulledCommissions: SaleCommissionFormData[]) => {
			const currentCommissions =
				(getValues("commissions") as SaleCommissionFormData[] | undefined) ?? [];

			replaceCommissions(
				replacePulledSaleCommissions(currentCommissions, nextPulledCommissions),
			);
		},
		[getValues, replaceCommissions],
	);

	const clearPulledCommissions = useCallback(() => {
		applyPulledCommissions([]);
	}, [applyPulledCommissions]);

	const handleFetchCommissionScenarios = useCallback(() => {
		if (!selectedProductId) {
			return;
		}

		setCommissionRequestedProductId(selectedProductId);
		void commissionScenariosQuery.refetch();
	}, [commissionScenariosQuery, selectedProductId]);

	const handleAddManualCommission = useCallback(() => {
		const saleDate = getValues("saleDate") as Date | undefined;
		appendCommission(createDefaultManualSaleCommission(saleDate));
	}, [appendCommission, getValues]);

	const handleRemoveCommission = useCallback(
		(index: number) => {
			removeCommission(index);
		},
		[removeCommission],
	);

	const handleRemovePulledCommissions = useCallback(() => {
		clearPulledCommissions();
	}, [clearPulledCommissions]);

	const handleInstallmentCountChange = useCallback(
		(index: number, nextCount: number) => {
			const totalPercentage = Number(
				getValues(`commissions.${index}.totalPercentage` as const) ?? 0,
			);

			setValue(
				`commissions.${index}.installments` as const,
				distributeSaleCommissionInstallments(totalPercentage, nextCount),
				{
					shouldDirty: true,
					shouldValidate: true,
				},
			);
		},
		[getValues, setValue],
	);

	const resetOnProductChange = useCallback(() => {
		setCommissionRequestedProductId(null);
		clearPulledCommissions();
	}, [clearPulledCommissions]);

	useEffect(() => {
		if (!hasRequestedCommissionForCurrentProduct) {
			return;
		}

		if (
			commissionScenariosQuery.isFetching ||
			commissionScenariosQuery.isError ||
			!commissionScenariosQuery.data
		) {
			return;
		}

		const pulledCommissions = matchedCommissionScenario
			? mapScenarioCommissionsToPulledSaleCommissions(
					matchedCommissionScenario.commissions,
					getValues("saleDate") as Date | undefined,
				)
			: [];

		applyPulledCommissions(pulledCommissions);
	}, [
		applyPulledCommissions,
		commissionScenariosQuery.data,
		commissionScenariosQuery.isError,
		commissionScenariosQuery.isFetching,
		getValues,
		hasRequestedCommissionForCurrentProduct,
		matchedCommissionScenario,
	]);

	return {
		commissionScenariosQuery,
		hasSelectedProduct,
		hasRequestedCommissionForCurrentProduct,
		hasLoadedCommissionForCurrentProduct,
		matchedCommissionScenario,
		pulledCommissionsCount,
		handleFetchCommissionScenarios,
		handleAddManualCommission,
		handleRemoveCommission,
		handleRemovePulledCommissions,
		handleInstallmentCountChange,
		resetOnProductChange,
	};
}
