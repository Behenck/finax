import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { FieldError as FormFieldError } from "@/components/field-error";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApp } from "@/context/app-context";
import { resolveErrorMessage } from "@/errors";
import { normalizeApiError } from "@/errors/api-error";
import {
	getOrganizationsSlugProductsQueryKey,
	useGetOrganizationsSlugCompanies,
	useGetOrganizationsSlugMembersRole,
	useGetOrganizationsSlugPartners,
	useGetOrganizationsSlugProductsIdCommissionScenarios,
	useGetOrganizationsSlugSellers,
	usePostOrganizationsSlugProducts,
	usePutOrganizationsSlugProductsId,
	usePutOrganizationsSlugProductsIdCommissionScenarios,
} from "@/http/generated";
import { type ProductFormData, productSchema } from "@/schemas/product-schema";
import type { ProductListItem } from "@/schemas/types/product";
import { CirclePlus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ScenarioTabContent } from "./-components/scenario-tab-content";
import {
	createDefaultScenario,
	distributeInstallments,
	mapApiScenarioToForm,
	mapScenariosToPayload,
} from "./-utils/helpers";
import type { SelectOption } from "./-utils/types";

interface ProductFormProps {
	onSuccess?: () => void;
	mode?: "create" | "edit";
	initialData?: ProductListItem;
	fixedParentId?: string;
}

