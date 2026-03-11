import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { format, startOfDay } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useApp } from "@/context/app-context";
import { useCreateSale, useSaleFormOptions, useUpdateSale } from "@/hooks/sales";
import {
	type SaleFormData,
	type SaleFormInput,
	saleSchema,
} from "@/schemas/sale-schema";
import {
	type SaleResponsibleType,
	type SaleStatus,
} from "@/schemas/types/sales";
import {
	formatCurrencyBRL,
	parseBRLCurrencyToCents,
} from "@/utils/format-amount";
import { roundSaleCommissionPercentage } from "../sale-commission-helpers";
import { toSaleDynamicFieldPayloadValues } from "../sale-dynamic-fields";
import { QUICK_CUSTOMER_DEFAULT_VALUES } from "./constants";
import { parseSaleDateFromApi } from "./date-utils";
import { QuickCustomerDialog } from "./dialogs/quick-customer-dialog";
import { useQuickCustomer } from "./hooks/use-quick-customer";
import { useSaleCommissions } from "./hooks/use-sale-commissions";
import { useSaleDynamicFields } from "./hooks/use-sale-dynamic-fields";
import { resolveInitialCommissions, resolveInitialDynamicFields } from "./initial-values";
import {
	type QuickCustomerData,
	type QuickCustomerInput,
	quickCustomerSchema,
} from "./quick-customer-schema";
import { ClassificationSection } from "./sections/classification-section";
import { CommissionsSection } from "./sections/commissions-section";
import { CustomerSection } from "./sections/customer-section";
import { DynamicFieldsSection } from "./sections/dynamic-fields-section";
import { NotesSection } from "./sections/notes-section";
import { ProductSection } from "./sections/product-section";
import { SaleDataSection } from "./sections/sale-data-section";
import { SubmitActions } from "./sections/submit-actions";
import type { SaleFormProps } from "./types";

