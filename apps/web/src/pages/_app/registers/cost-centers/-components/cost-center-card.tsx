import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { CostCenter } from "@/schemas/types/cost-center";
import { Building2, Trash2 } from "lucide-react";
import { UpdateCostCenter } from "./update-cost-center";
import { useApp } from "@/context/app-context";
import { useQueryClient } from "@tanstack/react-query";
import { getOrganizationsSlugCompaniesQueryKey, useDeleteOrganizationsSlugCostcentersCostcenterid } from "@/http/generated";

interface CostCenterCardProps {
	costCenter: CostCenter;
}

export function CostCenterCard({ costCenter }: CostCenterCardProps) {
	const { organization } = useApp()
	const queryClient = useQueryClient()

	const { mutateAsync: handleDeleteCostCenter, isPending } =
		useDeleteOrganizationsSlugCostcentersCostcenterid();

	async function onDelete(costCenter: CostCenter) {
		const confirmed = window.confirm(
			`Deseja realmente excluir o Centro de Custo ${costCenter.name} ?`,
		);
		if (!confirmed) return;
		await handleDeleteCostCenter({
			slug: organization!.slug,
			costCenterId: costCenter.id,
		}, {
			onSuccess: async () => {
				await queryClient.invalidateQueries({
					queryKey: getOrganizationsSlugCompaniesQueryKey({
						slug: organization!.slug,
					}),
				})
			},
		});
	}

	return (
		<Card className="px-6 py-4 rounded-lg flex-1">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex min-w-0 items-center gap-3">
					<div className="p-2 rounded-md bg-green-500/15 text-green-500">
						<Building2 className="size-5" />
					</div>

					<span className="truncate font-medium">{costCenter.name}</span>
				</div>

				<div className="flex w-full items-center justify-end gap-1 sm:w-auto">
					<UpdateCostCenter costCenter={costCenter} />

					<Button
						variant="ghost"
						size="icon"
						disabled={isPending}
						onClick={() => onDelete(costCenter)}
					>
						<Trash2 className="text-red-600" />
					</Button>
				</div>
			</div>
		</Card>
	);
}
