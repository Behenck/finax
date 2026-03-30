import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { format, startOfDay } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useApp } from "@/context/app-context";
import {
	useCreateSale,
	useSaleFormOptions,
	useUpdateSale,
} from "@/hooks/sales";
import { useAbility } from "@/permissions/access";
import {
	type SaleFormData,
	type SaleFormInput,
	saleSchema,
} from "@/schemas/sale-schema";
import type { SaleResponsibleType, SaleStatus } from "@/schemas/types/sales";
import {
	formatCurrencyBRL,
	parseBRLCurrencyToCents,
} from "@/utils/format-amount";
import { roundSaleCommissionPercentage } from "../sale-commission-helpers";
import { toSaleDynamicFieldPayloadValues } from "../sale-dynamic-fields";
import { QUICK_CUSTOMER_DEFAULT_VALUES } from "./constants";
import { normalizeCustomerSearchValue } from "./customer-search";
import { parseSaleDateFromApi } from "./date-utils";
import { EditSelectedCustomerDialog } from "./dialogs/edit-selected-customer-dialog";
import { QuickCustomerDialog } from "./dialogs/quick-customer-dialog";
import { useQuickCustomer } from "./hooks/use-quick-customer";
import { useSaleCommissions } from "./hooks/use-sale-commissions";
import { useSaleDynamicFields } from "./hooks/use-sale-dynamic-fields";
import {
	resolveInitialCommissions,
	resolveInitialDynamicFields,
} from "./initial-values";
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

type SelectOption = {
	id: string;
	label: string;
};

type SaleCommissionBeneficiaryType =
	| "COMPANY"
	| "UNIT"
	| "SELLER"
	| "PARTNER"
	| "SUPERVISOR";

function mergeSelectOptionsById(
	baseOptions: SelectOption[],
	fallbackOptions: SelectOption[],
) {
	const optionsById = new Map<string, SelectOption>();

	for (const option of baseOptions) {
		optionsById.set(option.id, option);
	}

	for (const option of fallbackOptions) {
		if (!optionsById.has(option.id)) {
			optionsById.set(option.id, option);
		}
	}

	return Array.from(optionsById.values());
}

