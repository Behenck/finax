import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Unit } from "@/schemas/types/unit";
import { MapPin, Trash2 } from "lucide-react";
import { UpdateUnit } from "./update-unit";
import { useApp } from "@/context/app-context";
import { useQueryClient } from "@tanstack/react-query";
import { getOrganizationsSlugCompaniesQueryKey, useDeleteOrganizationsSlugCompaniesCompanyidUnitsUnitid } from "@/http/generated";

interface UnitCardProps {
	companyId: string;
	unit: Unit;
}

export function UnitCard({ companyId, unit }: UnitCardProps) {
	const { organization } = useApp()
	const queryClient = useQueryClient()

	const { mutateAsync: handleDeleteUnit, isPending } = useDeleteOrganizationsSlugCompaniesCompanyidUnitsUnitid();

	async function onDelete(unit: Unit) {
		const confirmed = window.confirm(
			`Deseja realmente excluir a unidade ${unit.name} ?`,
		);
		if (!confirmed) return;
		await handleDeleteUnit({
			slug: organization!.slug,
			companyId,
			unitId: unit.id
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
		<Card className="flex flex-col gap-2 p-2 shadow-none border-none bg-gray-50 sm:flex-row sm:items-center sm:justify-between">
			<div className="flex min-w-0 items-center gap-2">
				<div className="p-2 rounded-xl">
					<MapPin className="size-4" />
				</div>

				<span className="truncate font-medium text-sm">{unit.name}</span>
			</div>

			<div className="flex w-full items-center justify-end gap-1 sm:w-auto">
				<UpdateUnit companyId={companyId} unit={unit} />

				<Button
					variant="ghost"
					size="icon"
					disabled={isPending}
					onClick={() => onDelete(unit)}
				>
					<Trash2 className="text-red-500" />
				</Button>
			</div>
		</Card>
	);
}
