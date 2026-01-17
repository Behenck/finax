import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useDeleteUnit } from "@/hooks/units/use-delete-unit";
import type { Unit } from "@/schemas/types/unit";
import { MapPin, Pencil, Trash2 } from "lucide-react";
import { UpdateUnit } from "./update-unit";

interface UnitCardProps {
	companyId: string;
	unit: Unit;
}

export function UnitCard({ companyId, unit }: UnitCardProps) {
	const { mutateAsync: handleDeleteUnit, isPending } = useDeleteUnit();

	async function onDelete(unit: Unit) {
		const confirmed = window.confirm(
			`Deseja realmente excluir a unidade ${unit.name} ?`,
		);
		if (!confirmed) return;
		await handleDeleteUnit({ companyId, unitId: unit.id });
	}
	return (
		<Card className="flex flex-row items-center justify-between gap-2 p-2 shadow-none border-none bg-gray-50">
			<div className="flex items-center gap-2">
				<div className="p-2 rounded-xl">
					<MapPin className="size-4" />
				</div>

				<span className="font-medium text-sm">{unit.name}</span>
			</div>

			<div className="flex items-center gap-1">
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
