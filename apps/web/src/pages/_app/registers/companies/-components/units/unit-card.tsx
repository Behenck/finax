import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Unit } from "@/schemas/types/unit";
import { formatDocument } from "@/utils/format-document";
import { MapPin, Trash2 } from "lucide-react";
import { UpdateUnit } from "./update-unit";
import { useApp } from "@/context/app-context";
import { useQueryClient } from "@tanstack/react-query";
import { getOrganizationsSlugCompaniesQueryKey, useDeleteOrganizationsSlugCompaniesCompanyidUnitsUnitid } from "@/http/generated";

interface UnitCardProps {
	companyId: string;
	unit: Unit;
}

function buildUnitAddressPreview(unit: Unit) {
	const streetNumber = [unit.street, unit.number].filter(Boolean).join(", ");
	const cityState = [unit.city, unit.state].filter(Boolean).join("/");

	const parts = [streetNumber, unit.neighborhood, cityState, unit.zipCode].filter(
		(Boolean),
	);

	if (parts.length === 0) {
		return null;
	}

	return parts.join(" • ");
}

export function UnitCard({ companyId, unit }: UnitCardProps) {
	const { organization } = useApp()
	const queryClient = useQueryClient()
	const addressPreview = buildUnitAddressPreview(unit);
	const cnpjPreview = unit.cnpj
		? formatDocument({
			type: "CNPJ",
			value: unit.cnpj,
		})
		: null;
	const hasDetails = Boolean(cnpjPreview || addressPreview);

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
		<Card
			className={cn(
				"flex flex-col gap-3 rounded-lg border border-border/70 bg-background px-3 py-3 shadow-none sm:flex-row sm:justify-between",
				hasDetails ? "sm:items-start" : "sm:items-center",
			)}
		>
			<div className="flex min-w-0 flex-1 items-center gap-2.5">
				<div className="rounded-md bg-muted p-2 text-muted-foreground">
					<MapPin className="size-4" />
				</div>

					<div className="flex min-w-0 flex-1 flex-col gap-0.5">
						<span className="truncate font-medium text-sm">{unit.name}</span>
						{cnpjPreview ? (
							<span className="truncate text-xs text-muted-foreground">
								CNPJ: {cnpjPreview}
							</span>
						) : null}
						{addressPreview ? (
							<span className="truncate text-xs text-muted-foreground">
								{addressPreview}
						</span>
					) : null}
				</div>
			</div>

			<div className="flex w-full items-center justify-end gap-1.5 sm:w-auto sm:shrink-0 sm:self-center">
				<UpdateUnit companyId={companyId} unit={unit} />

				<Button
					variant="ghost"
					size="icon"
					disabled={isPending}
					onClick={() => onDelete(unit)}
				>
					<Trash2 className="text-destructive" />
				</Button>
			</div>
		</Card>
	);
}
