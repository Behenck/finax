import { FieldError } from "@/components/field-error";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useApp } from "@/context/app-context";
import { resolveErrorMessage } from "@/errors";
import { normalizeApiError } from "@/errors/api-error";
import {
	useCreateSale,
	useSaleFormOptions,
	useUpdateSale,
} from "@/hooks/sales";
import {
	getOrganizationsSlugCustomersQueryKey,
	postOrganizationsSlugCustomers,
	useGetOrganizationsSlugProductsIdCommissionScenarios,
	type GetOrganizationsSlugProductsIdCommissionScenarios200,
	type GetOrganizationsSlugSalesSaleid200,
} from "@/http/generated";
import {
	saleSchema,
	type SaleFormData,
	type SaleFormInput,
} from "@/schemas/sale-schema";
import {
	SALE_RESPONSIBLE_TYPE_LABEL,
	type SaleResponsibleType,
} from "@/schemas/types/sales";
import { formatDocument } from "@/utils/format-document";
import { formatCurrencyBRL, parseBRLCurrencyToCents } from "@/utils/format-amount";
import { formatPhone } from "@/utils/format-phone";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { format, parse, startOfDay } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import z from "zod";

const OPTIONAL_NONE_VALUE = "__NONE__";
const QUICK_CUSTOMER_DEFAULT_VALUES = {
	name: "",
	documentNumber: "",
	phone: "",
};

type SaleDetail = GetOrganizationsSlugSalesSaleid200["sale"];

const quickCustomerSchema = z.object({
	name: z.string().trim().min(1, "Nome obrigatório"),
	documentNumber: z
		.string()
		.trim()
		.min(1, "CPF obrigatório")
		.refine((value) => value.replace(/\D/g, "").length === 11, "CPF inválido"),
	phone: z
		.string()
		.optional()
		.or(z.literal(""))
		.refine(
			(value) =>
				!value || value.replace(/\D/g, "").length === 10 || value.replace(/\D/g, "").length === 11,
			"Celular inválido",
		),
});

type QuickCustomerInput = z.input<typeof quickCustomerSchema>;
type QuickCustomerData = z.infer<typeof quickCustomerSchema>;
type ProductCommissionScenario =
	GetOrganizationsSlugProductsIdCommissionScenarios200["scenarios"][number];
type ProductCommissionCondition = ProductCommissionScenario["conditions"][number];
type ProductCommission = ProductCommissionScenario["commissions"][number];

type SaleCommissionMatchContext = {
	companyId?: string;
	unitId?: string;
	sellerId?: string;
	partnerId?: string;
};

const COMMISSION_RECIPIENT_TYPE_LABEL: Record<
	ProductCommission["recipientType"],
	string
> = {
	COMPANY: "Empresa",
	UNIT: "Unidade",
	PARTNER: "Parceiro",
	SELLER: "Vendedor",
	SUPERVISOR: "Supervisor",
	OTHER: "Outro",
};

function matchesCommissionCondition(
	condition: ProductCommissionCondition,
	context: SaleCommissionMatchContext,
) {
	switch (condition.type) {
		case "COMPANY":
			return condition.valueId === null
				? Boolean(context.companyId)
				: context.companyId === condition.valueId;
		case "UNIT":
			return condition.valueId === null
				? Boolean(context.unitId)
				: context.unitId === condition.valueId;
		case "SELLER":
			return condition.valueId === null
				? Boolean(context.sellerId)
				: context.sellerId === condition.valueId;
		case "PARTNER":
			return condition.valueId === null
				? Boolean(context.partnerId)
				: context.partnerId === condition.valueId;
		default:
			return false;
	}
}

function matchesCommissionScenario(
	scenario: ProductCommissionScenario,
	context: SaleCommissionMatchContext,
) {
	if (scenario.conditions.length === 0) {
		return true;
	}

	const conditionsByType = new Map<
		ProductCommissionCondition["type"],
		ProductCommissionCondition[]
	>();

	for (const condition of scenario.conditions) {
		const current = conditionsByType.get(condition.type) ?? [];
		current.push(condition);
		conditionsByType.set(condition.type, current);
	}

	return Array.from(conditionsByType.values()).every((conditions) =>
		conditions.some((condition) =>
			matchesCommissionCondition(condition, context),
		),
	);
}

