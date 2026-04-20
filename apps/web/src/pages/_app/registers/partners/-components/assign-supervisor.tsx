import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Check, UserCheck, UserPlus } from "lucide-react";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	getOrganizationsSlugPartnersQueryKey,
	useAssignPartnerSupervisor,
	useGetOrganizationsSlugMembersRole,
	type GetOrganizationsSlugPartners200,
} from "@/http/generated";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface AssignSupervisorProps {
	partner: GetOrganizationsSlugPartners200["partners"][number];
	supervisorPartnerCounts: Record<string, number>;
}

export function AssignSupervisor({
	partner,
	supervisorPartnerCounts,
}: AssignSupervisorProps) {
	const [open, setOpen] = useState(false);

	const { data, isLoading } = useGetOrganizationsSlugMembersRole(
		{
			slug: partner.organization.slug,
			role: "SUPERVISOR",
		},
		{
			query: {
				enabled: open,
			},
		},
	);

	const supervisors = data?.members ?? [];

	const { mutateAsync: assignSupervisor } = useAssignPartnerSupervisor();
	const queryClient = useQueryClient();

	const [selectedSupervisorIds, setSelectedSupervisorIds] = useState<string[]>(
		() => partner.supervisors.map((supervisor) => supervisor.id),
	);

	useEffect(() => {
		if (!open) {
			return;
		}

		setSelectedSupervisorIds(
			partner.supervisors.map((supervisor) => supervisor.id),
		);
	}, [open, partner.supervisors]);

	const hasNoSupervisorSelected = selectedSupervisorIds.length === 0;
	const isSelected = (id: string) => selectedSupervisorIds.includes(id);

	const toggleSupervisor = (id: string) => {
		setSelectedSupervisorIds((currentIds) =>
			currentIds.includes(id)
				? currentIds.filter((currentId) => currentId !== id)
				: [...currentIds, id],
		);
	};

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();

		try {
			await assignSupervisor({
				slug: partner.organization.slug,
				partnerId: partner.id,
				data: {
					supervisorIds: selectedSupervisorIds,
				},
			});

			await queryClient.invalidateQueries({
				queryKey: getOrganizationsSlugPartnersQueryKey({
					slug: partner.organization.slug,
				}),
			});

			toast.success("Supervisores atualizados com sucesso.");
			setOpen(false);
		} catch {
			toast.error("Não foi possível atualizar os supervisores.");
		}
	};

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DropdownMenuItem
				onSelect={(event) => {
					event.preventDefault();
					setOpen(true);
				}}
			>
				<div className="flex gap-4 items-center">
					<UserPlus className="size-3.5 text-foreground" />
					<span className="font-light text-sm">Atribuir Supervisor</span>
				</div>
			</DropdownMenuItem>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Atribuir Supervisor</DialogTitle>
					<DialogDescription>
						Selecione os supervisores para <strong>{partner.name}</strong>.
					</DialogDescription>
				</DialogHeader>
				<form className="space-y-2" onSubmit={handleSubmit}>
					<Card
						onClick={() => setSelectedSupervisorIds([])}
						className={cn(
							"p-3 cursor-pointer flex-row items-center justify-between transition-all hover:bg-muted",
							hasNoSupervisorSelected && "border-green-500 bg-green-500/10",
						)}
					>
						<span className="text-sm">Sem supervisor</span>

						{hasNoSupervisorSelected && (
							<Check className="size-4 text-green-500" />
						)}
					</Card>
					{isLoading ? (
						<p className="rounded-md border border-dashed p-3 text-center text-muted-foreground text-sm">
							Carregando supervisores...
						</p>
					) : null}
					{supervisors.map((supervisor) => {
						const partnersCount =
							supervisorPartnerCounts[supervisor.userId] ?? 0;

						return (
							<Card
								key={supervisor.userId}
								onClick={() => toggleSupervisor(supervisor.userId)}
								className={cn(
									"p-4 flex-row items-center justify-between cursor-pointer transition-all hover:bg-muted",
									isSelected(supervisor.userId) &&
										"border-green-500 bg-green-500/10",
								)}
							>
								<div className="flex gap-4">
									<div className="flex items-center justify-center p-2 w-10 h-10 rounded-full bg-muted-foreground">
										<UserCheck className="size-4 text-muted" />
									</div>
									<div className="flex flex-col">
										<span className="font-medium">{supervisor.name}</span>
										<span className="text-muted-foreground text-xs">
											{supervisor.email}
										</span>
									</div>
								</div>
								<div className="flex items-center gap-2">
									<Badge variant="secondary">
										{partnersCount}{" "}
										{partnersCount === 1 ? "parceiro" : "parceiros"}
									</Badge>
									{isSelected(supervisor.userId) && (
										<Check className="size-4 text-green-500" />
									)}
								</div>
							</Card>
						);
					})}
					{!isLoading && supervisors.length === 0 ? (
						<p className="rounded-md border border-dashed p-3 text-center text-muted-foreground text-sm">
							Nenhum supervisor disponível.
						</p>
					) : null}
					<div className="flex items-center justify-end gap-2 mt-6">
						<DialogClose asChild>
							<Button
								type="button"
								variant="outline"
								onClick={() => setOpen(false)}
							>
								Cancelar
							</Button>
						</DialogClose>
						<Button type="submit">Confirmar</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}
