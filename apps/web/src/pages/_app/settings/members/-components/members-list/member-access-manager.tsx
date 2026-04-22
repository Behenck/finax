import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { CardSectionSkeleton } from "@/components/loading-skeletons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";
import {
	type GetOrganizationsSlugPermissionsCatalog200,
	getOrganizationsSlugMembersMemberidPermissionsQueryKey,
	getOrganizationsSlugMembersQueryKey,
	type PutOrganizationsSlugMembersMemberidMutationRequest,
	useGetOrganizationsSlugMembersMemberidPermissions,
	useGetOrganizationsSlugPermissionsCatalog,
	usePutOrganizationsSlugMembersMemberid,
	usePutOrganizationsSlugMembersMemberidPermissions,
} from "@/http/generated";
import { cn } from "@/lib/utils";

import {
	MemberAccessScopePicker,
	type MemberAccessScopeValue,
} from "../member-access-scope-picker";
import { MemberAccessSummary } from "./member-access-summary";
import { getMemberScope } from "./utils";
import type { CompanyOption, MemberListItem } from "./utils/types";

const MODULE_SECTION_LABELS: Record<string, string> = {
	registers: "Cadastros",
	sales: "Vendas",
	settings: "Configurações",
	transactions: "Transações",
};

const MODULE_CARD_LABELS: Record<string, string> = {
	sales: "Vendas",
	"sales.commissions": "Comissões",
	transactions: "Transações",
	"registers.categories": "Categorias",
	"registers.companies": "Empresas",
	"registers.cost-centers": "Centros de custo",
	"registers.customers": "Clientes",
	"registers.employees": "Funcionários",
	"registers.partners": "Parceiros",
	"registers.products": "Produtos",
	"registers.sellers": "Vendedores",
	"registers.units": "Unidades",
	"settings.members": "Membros",
	"settings.organization": "Organização",
	"settings.permissions": "Permissões",
};

const SECTION_ORDER = ["registers", "sales", "transactions", "settings"];

const ACTION_LABELS: Record<string, string> = {
	create: "Criar",
	delete: "Excluir",
	"commissions.create": "Comissões (adicionar)",
	"commissions.update": "Comissões (editar)",
	"commissions.view.all": "Comissões (ver todas)",
	"commissions.installments.status.change": "Parcelas (status)",
	"commissions.installments.update": "Parcelas (editar)",
	"commissions.installments.delete": "Parcelas (excluir)",
	"dashboard.view": "Dashboard",
	"fields.manage": "Campos dinâmicos",
	"import.manage": "Importações",
	manage: "Gerenciar",
	"payment.manage": "Pagamento",
	"recurrences.manage": "Recorrências (gerenciar)",
	"recurrences.view": "Recorrências (visualizar)",
	"status.change": "Alterar status",
	update: "Editar",
	view: "Visualizar",
	"view.all": "Visualizar todos",
};

const PERMISSION_KEY_LABELS: Record<string, string> = {
	"sales.commissions.manage": "Comissões (legado)",
};

type MemberAccessManagerTab = "access" | "permissions";
type PermissionCatalogItem =
	GetOrganizationsSlugPermissionsCatalog200["permissions"][number];

type PermissionCard = {
	id: string;
	title: string;
	permissions: PermissionCatalogItem[];
};

type PermissionModuleSection = {
	id: string;
	title: string;
	cards: PermissionCard[];
};