export function SaleForm({
	mode = "CREATE",
	initialSale,
	prefilledCustomerId,
}: SaleFormProps) {
	const ability = useAbility();
	const canCreateCommissions = ability.can(
		"access",
		"sales.commissions.create",
	);
	const canUpdateCommissions = ability.can(
		"access",
		"sales.commissions.update",
	);
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
		hierarchicalProducts,
		sellers,
		partners,
		supervisors,
		isLoading: isLoadingOptions,
		isError: isOptionsError,
		refetch,
	} = useSaleFormOptions();

	const canManageCommissionsOnCreate = canCreateCommissions;
	const canManageCommissionsOnUpdate =
		canCreateCommissions && canUpdateCommissions;
	const canManageCommissionsByMode =
		mode === "CREATE"
			? canManageCommissionsOnCreate
			: canManageCommissionsOnUpdate;
	const isCommissionEditable =
		mode === "CREATE"
			? canManageCommissionsOnCreate
			: canManageCommissionsOnUpdate &&
				(initialSale?.status as SaleStatus | undefined) === "PENDING";
	const isInstallmentsSectionVisible =
		!isCommissionEditable && Boolean(initialSale);

	const [isCustomerLocked, setIsCustomerLocked] = useState(
		mode === "CREATE" && Boolean(prefilledCustomerId),
	);
	const [customerQueryInput, setCustomerQueryInput] = useState<string | null>(
		null,
	);
	const [
		shouldValidateSelectedCustomerAfterRefresh,
		setShouldValidateSelectedCustomerAfterRefresh,
	] = useState(false);
	const [isCreateCustomerDialogOpen, setIsCreateCustomerDialogOpen] =
		useState(false);
	const [isEditCustomerDialogOpen, setIsEditCustomerDialogOpen] =
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

	const { quickCreatedCustomer, createQuickCustomer, isCreatingQuickCustomer } =
		useQuickCustomer({
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
				setCustomerQueryInput(null);
				quickCustomerForm.reset(QUICK_CUSTOMER_DEFAULT_VALUES);
				setIsCreateCustomerDialogOpen(false);
			},
		});

	const hierarchicalProductsForSelect = useMemo(() => {
		if (!initialSale?.productId) {
			return hierarchicalProducts;
		}

		const hasInitialSaleProduct = hierarchicalProducts.some(
			(product) => product.id === initialSale.productId,
		);
		if (hasInitialSaleProduct) {
			return hierarchicalProducts;
		}

		return [
			{
				id: initialSale.productId,
				name: initialSale.product.name,
				path: [initialSale.product.name],
				label: initialSale.product.name,
				rootId: initialSale.productId,
				rootName: initialSale.product.name,
				depth: 0,
				relativeLabel: initialSale.product.name,
				fullLabel: initialSale.product.name,
			},
			...hierarchicalProducts,
		];
	}, [hierarchicalProducts, initialSale]);

	const rootProductsForSelect = useMemo(
		() =>
			hierarchicalProductsForSelect
				.filter((product) => product.depth === 0)
				.map((product) => ({
					id: product.id,
					name: product.name,
					label: product.name,
				})),
		[hierarchicalProductsForSelect],
	);

	const companiesForSelect = useMemo(() => {
		if (!initialSale) {
			return companies;
		}

		const fallbackUnit =
			initialSale.unitId && initialSale.unit
				? { id: initialSale.unitId, name: initialSale.unit.name }
				: null;

		const hasInitialCompany = companies.some(
			(company) => company.id === initialSale.companyId,
		);
		if (!hasInitialCompany) {
			return [
				{
					id: initialSale.companyId,
					name: initialSale.company.name,
					units: fallbackUnit ? [fallbackUnit] : [],
					employees: [],
				},
				...companies,
			];
		}

		if (!fallbackUnit) {
			return companies;
		}

		return companies.map((company) => {
			if (company.id !== initialSale.companyId) {
				return company;
			}

			const hasInitialUnit = (company.units ?? []).some(
				(unit) => unit.id === fallbackUnit.id,
			);
			if (hasInitialUnit) {
				return company;
			}

			return {
				...company,
				units: [...(company.units ?? []), fallbackUnit],
			};
		});
	}, [companies, initialSale]);

	const customersWithFallback = useMemo(() => {
		if (!initialSale?.customerId) {
			return customers;
		}

		const hasInitialCustomer = customers.some(
			(customer) => customer.id === initialSale.customerId,
		);
		if (hasInitialCustomer) {
			return customers;
		}

		const fallbackCustomer: (typeof customers)[number] = {
			id: initialSale.customerId,
			name: initialSale.customer.name,
			personType: "PF",
			phone: null,
			email: null,
			documentType: "OTHER",
			documentNumber: "Não informado",
			status: "ACTIVE",
			responsible: null,
			pf: null,
			pj: null,
		};

		return [fallbackCustomer, ...customers];
	}, [customers, initialSale]);

	const customersForSelect = useMemo(() => {
		if (!quickCreatedCustomer) {
			return customersWithFallback;
		}

		const hasQuickCustomerInQuery = customersWithFallback.some(
			(customer) => customer.id === quickCreatedCustomer.id,
		);
		if (hasQuickCustomerInQuery) {
			return customersWithFallback;
		}

		return [quickCreatedCustomer, ...customersWithFallback];
	}, [customersWithFallback, quickCreatedCustomer]);

	const selectedCustomer = useMemo(
		() =>
			customersForSelect.find((customer) => customer.id === selectedCustomerId),
		[customersForSelect, selectedCustomerId],
	);
	const customerQuery = customerQueryInput ?? selectedCustomer?.name ?? "";
	const isQueryingCustomers = customerQueryInput !== null;

	const selectedCompany = useMemo(
		() =>
			companiesForSelect.find((company) => company.id === selectedCompanyId),
		[companiesForSelect, selectedCompanyId],
	);

	const companyUnits = useMemo(
		() => selectedCompany?.units ?? [],
		[selectedCompany?.units],
	);

	const sellerOptions = useMemo<SelectOption[]>(
		() => sellers.map((seller) => ({ id: seller.id, label: seller.name })),
		[sellers],
	);
	const partnerOptions = useMemo<SelectOption[]>(
		() => partners.map((partner) => ({ id: partner.id, label: partner.name })),
		[partners],
	);
	const supervisorOptions = useMemo<SelectOption[]>(
		() =>
			supervisors.map((supervisor) => ({
				id: supervisor.id,
				label: supervisor.name,
			})),
		[supervisors],
	);

	const fallbackResponsibleOption = useMemo<SelectOption | null>(() => {
		if (!initialSale?.responsibleId || !initialSale.responsible) {
			return null;
		}

		return {
			id: initialSale.responsibleId,
			label: initialSale.responsible.name,
		};
	}, [initialSale?.responsible, initialSale?.responsibleId]);

	const sellerOptionsForSelect = useMemo(() => {
		if (
			initialSale?.responsibleType !== "SELLER" ||
			!fallbackResponsibleOption
		) {
			return sellerOptions;
		}

		return mergeSelectOptionsById(sellerOptions, [fallbackResponsibleOption]);
	}, [fallbackResponsibleOption, initialSale?.responsibleType, sellerOptions]);

	const partnerOptionsForSelect = useMemo(() => {
		if (
			initialSale?.responsibleType !== "PARTNER" ||
			!fallbackResponsibleOption
		) {
			return partnerOptions;
		}

		return mergeSelectOptionsById(partnerOptions, [fallbackResponsibleOption]);
	}, [fallbackResponsibleOption, initialSale?.responsibleType, partnerOptions]);

	const commissionFallbackOptionsByType = useMemo(
		() =>
			(initialSale?.commissions ?? []).reduce(
				(accumulator, commission) => {
					if (
						commission.recipientType === "OTHER" ||
						!commission.beneficiaryId
					) {
						return accumulator;
					}

					const commissionType =
						commission.recipientType as SaleCommissionBeneficiaryType;
					const fallbackOption = {
						id: commission.beneficiaryId,
						label: commission.beneficiaryLabel?.trim() || "Selecionado",
					};

					if (
						!accumulator[commissionType].some(
							(option) => option.id === fallbackOption.id,
						)
					) {
						accumulator[commissionType].push(fallbackOption);
					}

					return accumulator;
				},
				{
					COMPANY: [] as SelectOption[],
					UNIT: [] as SelectOption[],
					SELLER: [] as SelectOption[],
					PARTNER: [] as SelectOption[],
					SUPERVISOR: [] as SelectOption[],
				},
			),
		[initialSale?.commissions],
	);

	const responsibles = useMemo(
		() =>
			selectedResponsibleType === "PARTNER"
				? partnerOptionsForSelect.map((partner) => ({
						id: partner.id,
						name: partner.label,
					}))
				: sellerOptionsForSelect.map((seller) => ({
						id: seller.id,
						name: seller.label,
					})),
		[partnerOptionsForSelect, selectedResponsibleType, sellerOptionsForSelect],
	);

	const allUnits = useMemo(
		() =>
			companiesForSelect.flatMap((company) =>
				(company.units ?? []).map((unit) => ({
					id: unit.id,
					label: `${company.name} -> ${unit.name}`,
				})),
			),
		[companiesForSelect],
	);

	const companyOptions = useMemo(
		() =>
			mergeSelectOptionsById(
				companiesForSelect.map((company) => ({
					id: company.id,
					label: company.name,
				})),
				commissionFallbackOptionsByType.COMPANY,
			),
		[commissionFallbackOptionsByType.COMPANY, companiesForSelect],
	);

	const unitOptions = useMemo(
		() =>
			mergeSelectOptionsById(allUnits, commissionFallbackOptionsByType.UNIT),
		[allUnits, commissionFallbackOptionsByType.UNIT],
	);

	const sellerOptionsForCommissions = useMemo(
		() =>
			mergeSelectOptionsById(
				sellerOptionsForSelect,
				commissionFallbackOptionsByType.SELLER,
			),
		[commissionFallbackOptionsByType.SELLER, sellerOptionsForSelect],
	);

	const partnerOptionsForCommissions = useMemo(
		() =>
			mergeSelectOptionsById(
				partnerOptionsForSelect,
				commissionFallbackOptionsByType.PARTNER,
			),
		[commissionFallbackOptionsByType.PARTNER, partnerOptionsForSelect],
	);

	const supervisorOptionsForCommissions = useMemo(
		() =>
			mergeSelectOptionsById(
				supervisorOptions,
				commissionFallbackOptionsByType.SUPERVISOR,
			),
		[commissionFallbackOptionsByType.SUPERVISOR, supervisorOptions],
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

	useEffect(() => {
		if (!shouldValidateSelectedCustomerAfterRefresh || isLoadingOptions) {
			return;
		}

		setShouldValidateSelectedCustomerAfterRefresh(false);

		if (!selectedCustomerId) {
			return;
		}

		const hasSelectedCustomerInOptions = customers.some(
			(customer) => customer.id === selectedCustomerId,
		);
		if (hasSelectedCustomerInOptions) {
			return;
		}

		setCustomerQueryInput((currentValue) => currentValue ?? customerQuery);
		setValue("customerId", "", {
			shouldDirty: true,
			shouldTouch: true,
			shouldValidate: true,
		});
	}, [
		customerQuery,
		customers,
		isLoadingOptions,
		selectedCustomerId,
		setValue,
		shouldValidateSelectedCustomerAfterRefresh,
	]);

	function handleCustomerQueryChange(value: string) {
		if (!selectedCustomer) {
			setCustomerQueryInput(value);
			return;
		}

		const normalizedInput = normalizeCustomerSearchValue(value);
		const normalizedSelectedCustomerName = normalizeCustomerSearchValue(
			selectedCustomer.name,
		);
		if (normalizedInput === normalizedSelectedCustomerName) {
			setCustomerQueryInput(null);
			return;
		}

		setCustomerQueryInput(value);
		setValue("customerId", "", {
			shouldDirty: true,
			shouldTouch: true,
		});
	}

	function handleSelectCustomer(customerId: string) {
		setValue("customerId", customerId, {
			shouldDirty: true,
			shouldTouch: true,
			shouldValidate: true,
		});
		setCustomerQueryInput(null);
	}

	function handleOpenSelectedCustomerEdit(customerId: string) {
		if (customerId !== selectedCustomerId) {
			setValue("customerId", customerId, {
				shouldDirty: true,
				shouldTouch: true,
				shouldValidate: true,
			});
		}

		setIsEditCustomerDialogOpen(true);
	}

	async function handleSelectedCustomerUpdated() {
		try {
			await refetch();
		} finally {
			setCustomerQueryInput(null);
			setShouldValidateSelectedCustomerAfterRefresh(true);
			setIsEditCustomerDialogOpen(false);
		}
	}

	const isPending = isCreatingSale || isUpdatingSale;

	async function onSubmit(data: SaleFormData) {
		const commissions = isCommissionEditable
			? (data.commissions ?? []).map((commission) => {
					const calculationBase = commission.calculationBase ?? "SALE_TOTAL";

					return {
						sourceType: commission.sourceType,
						recipientType: commission.recipientType,
						direction: commission.direction,
						calculationBase,
						baseCommissionIndex:
							calculationBase === "COMMISSION"
								? commission.baseCommissionIndex
								: undefined,
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
					};
				})
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
				rootProducts={rootProductsForSelect}
				hierarchicalProducts={hierarchicalProductsForSelect}
				isLoadingOptions={isLoadingOptions}
			/>
			<SaleDataSection control={control} />
			<CustomerSection
				control={control}
				customersForSelect={customersForSelect}
				selectedCustomer={selectedCustomer}
				customerQuery={customerQuery}
				isQueryingCustomers={isQueryingCustomers}
				isLoadingOptions={isLoadingOptions}
				isCustomerLocked={isCustomerLocked}
				isCreatingQuickCustomer={isCreatingQuickCustomer}
				onCustomerQueryChange={handleCustomerQueryChange}
				onSelectCustomer={handleSelectCustomer}
				onOpenEditSelectedCustomer={handleOpenSelectedCustomerEdit}
				onUnlockCustomer={() => setIsCustomerLocked(false)}
				onOpenQuickCustomerDialog={() => setIsCreateCustomerDialogOpen(true)}
			/>
			<ClassificationSection
				control={control}
				companies={companiesForSelect}
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
				isCommissionAccessDenied={!canManageCommissionsByMode}
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
				unitOptions={unitOptions}
				sellerOptions={sellerOptionsForCommissions}
				partnerOptions={partnerOptionsForCommissions}
				supervisorOptions={supervisorOptionsForCommissions}
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
			<EditSelectedCustomerDialog
				open={isEditCustomerDialogOpen}
				customerId={selectedCustomerId || undefined}
				onOpenChange={setIsEditCustomerDialogOpen}
				onUpdated={handleSelectedCustomerUpdated}
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
