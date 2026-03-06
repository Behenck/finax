import { useNavigate } from "@tanstack/react-router";
import { badgeVariants } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Employee } from "@/schemas/types/employee";

type LinkedUser = NonNullable<Employee["linkedUser"]>;
type LinkedMembership = NonNullable<LinkedUser["membership"]>;

const MEMBER_ROLE_LABEL: Record<LinkedMembership["role"], string> = {
	ADMIN: "Admin",
	MEMBER: "Membro",
	SUPERVISOR: "Supervisor",
	SELLER: "Vendedor",
	PARTNER: "Parceiro",
};

function groupAccesses(accesses: LinkedMembership["accesses"]) {
	return Array.from(
		accesses.reduce(
			(acc, access) => {
				const current = acc.get(access.companyId) ?? {
					companyId: access.companyId,
					companyName: access.companyName,
					fullAccess: false,
					units: [] as string[],
				};

				if (access.unitId === null) {
					current.fullAccess = true;
					current.units = [];
				} else if (!current.fullAccess && access.unitName) {
					current.units.push(access.unitName);
				}

				acc.set(access.companyId, current);
				return acc;
			},
			new Map<
				string,
				{
					companyId: string;
					companyName: string;
					fullAccess: boolean;
					units: string[];
				}
			>(),
		).values(),
	);
}

type EmployeeLinkedUserBadgeProps = {
	linkedUser: LinkedUser;
};

export function EmployeeLinkedUserBadge({
	linkedUser,
}: EmployeeLinkedUserBadgeProps) {
	const navigate = useNavigate();
	const groupedAccesses = linkedUser.membership
		? groupAccesses(linkedUser.membership.accesses)
		: [];

	async function handleClick() {
		await navigate({
			to: "/settings/members",
			search: {
				membersQ: linkedUser.email,
				membersRole: "ALL",
				memberUserId: linkedUser.id,
				memberView: linkedUser.membership ? "access" : undefined,
			},
		});
	}

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<button
					type="button"
					onClick={() => void handleClick()}
					className={cn(
						badgeVariants({ variant: "secondary" }),
						"max-w-[260px] cursor-pointer px-2.5 hover:bg-secondary/80",
					)}
					aria-label={`Abrir acessos de ${linkedUser.name ?? linkedUser.email}`}
				>
					<span className="max-w-full truncate">Acesso ao sistema</span>
				</button>
			</TooltipTrigger>
			<TooltipContent
				side="top"
				sideOffset={8}
				className="max-w-80 rounded-lg px-3 py-2"
			>
				<div className="space-y-2">
					<div className="space-y-0.5">
						<p className="font-medium">
							{linkedUser.name?.trim() || "Usuário sem nome"}
						</p>
						<p className="text-background/80">{linkedUser.email}</p>
					</div>

					{linkedUser.membership ? (
						<div className="space-y-2">
							<p className="text-background/80">
								Permissão: {MEMBER_ROLE_LABEL[linkedUser.membership.role]}
							</p>

							<div className="space-y-1.5">
								<p className="font-medium">Acessos</p>
								{linkedUser.membership.accesses.length === 0 ? (
									<p className="text-background/80">Toda a organização</p>
								) : (
									groupedAccesses.map((group) => (
										<div key={group.companyId} className="leading-relaxed">
											<p className="font-medium">{group.companyName}</p>
											<p className="text-background/80">
												{group.fullAccess
													? "Empresa inteira"
													: group.units.join(", ")}
											</p>
										</div>
									))
								)}
							</div>

							<p className="text-background/70">
								Clique para abrir o membro em Configurações &gt; Membros.
							</p>
						</div>
					) : (
						<p className="leading-relaxed text-background/80">
							Usuário vinculado sem participação nesta organização. Clique
							para abrir a tela de membros.
						</p>
					)}
				</div>
			</TooltipContent>
		</Tooltip>
	);
}