type Props = {
	member: MemberListItem;
	organizationSlug: string;
	companies: CompanyOption[];
	isLoadingCompanies: boolean;
	canManagePermissions: boolean;
	initialTab?: MemberAccessManagerTab;
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

function toStartCase(value: string) {
	return value
		.split(/[\s._-]+/g)
		.filter(Boolean)
		.map((token) => token.charAt(0).toUpperCase() + token.slice(1))
		.join(" ");
}

function getSectionTitle(sectionKey: string) {
	return MODULE_SECTION_LABELS[sectionKey] ?? toStartCase(sectionKey);
}

function getCardTitle(moduleKey: string) {
	if (MODULE_CARD_LABELS[moduleKey]) {
		return MODULE_CARD_LABELS[moduleKey];
	}

	const [, ...rest] = moduleKey.split(".");
	return rest.length > 0 ? toStartCase(rest.join(" ")) : toStartCase(moduleKey);
}

function getPermissionTitle(permission: PermissionCatalogItem) {
	if (PERMISSION_KEY_LABELS[permission.key]) {
		return PERMISSION_KEY_LABELS[permission.key];
	}

	return ACTION_LABELS[permission.action] ?? toStartCase(permission.action);
}

function chunkBySize<T>(items: T[], size: number): T[][] {
	if (size <= 0) {
		return [items];
	}

	const chunks: T[][] = [];
	for (let index = 0; index < items.length; index += size) {
		chunks.push(items.slice(index, index + size));
	}

	return chunks;
}

function buildPermissionSections(
	permissions: PermissionCatalogItem[],
): PermissionModuleSection[] {
	const sectionById = new Map<
		string,
		{
			id: string;
			title: string;
			cardsById: Map<string, PermissionCard>;
		}
	>();

	for (const permission of permissions) {
		const [sectionId = permission.module] = permission.module.split(".");
		const section = sectionById.get(sectionId) ?? {
			id: sectionId,
			title: getSectionTitle(sectionId),
			cardsById: new Map<string, PermissionCard>(),
		};

		if (!sectionById.has(sectionId)) {
			sectionById.set(sectionId, section);
		}

		const cardId = permission.module;
		const existingCard = section.cardsById.get(cardId);
		if (existingCard) {
			existingCard.permissions.push(permission);
			continue;
		}

		section.cardsById.set(cardId, {
			id: cardId,
			title: getCardTitle(cardId),
			permissions: [permission],
		});
	}

	return Array.from(sectionById.values())
		.map((section) => ({
			id: section.id,
			title: section.title,
			cards: Array.from(section.cardsById.values()),
		}))
		.sort((first, second) => {
			const firstIndex = SECTION_ORDER.indexOf(first.id);
			const secondIndex = SECTION_ORDER.indexOf(second.id);
			if (firstIndex === -1 && secondIndex === -1) {
				return first.title.localeCompare(second.title);
			}
			if (firstIndex === -1) {
				return 1;
			}
			if (secondIndex === -1) {
				return -1;
			}
			return firstIndex - secondIndex;
		});
}

function getErrorMessage(error: unknown, fallback: string) {
	if (!error || typeof error !== "object") {
		return fallback;
	}

	if (!("response" in error)) {
		return fallback;
	}

	const response = (error as { response?: { data?: { message?: unknown } } })
		.response;
	const message = response?.data?.message;
	return typeof message === "string" && message.length > 0 ? message : fallback;
}

export function MemberAccessManager({
	member,
	organizationSlug,
	companies,
	isLoadingCompanies,
	canManagePermissions,
	initialTab = "access",
	open,
	onOpenChange,
}: Props) {
	const queryClient = useQueryClient();
	const [scope, setScope] = useState<MemberAccessScopeValue>(() =>
		getMemberScope(member),
	);
	const [activeTab, setActiveTab] = useState<MemberAccessManagerTab>("access");
	const [permissionStates, setPermissionStates] = useState<
		Record<string, boolean>
	>({});
	const [openCards, setOpenCards] = useState<Record<string, boolean>>({});

	const { mutateAsync: updateMemberAccess, isPending: isSavingAccess } =
		usePutOrganizationsSlugMembersMemberid();
	const {
		mutateAsync: updateMemberPermissions,
		isPending: isSavingPermissions,
	} = usePutOrganizationsSlugMembersMemberidPermissions();

	const { data: permissionCatalogData, isLoading: isLoadingPermissionCatalog } =
		useGetOrganizationsSlugPermissionsCatalog(
			{ slug: organizationSlug },
			{
				query: {
					enabled: open && canManagePermissions,
				},
			},
		);
	const { data: memberPermissionsData, isLoading: isLoadingMemberPermissions } =
		useGetOrganizationsSlugMembersMemberidPermissions(
			{ slug: organizationSlug, memberId: member.id },
			{
				query: {
					enabled: open && canManagePermissions,
				},
			},
		);

	const catalogPermissions = permissionCatalogData?.permissions ?? [];
	const permissionSections = useMemo(
		() => buildPermissionSections(catalogPermissions),
		[catalogPermissions],
	);
	const presetPermissionSet = useMemo(
		() => new Set(memberPermissionsData?.presetPermissions ?? []),
		[memberPermissionsData?.presetPermissions],
	);
	const effectivePermissionSet = useMemo(
		() => new Set(memberPermissionsData?.effectivePermissions ?? []),
		[memberPermissionsData?.effectivePermissions],
	);

	useEffect(() => {
		setScope(getMemberScope(member));
	}, [member, open]);

	useEffect(() => {
		if (!open) {
			setActiveTab("access");
			return;
		}

		if (initialTab === "permissions" && canManagePermissions) {
			setActiveTab("permissions");
			return;
		}

		setActiveTab("access");
	}, [open, initialTab, canManagePermissions, member.id]);

	useEffect(() => {
		if (!open || !canManagePermissions || !memberPermissionsData) {
			return;
		}

		const nextState: Record<string, boolean> = {};
		for (const permission of catalogPermissions) {
			nextState[permission.key] = effectivePermissionSet.has(permission.key);
		}

		setPermissionStates(nextState);
		setOpenCards({});
	}, [
		open,
		canManagePermissions,
		memberPermissionsData,
		catalogPermissions,
		effectivePermissionSet,
		member.id,
	]);

	const isLoadingPermissionsTab =
		canManagePermissions &&
		(isLoadingPermissionCatalog ||
			isLoadingMemberPermissions ||
			!memberPermissionsData);

	const hasPermissionChanges = useMemo(() => {
		if (!memberPermissionsData) {
			return false;
		}

		return catalogPermissions.some((permission) => {
			const currentValue =
				permissionStates[permission.key] ??
				effectivePermissionSet.has(permission.key);
			return currentValue !== effectivePermissionSet.has(permission.key);
		});
	}, [
		memberPermissionsData,
		catalogPermissions,
		permissionStates,
		effectivePermissionSet,
	]);

	const isSaving = isSavingAccess || isSavingPermissions;

	const saveAccessChanges = async () => {
		const data: PutOrganizationsSlugMembersMemberidMutationRequest = {
			role: member.role,
			accessScope: scope,
		};

		await updateMemberAccess({
			slug: organizationSlug,
			memberId: member.id,
			data,
		});

		await queryClient.invalidateQueries({
			queryKey: getOrganizationsSlugMembersQueryKey({
				slug: organizationSlug,
			}),
		});
	};

	const savePermissionChanges = async () => {
		if (!canManagePermissions || !memberPermissionsData) {
			return;
		}

		const overrides = catalogPermissions
			.map((permission) => {
				const desiredAllowed =
					permissionStates[permission.key] ??
					effectivePermissionSet.has(permission.key);
				const presetAllowed = presetPermissionSet.has(permission.key);

				if (desiredAllowed === presetAllowed) {
					return null;
				}

				return {
					permissionKey: permission.key,
					effect: desiredAllowed ? "ALLOW" : "DENY",
				} as const;
			})
			.filter(
				(
					override,
				): override is { permissionKey: string; effect: "ALLOW" | "DENY" } =>
					Boolean(override),
			)
			.sort((first, second) =>
				first.permissionKey.localeCompare(second.permissionKey),
			);

		await updateMemberPermissions({
			slug: organizationSlug,
			memberId: member.id,
			data: {
				overrides,
			},
		});

		await Promise.all([
			queryClient.invalidateQueries({
				queryKey: getOrganizationsSlugMembersMemberidPermissionsQueryKey({
					slug: organizationSlug,
					memberId: member.id,
				}),
			}),
			queryClient.invalidateQueries({
				queryKey: ["session"],
			}),
		]);
	};

	const handleSave = async () => {
		try {
			if (activeTab === "permissions") {
				if (hasPermissionChanges) {
					await savePermissionChanges();
				}

				if (hasPermissionChanges) {
					toast.success("Permissões atualizadas com sucesso.");
					onOpenChange(false);
				}

				return;
			}

			await saveAccessChanges();
			toast.success("Acessos do membro atualizados com sucesso.");
			onOpenChange(false);
		} catch (error) {
			toast.error(
				getErrorMessage(
					error,
					activeTab === "permissions"
						? "Erro ao atualizar permissões do membro."
						: "Erro ao atualizar acessos do membro.",
				),
			);
		}
	};

	const saveButtonLabel =
		activeTab === "permissions" ? "Salvar permissões" : "Salvar acessos";
	const saveButtonDisabled =
		isSaving ||
		(activeTab === "access" && isLoadingCompanies) ||
		(activeTab === "permissions" &&
			(!canManagePermissions ||
				isLoadingPermissionsTab ||
				!hasPermissionChanges));

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="flex h-[92vh] w-[calc(80vw)] max-w-[calc(100vw-2rem)] flex-col overflow-hidden p-0 sm:w-[min(98vw,1800px)] sm:max-w-[min(75vw,1800px)]">
				<DialogHeader className="px-6 pt-6">
					<DialogTitle>Gerenciar acessos</DialogTitle>
					<DialogDescription>
						Defina empresas/unidades e permissões de{" "}
						<strong>{member.name ?? member.email}</strong>.
					</DialogDescription>
				</DialogHeader>

				<div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 pb-4">
					<Card className="p-4 space-y-2">
						<div className="flex flex-col">
							<span className="text-sm font-medium">
								{member.name ?? "Sem nome"}
							</span>
							<span className="text-xs text-muted-foreground">
								{member.email}
							</span>
						</div>
						<div className="flex flex-wrap gap-2">
							<Badge variant="secondary">{member.role}</Badge>
							<MemberAccessSummary member={member} />
							{canManagePermissions && memberPermissionsData ? (
								<>
									<Badge variant="outline">
										Efetivas:{" "}
										{memberPermissionsData.effectivePermissions.length}
									</Badge>
									<Badge variant="outline">
										Overrides: {memberPermissionsData.overrides.length}
									</Badge>
								</>
							) : null}
						</div>
					</Card>

					<Tabs
						value={activeTab}
						onValueChange={(value) =>
							setActiveTab(value as MemberAccessManagerTab)
						}
						className="space-y-3 pb-4"
					>
						<TabsList
							variant="underline"
							className="h-auto w-full justify-start rounded-none border-b p-0"
						>
							<TabsTab
								value="access"
								className="group relative rounded-none border-none p-3 text-sm font-medium text-muted-foreground hover:bg-transparent! shrink-0"
							>
								Acessos
							</TabsTab>
							{canManagePermissions ? (
								<TabsTab
									value="permissions"
									className="group relative rounded-none border-none p-3 text-sm font-medium text-muted-foreground hover:bg-transparent! shrink-0"
								>
									Permissões
								</TabsTab>
							) : null}
						</TabsList>

						<TabsPanel value="access" className="space-y-4">
							{isLoadingCompanies ? (
								<CardSectionSkeleton
									rows={3}
									cardClassName="border-dashed p-4 shadow-none"
								/>
							) : (
								<MemberAccessScopePicker
									companies={companies}
									value={scope}
									onChange={setScope}
								/>
							)}
						</TabsPanel>

						{canManagePermissions ? (
							<TabsPanel value="permissions" className="space-y-4">
								{isLoadingPermissionsTab ? (
									<CardSectionSkeleton
										rows={4}
										cardClassName="border-dashed p-4 shadow-none"
									/>
								) : permissionSections.length === 0 ? (
									<div className="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">
										Nenhuma permissão ativa encontrada para esta organização.
									</div>
								) : (
									<div className="space-y-5">
										{permissionSections.map((section) => (
											<div key={section.id} className="space-y-3">
												<h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
													{section.title}
												</h3>

												<div className="space-y-3">
													{section.cards.map((card) => {
														const cardStateKey = `${section.id}:${card.id}`;
														const isOpen = openCards[cardStateKey] ?? false;
														const permissionRows = chunkBySize(
															card.permissions,
															3,
														);
														const cardPermissionKeys = card.permissions.map(
															(permission) => permission.key,
														);
														const enabledPermissionsInCardCount =
															cardPermissionKeys.filter(
																(permissionKey) =>
																	permissionStates[permissionKey] ??
																	effectivePermissionSet.has(permissionKey),
															).length;
														const hasCardPermissions =
															cardPermissionKeys.length > 0;
														const isCardFullyEnabled =
															hasCardPermissions &&
															enabledPermissionsInCardCount ===
																cardPermissionKeys.length;

														return (
															<Card
																key={card.id}
																className="overflow-hidden p-0"
															>
																<Collapsible
																	open={isOpen}
																	onOpenChange={(nextOpen) =>
																		setOpenCards((previousState) => ({
																			...previousState,
																			[cardStateKey]: nextOpen,
																		}))
																	}
																>
																	<div className="flex items-center gap-3 px-3 py-2.5">
																		<CollapsibleTrigger className="-mx-1.5 -my-1.5 flex min-w-0 flex-1 items-center justify-between rounded-sm px-1.5 py-1.5 text-left hover:bg-muted/30">
																			<span className="truncate text-sm font-medium">
																				{card.title}
																			</span>
																			<ChevronDown
																				className={cn(
																					"size-4 shrink-0 text-muted-foreground transition-transform",
																					isOpen && "rotate-180",
																				)}
																			/>
																		</CollapsibleTrigger>

																		<div className="flex items-center gap-2">
																			<span className="text-xs text-muted-foreground">
																				{enabledPermissionsInCardCount}/
																				{cardPermissionKeys.length}
																			</span>
																			<span className="text-xs text-muted-foreground">
																				Tudo
																			</span>
																			<Switch
																				checked={isCardFullyEnabled}
																				disabled={!hasCardPermissions}
																				onCheckedChange={(checked) =>
																					setPermissionStates(
																						(previousState) => {
																							const nextState = {
																								...previousState,
																							};
																							for (const permissionKey of cardPermissionKeys) {
																								nextState[permissionKey] =
																									checked;
																							}
																							return nextState;
																						},
																					)
																				}
																				aria-label={`Habilitar todas as permissões de ${card.title}`}
																			/>
																		</div>
																	</div>
																	<CollapsibleContent className="pb-3">
																		<div className="space-y-3 px-3">
																			{permissionRows.map(
																				(permissionRow, rowIndex) => (
																					<div
																						key={`${card.id}-row-${rowIndex}`}
																						className="space-y-3"
																					>
																						{rowIndex > 0 ? (
																							<Separator />
																						) : null}
																						<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
																							{permissionRow.map(
																								(permission) => (
																									<div
																										key={permission.key}
																										className="p-3"
																									>
																										<div className="flex items-start justify-between gap-3">
																											<div className="space-y-0.5">
																												<p className="text-sm font-medium">
																													{getPermissionTitle(
																														permission,
																													)}
																												</p>
																												<p className="text-xs text-muted-foreground">
																													{permission.description ??
																														permission.key}
																												</p>
																											</div>
																											<Switch
																												checked={
																													permissionStates[
																														permission.key
																													] ??
																													effectivePermissionSet.has(
																														permission.key,
																													)
																												}
																												onCheckedChange={(
																													checked,
																												) =>
																													setPermissionStates(
																														(
																															previousState,
																														) => ({
																															...previousState,
																															[permission.key]:
																																checked,
																														}),
																													)
																												}
																												aria-label={`Ativar permissão ${permission.key}`}
																											/>
																										</div>
																									</div>
																								),
																							)}
																						</div>
																					</div>
																				),
																			)}
																		</div>
																	</CollapsibleContent>
																</Collapsible>
															</Card>
														);
													})}
												</div>
											</div>
										))}
									</div>
								)}
							</TabsPanel>
						) : null}
					</Tabs>
				</div>

				<Separator />
				<DialogFooter className="px-6 pb-6">
					<Button
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={isSaving}
					>
						Cancelar
					</Button>
					<Button onClick={handleSave} disabled={saveButtonDisabled}>
						{isSaving ? "Salvando..." : saveButtonLabel}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