export function ProductForm({
	onSuccess,
	mode = "create",
	initialData,
	fixedParentId,
}: ProductFormProps) {
	const { organization } = useApp();
	const queryClient = useQueryClient();
	const initializedFromApiRef = useRef(false);

	const { mutateAsync: createProduct, isPending: isCreating } =
		usePostOrganizationsSlugProducts();
	const { mutateAsync: updateProduct, isPending: isUpdating } =
		usePutOrganizationsSlugProductsId();
	const { mutateAsync: replaceCommissionScenarios, isPending: isSavingScenarios } =
		usePutOrganizationsSlugProductsIdCommissionScenarios();

	const isEditMode = mode === "edit" && !!initialData;

	const { data: companiesData } = useGetOrganizationsSlugCompanies(
		{ slug: organization?.slug ?? "" },
		{ query: { enabled: !!organization?.slug } },
	);

	const { data: sellersData } = useGetOrganizationsSlugSellers(
		{ slug: organization?.slug ?? "" },
		{ query: { enabled: !!organization?.slug } },
	);

	const { data: partnersData } = useGetOrganizationsSlugPartners(
		{ slug: organization?.slug ?? "" },
		{ query: { enabled: !!organization?.slug } },
	);

	const { data: supervisorsData } = useGetOrganizationsSlugMembersRole(
		{ slug: organization?.slug ?? "", role: "SUPERVISOR" },
		{ query: { enabled: !!organization?.slug } },
	);

	const { data: scenariosData, isLoading: isLoadingScenarios } =
		useGetOrganizationsSlugProductsIdCommissionScenarios(
			{ slug: organization?.slug ?? "", id: initialData?.id ?? "" },
			{
				query: {
					enabled: !!organization?.slug && !!initialData?.id && isEditMode,
				},
			},
		);

	const form = useForm<ProductFormData>({
		resolver: zodResolver(productSchema),
		defaultValues: {
			name: initialData?.name ?? "",
			scenarios: [],
		},
	});

	const {
		handleSubmit,
		control,
		reset,
		setValue,
		getValues,
		formState: { errors },
	} = form;

	const {
		fields: scenarioFields,
		append: appendScenario,
		remove: removeScenario,
	} = useFieldArray({
		control,
		name: "scenarios",
	});

	const scenarioValues = useWatch({ control, name: "scenarios" }) ?? [];

	const [activeScenarioTab, setActiveScenarioTab] = useState("");
	const isPending = isCreating || isUpdating || isSavingScenarios;
	const resolvedActiveScenarioTab = scenarioFields.some(
		(_, scenarioIndex) => `scenario-${scenarioIndex}` === activeScenarioTab,
	)
		? activeScenarioTab
		: scenarioFields.length > 0
			? "scenario-0"
			: "";

	const companyOptions = useMemo<SelectOption[]>(() => {
		const companies = companiesData?.companies ?? [];
		return companies.map((company) => ({
			id: company.id,
			label: company.name,
		}));
	}, [companiesData?.companies]);

	const unitOptions = useMemo<SelectOption[]>(() => {
		const companies = companiesData?.companies ?? [];
		return companies.flatMap((company) =>
			company.units.map((unit) => ({
				id: unit.id,
				label: `${company.name} -> ${unit.name}`,
			})),
		);
	}, [companiesData?.companies]);

	const sellerOptions = useMemo<SelectOption[]>(() => {
		const sellers = sellersData?.sellers ?? [];
		return sellers
			.filter((seller) => seller.status === "ACTIVE")
			.map((seller) => ({
				id: seller.id,
				label: seller.name,
			}));
	}, [sellersData?.sellers]);

	const partnerOptions = useMemo<SelectOption[]>(() => {
		const partners = partnersData?.partners ?? [];
		return partners.map((partner) => ({
			id: partner.id,
			label: partner.name,
		}));
	}, [partnersData?.partners]);

	const supervisorOptions = useMemo<SelectOption[]>(() => {
		const members = supervisorsData?.members ?? [];
		return members.map((member) => ({
			id: member.id,
			label: member.name ?? member.email,
		}));
	}, [supervisorsData?.members]);

	useEffect(() => {
		if (!isEditMode || !initialData || !scenariosData) return;
		if (initializedFromApiRef.current) return;

		reset({
			name: initialData.name,
			scenarios:
				scenariosData.scenarios.length > 0
					? scenariosData.scenarios.map(mapApiScenarioToForm)
					: [],
		});
		initializedFromApiRef.current = true;
	}, [initialData, isEditMode, reset, scenariosData]);

	useEffect(() => {
		if (mode === "create") {
			initializedFromApiRef.current = false;
		}
	}, [mode]);

	const invalidateProducts = async () => {
		await queryClient.invalidateQueries({
			queryKey: getOrganizationsSlugProductsQueryKey({
				slug: organization!.slug,
			}),
		});
	};

	const handleAddScenario = () => {
		const nextIndex = scenarioFields.length;
		appendScenario(createDefaultScenario(`Cenário ${nextIndex + 1}`));
		setActiveScenarioTab(`scenario-${nextIndex}`);
	};

	const handleRemoveScenario = (index: number) => {
		const nextLength = scenarioFields.length - 1;
		removeScenario(index);
		if (nextLength <= 0) {
			setActiveScenarioTab("");
			return;
		}

		const nextTabIndex = index >= nextLength ? nextLength - 1 : index;
		setActiveScenarioTab(`scenario-${nextTabIndex}`);
	};

	const handleInstallmentCountChange = (
		scenarioIndex: number,
		commissionIndex: number,
		nextCount: number,
	) => {
		const totalPercentage = getValues(
			`scenarios.${scenarioIndex}.commissions.${commissionIndex}.totalPercentage`,
		);
		setValue(
			`scenarios.${scenarioIndex}.commissions.${commissionIndex}.installments`,
			distributeInstallments(totalPercentage, nextCount),
			{
				shouldDirty: true,
				shouldValidate: true,
			},
		);
	};

	const saveProductCommissionScenarios = async (
		productId: string,
		scenarios: ProductFormData["scenarios"],
	) => {
		await replaceCommissionScenarios({
			slug: organization!.slug,
			id: productId,
			data: {
				scenarios: mapScenariosToPayload(scenarios),
			},
		});
	};

	const onSubmit = async (data: ProductFormData) => {
		const name = data.name.trim();

		if (!isEditMode) {
			let createdProductId: string;
			try {
				const createdProduct = await createProduct({
					slug: organization!.slug,
					data: {
						name,
						description: null,
						parentId: fixedParentId ?? null,
					},
				});
				createdProductId = createdProduct.productId;
			} catch (error) {
				const message = resolveErrorMessage(normalizeApiError(error));
				toast.error(message);
				return;
			}

			try {
				if (data.scenarios.length > 0) {
					await saveProductCommissionScenarios(createdProductId, data.scenarios);
				}
				await invalidateProducts();
				toast.success("Produto cadastrado com sucesso");
				onSuccess?.();
			} catch (error) {
				await invalidateProducts();
				const message = resolveErrorMessage(normalizeApiError(error));
				toast.error(
					`Produto cadastrado, mas as comissões não foram salvas. ${message}. Edite o produto para concluir a configuração.`,
				);
				onSuccess?.();
			}
			return;
		}

		if (!initialData) return;

		try {
			await updateProduct({
				slug: organization!.slug,
				id: initialData.id,
				data: {
					name,
					description: initialData.description ?? null,
					parentId: initialData.parentId,
					isActive: initialData.isActive,
					sortOrder: initialData.sortOrder,
				},
			});
		} catch (error) {
			const message = resolveErrorMessage(normalizeApiError(error));
			toast.error(message);
			return;
		}

		try {
			await saveProductCommissionScenarios(initialData.id, data.scenarios);
			await invalidateProducts();
			toast.success("Produto atualizado com sucesso");
			onSuccess?.();
		} catch (error) {
			await invalidateProducts();
			const message = resolveErrorMessage(normalizeApiError(error));
			toast.error(
				`Produto atualizado, mas as comissões não foram salvas. ${message}. Ajuste os dados e tente novamente.`,
			);
		}
	};

	return (
		<form
			onSubmit={handleSubmit(onSubmit)}
			className="space-y-6 py-4 [&_[data-slot=label]]:font-normal [&_span]:font-normal"
		>
			<div className="grid gap-3">
				<FieldGroup>
					<Field className="gap-1">
						<FieldLabel htmlFor="product-name">Nome</FieldLabel>
						<Controller
							name="name"
							control={control}
							render={({ field, fieldState }) => (
								<>
									<Input
										{...field}
										id="product-name"
										type="text"
										placeholder="Digite o nome do produto"
									/>
									<FormFieldError error={fieldState.error} />
								</>
							)}
						/>
					</Field>
				</FieldGroup>
			</div>

			<div className="space-y-4">
				<div className="flex items-center justify-between">
					<span className="text-sm font-normal">Cenários de comissão</span>
					<Button
						type="button"
						variant="outline"
						className="font-normal"
						onClick={handleAddScenario}
					>
						<CirclePlus />
						Adicionar cenário
					</Button>
				</div>

				<div className="max-h-[60vh] overflow-y-auto pr-1">
					{isEditMode && isLoadingScenarios ? (
						<Card className="p-4">
							<span className="text-muted-foreground text-sm">
								Carregando cenários de comissão...
							</span>
						</Card>
					) : scenarioFields.length === 0 ? (
						<Card className="p-4">
							<span className="text-muted-foreground text-sm">
								Nenhum cenário configurado. Clique em "Adicionar cenário" para criar.
							</span>
						</Card>
					) : (
						<Tabs
							value={resolvedActiveScenarioTab}
							onValueChange={setActiveScenarioTab}
						>
							<TabsList className="w-full justify-start rounded-sm **:data-[slot=tab-indicator]:rounded-sm p-1 bg-gray-200">
								{scenarioFields.map((scenarioField, scenarioIndex) => {
									const tabName = scenarioValues[scenarioIndex]?.name?.trim();
									const label = tabName || `Cenário ${scenarioIndex + 1}`;

									return (
										<TabsTrigger
											key={scenarioField.id}
											value={`scenario-${scenarioIndex}`}
											className="grow-0 rounded-sm font-normal"
										>
											{label}
										</TabsTrigger>
									);
								})}
							</TabsList>

							{scenarioFields.map((scenarioField, scenarioIndex) => (
								<TabsContent
									key={scenarioField.id}
									value={`scenario-${scenarioIndex}`}
								>
									<ScenarioTabContent
										control={control}
										errors={errors}
										scenarioIndex={scenarioIndex}
										companyOptions={companyOptions}
										partnerOptions={partnerOptions}
										unitOptions={unitOptions}
										sellerOptions={sellerOptions}
										supervisorOptions={supervisorOptions}
										setValue={setValue}
										getValues={getValues}
										canRemove
										onRemoveScenario={handleRemoveScenario}
										onInstallmentCountChange={handleInstallmentCountChange}
									/>
								</TabsContent>
							))}
						</Tabs>
					)}
				</div>
			</div>

			<div className="flex justify-end gap-2">
				<Button type="submit" disabled={isPending}>
					{isPending ? "Salvando..." : "Salvar"}
				</Button>
			</div>
		</form>
	);
}
