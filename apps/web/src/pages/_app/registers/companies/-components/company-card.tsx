import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@radix-ui/react-collapsible";
import { Building2, ChevronRight, ChevronUp, Trash2 } from "lucide-react";
import { useState } from "react";
import { UnitCard } from "./units/unit-card";
import type { Company } from "@/schemas/types/company";
import { CreateUnit } from "./units/create-unit";
import { UpdateCompany } from "./update-company";
import { getOrganizationsSlugCompaniesQueryKey, useDeleteOrganizationsSlugCompaniesCompanyid } from "@/http/generated";
import { useApp } from "@/context/app-context";
import { useQueryClient } from "@tanstack/react-query";

interface CompanyCardProps {
	company: Company;
}

export function CompanyCard({ company }: CompanyCardProps) {
	const { organization } = useApp()
	const queryClient = useQueryClient()

	const [isOpen, setIsOpen] = useState(false);
	const { mutateAsync: handleDeleteCompany, isPending } = useDeleteOrganizationsSlugCompaniesCompanyid();

	const units = company.units ?? [];
	const hasUnits = units.length > 0;

	const totalUnits = company.units.length;

	async function onDelete(company: Company) {
		const confirmed = window.confirm(
			`Deseja realmente excluir a empresa ${company.name} ?`,
		);
		if (!confirmed) return;
		await handleDeleteCompany({
			slug: organization!.slug,
			companyId: company.id
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
			<Collapsible open={isOpen} onOpenChange={setIsOpen}>
				<div className="flex items-center justify-between">
					<CollapsibleTrigger className="flex items-center gap-4 cursor-pointer">
						{hasUnits ? (
							isOpen ? (
								<ChevronUp className="size-5 text-gray-500" />
							) : (
								<ChevronRight className="size-5 text-gray-500" />
							)
						) : (
							<div className="size-5" />
						)}

						<div className="flex items-center gap-3">
							<div className="p-2 rounded-md bg-green-100 text-green-500">
								<Building2 className="size-5" />
							</div>

							<span className="font-medium ">{company.name}</span>
						</div>
					</CollapsibleTrigger>

					<div className="flex items-center gap-1">
						{totalUnits > 0 && (
							<div className="px-2 py-1 rounded-sm bg-gray-100 text-gray-500 text-xs">
								<span>
									{totalUnits} {totalUnits === 1 ? "unidade" : "unidades"}
								</span>
							</div>
						)}

						<CreateUnit companyId={company.id} />

						<UpdateCompany company={company} />

						<Button
							variant="ghost"
							size="icon"
							disabled={isPending}
							onClick={() => onDelete(company)}
						>
							<Trash2 className="text-red-600" />
						</Button>
					</div>
				</div>

				{hasUnits && (
					<CollapsibleContent className="mt-2 space-y-2">
						{company.units?.map((unit) => (
							<div key={unit.id} className="ml-8 mr-2">
								<UnitCard
									companyId={company.id}
									unit={unit}
								// isLoading={isPending}
								// onDelete={onDelete}
								/>
							</div>
						))}
					</CollapsibleContent>
				)}
			</Collapsible>
		</Card>
	);
}