function resolveMatchedCommissionScenario(
	scenarios: ProductCommissionScenario[],
	context: SaleCommissionMatchContext,
) {
	const matchedScenarios = scenarios
		.map((scenario, index) => ({
			index,
			scenario,
			isMatch: matchesCommissionScenario(scenario, context),
			specificity: scenario.conditions.length,
		}))
		.filter((item) => item.isMatch)
		.sort((left, right) => {
			if (right.specificity !== left.specificity) {
				return right.specificity - left.specificity;
			}

			return left.index - right.index;
		});

	return matchedScenarios[0]?.scenario;
}

interface SaleFormProps {
	mode?: "CREATE" | "UPDATE";
	initialSale?: SaleDetail;
	prefilledCustomerId?: string;
}

function parseSaleDateFromApi(value: string) {
	const dateOnly = value.slice(0, 10);
	return parse(dateOnly, "yyyy-MM-dd", new Date());
}

function toDateInputValue(date?: Date) {
	return date ? format(date, "yyyy-MM-dd") : "";
}

function parseDateInputValue(value: string) {
	if (!value) {
		return undefined;
	}

	return parse(value, "yyyy-MM-dd", new Date());
}

export function SaleForm({
	mode = "CREATE",
	initialSale,
	prefilledCustomerId,
}: SaleFormProps) {
	const { organization } = useApp();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { mutateAsync: createSale, isPending: isCreatingSale } = useCreateSale();
	const { mutateAsync: updateSale, isPending: isUpdatingSale } = useUpdateSale();
	const {
		companies,
		customers,
		products,
		sellers,
		partners,
		isLoading: isLoadingOptions,
		isError: isOptionsError,
		refetch,
	} = useSaleFormOptions();

	const [isCustomerLocked, setIsCustomerLocked] = useState(
		mode === "CREATE" && Boolean(prefilledCustomerId),
	);
	const [isCreateCustomerDialogOpen, setIsCreateCustomerDialogOpen] =
		useState(false);
	const [commissionRequestedProductId, setCommissionRequestedProductId] =
		useState<string | null>(null);

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
	const hasSelectedProduct = Boolean(selectedProductId);
	const hasRequestedCommissionForCurrentProduct =
		Boolean(selectedProductId) &&
		commissionRequestedProductId === selectedProductId;

	const selectedCustomer = useMemo(
		() => customers.find((customer) => customer.id === selectedCustomerId),
		[customers, selectedCustomerId],
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
	const commissionScenariosQuery = useGetOrganizationsSlugProductsIdCommissionScenarios(
		{
			slug: organization?.slug ?? "",
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
	const matchedCommissionScenario = useMemo(
		() => {
			if (!hasRequestedCommissionForCurrentProduct) {
				return undefined;
			}

			return resolveMatchedCommissionScenario(
				commissionScenariosQuery.data?.scenarios ?? [],
				saleCommissionContext,
			);
		},
		[
			commissionScenariosQuery.data?.scenarios,
			hasRequestedCommissionForCurrentProduct,
			saleCommissionContext,
		],
	);
	const companyNameById = useMemo(
		() => new Map(companies.map((company) => [company.id, company.name])),
		[companies],
	);
	const unitLabelById = useMemo(
		() => new Map(allUnits.map((unit) => [unit.id, unit.label])),
		[allUnits],
	);
	const sellerNameById = useMemo(
		() => new Map(sellers.map((seller) => [seller.id, seller.name])),
		[sellers],
	);
	const partnerNameById = useMemo(
		() => new Map(partners.map((partner) => [partner.id, partner.name])),
		[partners],
	);

	function resolveCommissionBeneficiaryLabel(commission: ProductCommission) {
		if (commission.beneficiaryLabel?.trim()) {
			return commission.beneficiaryLabel.trim();
		}

		const beneficiaryId = commission.beneficiaryId;
		if (!beneficiaryId) {
			return null;
		}

		switch (commission.recipientType) {
			case "COMPANY":
				return companyNameById.get(beneficiaryId) ?? null;
			case "UNIT":
				return unitLabelById.get(beneficiaryId) ?? null;
			case "SELLER":
				return sellerNameById.get(beneficiaryId) ?? null;
			case "PARTNER":
				return partnerNameById.get(beneficiaryId) ?? null;
			default:
				return null;
		}
	}

	function handleFetchCommissionScenarios() {
		if (!selectedProductId) {
			return;
		}

		setCommissionRequestedProductId(selectedProductId);
		void commissionScenariosQuery.refetch();
	}

	const { mutateAsync: createQuickCustomer, isPending: isCreatingQuickCustomer } =
		useMutation({
			mutationFn: async (data: QuickCustomerData) => {
				if (!organization?.slug) {
					throw new Error("Organização não encontrada");
				}

				return postOrganizationsSlugCustomers({
					slug: organization.slug,
					data: {
						name: data.name.trim(),
						personType: "PF",
						documentType: "CPF",
						documentNumber: formatDocument({
							type: "CPF",
							value: data.documentNumber,
						}),
						phone: data.phone?.trim() ? data.phone.trim() : undefined,
					},
				});
			},
			onSuccess: async (response) => {
				if (!organization?.slug) {
					return;
				}

				await queryClient.invalidateQueries({
					queryKey: getOrganizationsSlugCustomersQueryKey({
						slug: organization.slug,
					}),
				});

				setValue("customerId", response.customerId, {
					shouldDirty: true,
					shouldTouch: true,
					shouldValidate: true,
				});
				setIsCustomerLocked(false);
				quickCustomerForm.reset(QUICK_CUSTOMER_DEFAULT_VALUES);
				setIsCreateCustomerDialogOpen(false);

				toast.success("Cliente cadastrado e selecionado.");
			},
			onError: (error) => {
				const message = resolveErrorMessage(normalizeApiError(error));
				toast.error(message);
			},
		});

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
			// erro tratado na mutation
		}
	}

	if (isOptionsError) {
		return (
			<Card className="p-6 flex flex-col gap-4">
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
			<Card className="p-5 rounded-sm gap-4">
				<h2 className="font-semibold text-md">Produto</h2>

				<FieldGroup>
					<Field className="gap-1">
						<FieldLabel>Produto *</FieldLabel>
						<Controller
							control={control}
							name="productId"
							render={({ field, fieldState }) => (
								<>
									<Select
										value={field.value || undefined}
										onValueChange={(value) => {
											setCommissionRequestedProductId(null);
											field.onChange(value);
										}}
										disabled={isLoadingOptions}
									>
										<SelectTrigger>
											<SelectValue placeholder="Selecione um produto" />
										</SelectTrigger>
										<SelectContent>
											{products.map((product) => (
												<SelectItem key={product.id} value={product.id}>
													{product.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									<FieldError error={fieldState.error} />
								</>
							)}
						/>
					</Field>
				</FieldGroup>
			</Card>

			<Card className="p-5 rounded-sm gap-4">
				<h2 className="font-semibold text-md">Dados da Venda</h2>

				<div className="grid gap-4 md:grid-cols-2">
					<FieldGroup>
						<Field className="gap-1">
							<FieldLabel>Data da venda *</FieldLabel>
							<Controller
								control={control}
								name="saleDate"
								render={({ field, fieldState }) => (
									<>
										<Input
											type="date"
											value={toDateInputValue(field.value as Date | undefined)}
											onChange={(event) => {
												field.onChange(parseDateInputValue(event.target.value));
											}}
											aria-invalid={fieldState.invalid}
										/>
										<FieldError error={fieldState.error} />
									</>
								)}
							/>
						</Field>
					</FieldGroup>

					<FieldGroup>
						<Field className="gap-1">
							<FieldLabel>Valor total *</FieldLabel>
							<Controller
								control={control}
								name="totalAmount"
								render={({ field, fieldState }) => (
									<>
										<Input
											placeholder="R$ 0,00"
											value={field.value ?? ""}
											onChange={(event) =>
												field.onChange(formatCurrencyBRL(event.target.value))
											}
											aria-invalid={fieldState.invalid}
										/>
										<FieldError error={fieldState.error} />
									</>
								)}
							/>
						</Field>
					</FieldGroup>
				</div>
			</Card>

			<Card className="p-5 rounded-sm gap-4">
				<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
					<div className="space-y-1">
						<h2 className="font-semibold text-md">Cliente</h2>
						<p className="text-muted-foreground text-sm">
							Selecione um cliente existente ou faça um cadastro rápido.
						</p>
					</div>
					<Button
						type="button"
						variant="outline"
						onClick={() => setIsCreateCustomerDialogOpen(true)}
						disabled={isCreatingQuickCustomer}
					>
						Cadastrar cliente rápido
					</Button>
				</div>

				<div className="grid gap-4 md:grid-cols-2">
					<FieldGroup>
						<Field className="gap-1">
							<FieldLabel className="flex items-center justify-between">
								<span>Cliente *</span>
								{isCustomerLocked ? (
									<Button
										type="button"
										variant="link"
										className="h-auto px-0 text-xs"
										onClick={() => setIsCustomerLocked(false)}
									>
										Alterar cliente
									</Button>
								) : null}
							</FieldLabel>
							<Controller
								control={control}
								name="customerId"
								render={({ field, fieldState }) => (
									<>
										<Select
											value={field.value || undefined}
											onValueChange={field.onChange}
											disabled={
												isLoadingOptions || isCustomerLocked || isCreatingQuickCustomer
											}
										>
											<SelectTrigger>
												<SelectValue placeholder="Selecione um cliente" />
											</SelectTrigger>
											<SelectContent>
												{customers.map((customer) => (
													<SelectItem key={customer.id} value={customer.id}>
														{customer.name}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
										<FieldError error={fieldState.error} />
									</>
								)}
							/>
						</Field>
					</FieldGroup>

					<div className="rounded-md border bg-muted/20 p-3 space-y-2">
						<p className="font-medium text-sm">Dados base do cliente</p>
						{selectedCustomer ? (
							<div className="space-y-1 text-sm">
								<p>
									<strong>Nome:</strong> {selectedCustomer.name}
								</p>
								<p>
									<strong>
										{selectedCustomer.documentType === "CPF"
											? "CPF"
											: selectedCustomer.documentType}
										:
									</strong>{" "}
									{selectedCustomer.documentType === "CPF"
										? formatDocument({
												type: "CPF",
												value: selectedCustomer.documentNumber,
											})
										: selectedCustomer.documentNumber}
								</p>
								<p>
									<strong>Celular:</strong>{" "}
									{selectedCustomer.phone
										? formatPhone(selectedCustomer.phone)
										: "Não informado"}
								</p>
							</div>
						) : (
							<p className="text-muted-foreground text-sm">
								Nenhum cliente selecionado.
							</p>
						)}
					</div>
				</div>
			</Card>

			<Card className="p-5 rounded-sm gap-4">
				<h2 className="font-semibold text-md">Classificação da Venda</h2>

				<div className="grid gap-4 md:grid-cols-2">
					<FieldGroup>
						<Field className="gap-1">
							<FieldLabel>Empresa *</FieldLabel>
							<Controller
								control={control}
								name="companyId"
								render={({ field, fieldState }) => (
									<>
										<Select
											value={field.value || undefined}
											onValueChange={field.onChange}
											disabled={isLoadingOptions}
										>
											<SelectTrigger>
												<SelectValue placeholder="Selecione uma empresa" />
											</SelectTrigger>
											<SelectContent>
												{companies.map((company) => (
													<SelectItem key={company.id} value={company.id}>
														{company.name}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
										<FieldError error={fieldState.error} />
									</>
								)}
							/>
						</Field>
					</FieldGroup>

					<FieldGroup>
						<Field className="gap-1">
							<FieldLabel>Unidade</FieldLabel>
							<Controller
								control={control}
								name="unitId"
								render={({ field, fieldState }) => (
									<>
										<Select
											value={
												(field.value as string | undefined) || OPTIONAL_NONE_VALUE
											}
											onValueChange={(value) =>
												field.onChange(value === OPTIONAL_NONE_VALUE ? "" : value)
											}
											disabled={isLoadingOptions || !selectedCompanyId}
										>
											<SelectTrigger>
												<SelectValue placeholder="Selecione uma unidade" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value={OPTIONAL_NONE_VALUE}>
													Sem unidade
												</SelectItem>
												{companyUnits.map((unit) => (
													<SelectItem key={unit.id} value={unit.id}>
														{unit.name}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
										<FieldError error={fieldState.error} />
									</>
								)}
							/>
						</Field>
					</FieldGroup>
					<FieldGroup>
						<Field className="gap-1">
							<FieldLabel>Tipo de responsável *</FieldLabel>
							<Controller
								control={control}
								name="responsibleType"
								render={({ field, fieldState }) => (
									<>
										<Select
											value={field.value || "SELLER"}
											onValueChange={(value) =>
												field.onChange(value as SaleResponsibleType)
											}
											disabled={isLoadingOptions}
										>
											<SelectTrigger>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="SELLER">
													{SALE_RESPONSIBLE_TYPE_LABEL.SELLER}
												</SelectItem>
												<SelectItem value="PARTNER">
													{SALE_RESPONSIBLE_TYPE_LABEL.PARTNER}
												</SelectItem>
											</SelectContent>
										</Select>
										<FieldError error={fieldState.error} />
									</>
								)}
							/>
						</Field>
					</FieldGroup>

					<FieldGroup>
						<Field className="gap-1">
							<FieldLabel>
								{selectedResponsibleType === "PARTNER"
									? "Parceiro *"
									: "Vendedor *"}
							</FieldLabel>
							<Controller
								control={control}
								name="responsibleId"
								render={({ field, fieldState }) => (
									<>
										<Select
											value={field.value || undefined}
											onValueChange={field.onChange}
											disabled={isLoadingOptions}
										>
											<SelectTrigger>
												<SelectValue placeholder="Selecione o responsável" />
											</SelectTrigger>
											<SelectContent>
												{responsibles.map((responsible) => (
													<SelectItem key={responsible.id} value={responsible.id}>
														{responsible.name}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
										<FieldError error={fieldState.error} />
									</>
								)}
							/>
						</Field>
					</FieldGroup>

				</div>
			</Card>

			<Card className="p-5 rounded-sm gap-4">
				<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
					<h2 className="font-semibold text-md">Comissões aplicáveis</h2>
					<Button
						type="button"
						variant="outline"
						onClick={handleFetchCommissionScenarios}
						disabled={!hasSelectedProduct || commissionScenariosQuery.isFetching}
					>
						{commissionScenariosQuery.isFetching
							? "Carregando..."
							: hasLoadedCommissionForCurrentProduct
								? "Atualizar comissão"
								: "Buscar comissão"}
					</Button>
				</div>

				{!selectedProductId ? (
					<p className="text-sm text-muted-foreground">
						Selecione um produto para buscar comissão.
					</p>
				) : !hasRequestedCommissionForCurrentProduct ? (
					<p className="text-sm text-muted-foreground">
						Clique em buscar comissão para carregar as regras do produto.
					</p>
				) : commissionScenariosQuery.isFetching ? (
					<p className="text-sm text-muted-foreground">
						Carregando cenários de comissão...
					</p>
				) : commissionScenariosQuery.isError ? (
					<div className="space-y-3">
						<p className="text-sm text-destructive">
							Não foi possível carregar as comissões do produto.
						</p>
						<Button
							type="button"
							variant="outline"
							className="w-fit"
							onClick={handleFetchCommissionScenarios}
						>
							Tentar novamente
						</Button>
					</div>
				) : !matchedCommissionScenario ? (
					<p className="text-sm text-muted-foreground">
						Nenhum cenário de comissão compatível com as condições atuais da
						venda.
					</p>
				) : (
					<div className="space-y-3">
						<div className="rounded-md border bg-muted/20 p-3">
							<p className="text-sm">
								<span className="text-muted-foreground">Cenário aplicado: </span>
								<strong>{matchedCommissionScenario.name}</strong>
							</p>
						</div>

						<div className="space-y-2">
							{matchedCommissionScenario.commissions.map((commission, index) => {
								const beneficiaryLabel =
									resolveCommissionBeneficiaryLabel(commission);

								return (
									<div
										key={`${commission.recipientType}-${index}`}
										className="rounded-md border p-3 space-y-2"
									>
										<div className="flex items-start justify-between gap-3">
											<div>
												<p className="font-medium text-sm">
													{COMMISSION_RECIPIENT_TYPE_LABEL[
														commission.recipientType
													]}
												</p>
												{beneficiaryLabel ? (
													<p className="text-xs text-muted-foreground">
														{beneficiaryLabel}
													</p>
												) : null}
											</div>
											<span className="font-semibold text-sm">
												{commission.totalPercentage}%
											</span>
										</div>

										<p className="text-xs text-muted-foreground">
											Parcelas:{" "}
											{commission.installments
												.map(
													(installment) =>
														`${installment.installmentNumber}ª ${installment.percentage}%`,
												)
												.join(" • ")}
										</p>
									</div>
								);
							})}
						</div>
					</div>
				)}
			</Card>

			<Card className="p-5 rounded-sm gap-4">
				<h2 className="font-semibold text-md">Observações</h2>
				<FieldGroup>
					<Field className="gap-1">
						<FieldLabel>Observação</FieldLabel>
						<Textarea
							rows={4}
							placeholder="Informações adicionais sobre a venda..."
							{...register("notes")}
						/>
						<FieldError error={errors.notes} />
					</Field>
				</FieldGroup>
			</Card>

			<Dialog
				open={isCreateCustomerDialogOpen}
				onOpenChange={(open) => {
					setIsCreateCustomerDialogOpen(open);
					if (!open) {
						quickCustomerForm.reset(QUICK_CUSTOMER_DEFAULT_VALUES);
					}
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Cadastrar cliente rápido</DialogTitle>
						<DialogDescription>
							Cria um cliente pessoa física com dados base (nome, CPF e celular).
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4">
						<FieldGroup>
							<Field className="gap-1">
								<FieldLabel>Nome completo *</FieldLabel>
								<Input {...quickCustomerForm.register("name")} />
								<FieldError error={quickCustomerForm.formState.errors.name} />
							</Field>
						</FieldGroup>

						<div className="grid gap-4 md:grid-cols-2">
							<FieldGroup>
								<Field className="gap-1">
									<FieldLabel>CPF *</FieldLabel>
									<Controller
										control={quickCustomerForm.control}
										name="documentNumber"
										render={({ field, fieldState }) => (
											<>
												<Input
													placeholder="000.000.000-00"
													value={field.value ?? ""}
													onChange={(event) =>
														field.onChange(
															formatDocument({
																type: "CPF",
																value: event.target.value,
															}),
														)
													}
												/>
												<FieldError error={fieldState.error} />
											</>
										)}
									/>
								</Field>
							</FieldGroup>

							<FieldGroup>
								<Field className="gap-1">
									<FieldLabel>Celular</FieldLabel>
									<Controller
										control={quickCustomerForm.control}
										name="phone"
										render={({ field, fieldState }) => (
											<>
												<Input
													placeholder="(00) 00000-0000"
													value={field.value ?? ""}
													onChange={(event) =>
														field.onChange(formatPhone(event.target.value))
													}
												/>
												<FieldError error={fieldState.error} />
											</>
										)}
									/>
								</Field>
							</FieldGroup>
						</div>
					</div>

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => setIsCreateCustomerDialogOpen(false)}
							disabled={isCreatingQuickCustomer}
						>
							Cancelar
						</Button>
						<Button
							type="button"
							onClick={quickCustomerForm.handleSubmit(handleQuickCustomerCreate)}
							disabled={isCreatingQuickCustomer}
						>
							{isCreatingQuickCustomer ? "Cadastrando..." : "Cadastrar cliente"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<div className="flex items-center justify-end gap-3">
				<Button type="button" variant="outline" asChild>
					<Link to="/sales">Cancelar</Link>
				</Button>
				<Button type="submit" disabled={isPending || isLoadingOptions}>
					{isPending
						? "Salvando..."
						: mode === "CREATE"
							? "Salvar venda"
							: "Atualizar venda"}
				</Button>
			</div>
		</form>
	);
}