export function SaleForm({
	mode = "CREATE",
	initialSale,
	prefilledCustomerId,
}: SaleFormProps) {
	const { organization } = useApp();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { mutateAsync: createSale, isPending: isCreatingSale } =
		useCreateSale();
	const { mutateAsync: updateSale, isPending: isUpdatingSale } =
		useUpdateSale();
	const {
		companies,
		customers,
		products,
		sellers,
		partners,
		supervisors,
		isLoading: isLoadingOptions,
		isError: isOptionsError,
		refetch,
	} = useSaleFormOptions();

	const isCommissionEditable =
		mode === "CREATE" ||
		(initialSale?.status as SaleStatus | undefined) === "PENDING";
	const isInstallmentsSectionVisible =
		!isCommissionEditable && Boolean(initialSale);

	const [isCustomerLocked, setIsCustomerLocked] = useState(
		mode === "CREATE" && Boolean(prefilledCustomerId),
	);
	const [isCreateCustomerDialogOpen, setIsCreateCustomerDialogOpen] =
		useState(false);

	const form = useForm<SaleFormInput, unknown, SaleFormData>({
		resolver: zodResolver(saleSchema),
		defaultValues: {
			saleDate: initialSale
				? parseSaleDateFromApi(initialSale.saleDate)
				: startOfDay(new Date()),
			customerId: initialSale?.customerId ?? prefilledCustomerId ?? "",
			productId: initialSale?.productId ?? "",
			companyId: initialSale?.companyId ?? "",
			unitId: initialSale?.unitId ?? "",
			responsibleType: initialSale?.responsibleType ?? "SELLER",
			responsibleId: initialSale?.responsibleId ?? "",
			totalAmount: formatCurrencyBRL((initialSale?.totalAmount ?? 0) / 100),
			notes: initialSale?.notes ?? "",
			dynamicFields: resolveInitialDynamicFields(initialSale),
			commissions: resolveInitialCommissions(initialSale),
		},
	});
	const quickCustomerForm = useForm<
		QuickCustomerInput,
		unknown,
		QuickCustomerData
	>({
		resolver: zodResolver(quickCustomerSchema),
		defaultValues: QUICK_CUSTOMER_DEFAULT_VALUES,
	});

	const {
		control,
		handleSubmit,
		register,
		setValue,
		getValues,
		formState: { errors },
	} = form;
	const {
		fields: commissionFields,
		append: appendCommission,
		remove: removeCommission,
		replace: replaceCommissions,
	} = useFieldArray({
		control,
		name: "commissions",
	});

	const selectedCompanyId =
		(useWatch({
			control,
			name: "companyId",
		}) as string | undefined) ?? "";
	const selectedProductId =
		(useWatch({
			control,
			name: "productId",
		}) as string | undefined) ?? "";
	const selectedUnitId =
		(useWatch({
			control,
			name: "unitId",
		}) as string | undefined) ?? "";
	const selectedCustomerId =
		(useWatch({
			control,
			name: "customerId",
		}) as string | undefined) ?? "";
	const selectedResponsibleType =
		(useWatch({
			control,
			name: "responsibleType",
		}) as SaleResponsibleType | undefined) ?? "SELLER";
	const selectedResponsibleId =
		(useWatch({
			control,
			name: "responsibleId",
		}) as string | undefined) ?? "";
	const selectedTotalAmountInput =
		(useWatch({
			control,
			name: "totalAmount",
		}) as string | undefined) ?? "";

	const saleTotalAmountInCents = parseBRLCurrencyToCents(
		selectedTotalAmountInput,
	);

	const {
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
	} = useSaleCommissions({
		organizationSlug: organization?.slug,
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
	});

	const { dynamicFieldSchema, isDynamicFieldsLoading } = useSaleDynamicFields({
		mode,
		initialSale,
		organizationSlug: organization?.slug,
		selectedProductId,
		setValue,
		onProductChanged: resetOnProductChange,
	});

	const {
		quickCreatedCustomer,
		createQuickCustomer,
		isCreatingQuickCustomer,
	} = useQuickCustomer({
		organizationSlug: organization?.slug,
		queryClient,
		setSaleCustomerId: (customerId) => {
			setValue("customerId", customerId, {
				shouldDirty: true,
				shouldTouch: true,
				shouldValidate: true,
			});
		},
		onQuickCustomerCreated: () => {
			setIsCustomerLocked(false);
			quickCustomerForm.reset(QUICK_CUSTOMER_DEFAULT_VALUES);
			setIsCreateCustomerDialogOpen(false);
		},
	});

	const customersForSelect = useMemo(() => {
		if (!quickCreatedCustomer) {
			return customers;
		}

		const hasQuickCustomerInQuery = customers.some(
			(customer) => customer.id === quickCreatedCustomer.id,
		);
		if (hasQuickCustomerInQuery) {
			return customers;
		}

		return [quickCreatedCustomer, ...customers];
	}, [customers, quickCreatedCustomer]);

	const selectedCustomer = useMemo(
		() =>
			customersForSelect.find((customer) => customer.id === selectedCustomerId),
		[customersForSelect, selectedCustomerId],
	);
	const selectedCompany = useMemo(
		() => companies.find((company) => company.id === selectedCompanyId),
		[companies, selectedCompanyId],
	);
	const companyUnits = useMemo(
		() => selectedCompany?.units ?? [],
		[selectedCompany?.units],
	);

	const responsibles = useMemo(
		() =>
			selectedResponsibleType === "PARTNER"
				? partners.map((partner) => ({
						id: partner.id,
						name: partner.name,
					}))
				: sellers.map((seller) => ({
						id: seller.id,
						name: seller.name,
					})),
		[partners, sellers, selectedResponsibleType],
	);

	const allUnits = useMemo(
		() =>
			companies.flatMap((company) =>
				(company.units ?? []).map((unit) => ({
					id: unit.id,
					label: `${company.name} -> ${unit.name}`,
				})),
			),
		[companies],
	);
	const companyOptions = useMemo(
		() => companies.map((company) => ({ id: company.id, label: company.name })),
		[companies],
	);
	const sellerOptions = useMemo(
		() => sellers.map((seller) => ({ id: seller.id, label: seller.name })),
		[sellers],
	);
	const partnerOptions = useMemo(
		() => partners.map((partner) => ({ id: partner.id, label: partner.name })),
		[partners],
	);
	const supervisorOptions = useMemo(
		() =>
			supervisors.map((supervisor) => ({
				id: supervisor.id,
				label: supervisor.name,
			})),
		[supervisors],
	);

	useEffect(() => {
		const currentUnitId = getValues("unitId");
		if (!currentUnitId) {
			return;
		}

		const hasUnit = companyUnits.some((unit) => unit.id === currentUnitId);
		if (!hasUnit) {
			setValue("unitId", "");
		}
	}, [companyUnits, getValues, setValue]);

	useEffect(() => {
		const currentResponsibleId = getValues("responsibleId");
		if (!currentResponsibleId) {
			return;
		}

		const hasResponsible = responsibles.some(
			(responsible) => responsible.id === currentResponsibleId,
		);
		if (!hasResponsible) {
			setValue("responsibleId", "");
		}
	}, [getValues, responsibles, setValue]);

	const isPending = isCreatingSale || isUpdatingSale;

	async function onSubmit(data: SaleFormData) {
		const commissions = isCommissionEditable
			? (data.commissions ?? []).map((commission) => ({
					sourceType: commission.sourceType,
					recipientType: commission.recipientType,
					direction: commission.direction,
					beneficiaryId:
						commission.recipientType === "OTHER"
							? undefined
							: commission.beneficiaryId,
					beneficiaryLabel:
						commission.recipientType === "OTHER"
							? commission.beneficiaryLabel?.trim() || undefined
							: undefined,
					startDate: format(commission.startDate, "yyyy-MM-dd"),
					totalPercentage: roundSaleCommissionPercentage(
						commission.totalPercentage,
					),
					installments: commission.installments.map(
						(installment, installmentIndex) => ({
							installmentNumber: installmentIndex + 1,
							percentage: roundSaleCommissionPercentage(
								installment.percentage,
							),
						}),
					),
			  }))
			: undefined;
		const dynamicFields = toSaleDynamicFieldPayloadValues(
			dynamicFieldSchema,
			data.dynamicFields ?? {},
		);

		const payload = {
			saleDate: format(data.saleDate, "yyyy-MM-dd"),
			customerId: data.customerId,
			productId: data.productId,
			totalAmount: parseBRLCurrencyToCents(data.totalAmount),
			responsible: {
				type: data.responsibleType,
				id: data.responsibleId,
			},
			companyId: data.companyId,
			unitId: data.unitId || undefined,
			notes: data.notes?.trim() ? data.notes.trim() : undefined,
			dynamicFields,
			commissions,
		};

		try {
			if (mode === "CREATE") {
				const response = await createSale(payload);
				await navigate({
					to: "/sales/$saleId",
					params: {
						saleId: response.saleId,
					},
				});
				return;
			}

			if (!initialSale) {
				return;
			}

			await updateSale({
				saleId: initialSale.id,
				data: payload,
			});
			await navigate({
				to: "/sales/$saleId",
				params: {
					saleId: initialSale.id,
				},
			});
		} catch {
			// erro tratado nos hooks de mutation
		}
	}

	async function handleQuickCustomerCreate(data: QuickCustomerData) {
		try {
			await createQuickCustomer(data);
		} catch {
			// erro tratado no hook
		}
	}

	if (isOptionsError) {
		return (
			<Card className="flex flex-col gap-4 p-6">
				<p className="text-destructive">
					Erro ao carregar opções do formulário de vendas.
				</p>
				<Button variant="outline" className="w-fit" onClick={() => refetch()}>
					Tentar novamente
				</Button>
			</Card>
		);
	}

	return (
		<form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
			<ProductSection
				control={control}
				products={products}
				isLoadingOptions={isLoadingOptions}
			/>
			<SaleDataSection control={control} />
			<CustomerSection
				control={control}
				customersForSelect={customersForSelect}
				selectedCustomer={selectedCustomer}
				isLoadingOptions={isLoadingOptions}
				isCustomerLocked={isCustomerLocked}
				isCreatingQuickCustomer={isCreatingQuickCustomer}
				onUnlockCustomer={() => setIsCustomerLocked(false)}
				onOpenQuickCustomerDialog={() => setIsCreateCustomerDialogOpen(true)}
			/>
			<ClassificationSection
				control={control}
				companies={companies}
				companyUnits={companyUnits}
				responsibles={responsibles}
				selectedCompanyId={selectedCompanyId}
				selectedResponsibleType={selectedResponsibleType}
				isLoadingOptions={isLoadingOptions}
			/>
			<DynamicFieldsSection
				control={control}
				selectedProductId={selectedProductId}
				isDynamicFieldsLoading={isDynamicFieldsLoading}
				dynamicFieldSchema={dynamicFieldSchema}
			/>
			<CommissionsSection
				isCommissionEditable={isCommissionEditable}
				isInstallmentsSectionVisible={isInstallmentsSectionVisible}
				initialSaleId={initialSale?.id}
				initialSaleStatus={
					(initialSale?.status as SaleStatus | undefined) ?? "PENDING"
				}
				selectedProductId={selectedProductId}
				hasSelectedProduct={hasSelectedProduct}
				hasRequestedCommissionForCurrentProduct={
					hasRequestedCommissionForCurrentProduct
				}
				hasLoadedCommissionForCurrentProduct={
					hasLoadedCommissionForCurrentProduct
				}
				isCommissionScenariosFetching={commissionScenariosQuery.isFetching}
				isCommissionScenariosError={commissionScenariosQuery.isError}
				matchedCommissionScenarioName={matchedCommissionScenario?.name}
				commissionFields={commissionFields}
				control={control}
				setValue={setValue}
				getValues={getValues}
				onFetchCommissionScenarios={handleFetchCommissionScenarios}
				onAddManualCommission={handleAddManualCommission}
				onRemoveCommission={handleRemoveCommission}
				onRemovePulledCommissions={handleRemovePulledCommissions}
				onInstallmentCountChange={handleInstallmentCountChange}
				pulledCommissionsCount={pulledCommissionsCount}
				companyOptions={companyOptions}
				unitOptions={allUnits}
				sellerOptions={sellerOptions}
				partnerOptions={partnerOptions}
				supervisorOptions={supervisorOptions}
				saleTotalAmountInCents={saleTotalAmountInCents}
				commissionsError={errors.commissions}
			/>
			<NotesSection register={register} notesError={errors.notes} />
			<QuickCustomerDialog
				open={isCreateCustomerDialogOpen}
				onOpenChange={(open) => {
					setIsCreateCustomerDialogOpen(open);
					if (!open) {
						quickCustomerForm.reset(QUICK_CUSTOMER_DEFAULT_VALUES);
					}
				}}
				form={quickCustomerForm}
				isPending={isCreatingQuickCustomer}
				onSubmit={handleQuickCustomerCreate}
			/>
			<SubmitActions
				mode={mode}
				isPending={isPending}
				isLoadingOptions={isLoadingOptions}
				isDynamicFieldsLoading={isDynamicFieldsLoading}
			/>
		</form>
	);
}
