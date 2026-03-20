import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Table,
	TableBody,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { useApp } from "@/context/app-context";
import { roleFilterParser, textFilterParser } from "@/hooks/filters/parsers";
import { useMemo } from "react";
import {
	useGetOrganizationsSlugCompanies,
	useGetOrganizationsSlugMembers,
} from "@/http/generated";
import { useQueryState } from "nuqs";
import { useAbility } from "@/permissions/access";

import { MemberRow } from "./member-row";
import type { MemberListItem, RoleFilter } from "./utils/types";
import { filterMembers } from "./utils";
import { MEMBER_ROLE_OPTIONS } from "./utils/constants";

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

export function MembersList() {
	const ability = useAbility();
	const { auth, organization } = useApp();
	const canManageMembers = ability.can("access", "settings.members.manage");
	const [search, setSearch] = useQueryState("membersQ", textFilterParser);
	const [roleFilter, setRoleFilter] = useQueryState(
		"membersRole",
		roleFilterParser,
	);
	const organizationSlug = organization?.slug ?? "";

	const {
		data,
		isLoading: isLoadingMembers,
		error: membersError,
	} = useGetOrganizationsSlugMembers({ slug: organizationSlug });
	const { data: companiesData, isLoading: isLoadingCompanies } =
		useGetOrganizationsSlugCompanies({
			slug: organizationSlug,
		});

	const members = data?.members as MemberListItem[] | undefined;
	const companies = companiesData?.companies ?? [];

	const filteredMembers = useMemo(
		() => filterMembers(members, search, roleFilter),
		[members, roleFilter, search],
	);

	const totalMembers = members?.length ?? 0;
	const hasActiveFilter = search.trim().length > 0 || roleFilter !== "ALL";
	const hasMembersError = Boolean(membersError);
	const membersErrorMessage = hasMembersError
		? getErrorMessage(
				membersError,
				"Não foi possível carregar os membros da organização.",
			)
		: null;

	if (!organization) return null;

	return (
		<div className="space-y-3">
			<div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_180px]">
				<Input
					placeholder="Buscar por nome ou email"
					value={search}
					onChange={(e) => setSearch(e.target.value)}
				/>
				<Select
					value={roleFilter}
					onValueChange={(value) => setRoleFilter(value as RoleFilter)}
				>
					<SelectTrigger className="w-full">
						<SelectValue placeholder="Permissão" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="ALL">Todas permissões</SelectItem>
						{MEMBER_ROLE_OPTIONS.map((role) => (
							<SelectItem key={role.value} value={role.value}>
								{role.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			<div className="space-y-3">
				{isLoadingMembers ? (
					<div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
						Carregando membros...
					</div>
				) : hasMembersError ? (
					<div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
						{membersErrorMessage}
					</div>
				) : (
					<>
						{canManageMembers ? (
							<div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/20 px-4 py-3">
								<Checkbox />
								<Label className="text-xs text-muted-foreground">
									Selecionar todos ({filteredMembers.length} de {totalMembers})
								</Label>
							</div>
						) : null}

						<div className="space-y-2 px-1 py-1 md:hidden">
							{filteredMembers.map((member) => (
								<MemberRow
									key={member.id}
									member={member}
									ownerId={organization.ownerId}
									authUserId={auth?.id}
									organizationSlug={organizationSlug}
									companies={companies}
									isLoadingCompanies={isLoadingCompanies}
									showSelection={canManageMembers}
								/>
							))}
						</div>

						<div className="hidden overflow-hidden rounded-xl border bg-background md:block">
							<Table>
								<TableHeader>
									<TableRow className="bg-muted/40 hover:bg-muted/40">
										<TableHead className="h-12 px-3 text-xs uppercase tracking-wide text-muted-foreground">
											Membro
										</TableHead>
										<TableHead className="h-12 px-3 text-center text-xs uppercase tracking-wide text-muted-foreground">
											Acessos
										</TableHead>
										<TableHead className="h-12 px-3 text-center text-xs uppercase tracking-wide text-muted-foreground">
											Permissão
										</TableHead>
										<TableHead className="h-12 px-3 text-right text-xs uppercase tracking-wide text-muted-foreground">
											Ações
										</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{filteredMembers.map((member) => (
										<MemberRow
											key={member.id}
											member={member}
											ownerId={organization.ownerId}
											authUserId={auth?.id}
											organizationSlug={organizationSlug}
											companies={companies}
											isLoadingCompanies={isLoadingCompanies}
											showSelection={canManageMembers}
										/>
									))}
								</TableBody>
							</Table>
						</div>
					</>
				)}
			</div>

			{!isLoadingMembers && !hasMembersError && filteredMembers.length === 0 && (
				<div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
					{hasActiveFilter
						? "Nenhum membro encontrado com os filtros atuais."
						: "Nenhum membro disponível na organização."}
				</div>
			)}
		</div>
	);
}
