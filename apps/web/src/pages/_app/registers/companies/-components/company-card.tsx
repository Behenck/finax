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
import { formatDocument } from "@/utils/format-document";
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
	const cnpjPreview = company.cnpj
		? formatDocument({
			type: "CNPJ",
			value: company.cnpj,
		})
		: null;

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
		<Card className="flex-1 rounded-xl border-border/70 bg-card px-4 py-4 sm:px-5">
			<Collapsible open={isOpen} onOpenChange={setIsOpen}>
				<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
					<CollapsibleTrigger className="flex min-w-0 flex-1 items-center gap-3 cursor-pointer text-left">
						{hasUnits ? (
							isOpen ? (
								<ChevronUp className="size-5 text-muted-foreground" />
							) : (
								<ChevronRight className="size-5 text-muted-foreground" />
							)
						) : (
							<div className="size-5" />
						)}

						<div className="flex min-w-0 items-center gap-3">
							<div className="rounded-md bg-emerald-500/15 p-2 text-emerald-600 dark:text-emerald-400">
								<Building2 className="size-5" />
							</div>

							<div className="min-w-0">
								<p className="truncate text-sm font-semibold text-foreground">
									{company.name}
								</p>
								{cnpjPreview ? (
									<p className="text-xs text-muted-foreground">
										CNPJ: {cnpjPreview}
									</p>
								) : null}
								{totalUnits > 0 ? (
									<p className="text-xs text-muted-foreground">
										{totalUnits} {totalUnits === 1 ? "unidade" : "unidades"}
									</p>
								) : null}
							</div>
						</div>
					</CollapsibleTrigger>

					<div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto sm:self-center">
						{totalUnits > 0 && (
							<div className="rounded-full border border-border bg-muted px-2.5 py-1 text-xs text-muted-foreground">
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
					<CollapsibleContent className="mt-4 border-t border-border/70 pt-4">
						<div className="space-y-2.5 pl-8 sm:pl-10">
							{company.units?.map((unit) => (
								<UnitCard
									key={unit.id}
									companyId={company.id}
									unit={unit}
								/>
							))}
						</div>
					</CollapsibleContent>
				)}
			</Collapsible>
		</Card>
	);
}
