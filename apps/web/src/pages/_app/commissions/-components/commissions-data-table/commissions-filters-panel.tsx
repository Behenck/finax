import { RefreshCcw } from "lucide-react";
import { ptBR } from "date-fns/locale";
import { FilterPanel } from "@/components/filter-panel";
import { Button } from "@/components/ui/button";
import { CalendarDateInput } from "@/components/ui/calendar-date-input";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type { GetOrganizationsSlugCommissionsInstallmentsQueryParamsStatusEnumKey } from "@/http/generated";
import type { ProductOption } from "./types";

interface EntityOption {
	id: string;
	name: string;
}

interface CommissionsFiltersPanelProps {
	searchFilter: string;
	companyIdFilter: string;
	unitIdFilter: string;
	productIdFilter: string;
	statusFilter: GetOrganizationsSlugCommissionsInstallmentsQueryParamsStatusEnumKey;
	effectiveExpectedFrom: string;
	effectiveExpectedTo: string;
	companies: EntityOption[];
	unitsBySelectedCompany: EntityOption[];
	productOptions: ProductOption[];
	onSearchChange: (value: string) => void;
	onCompanyIdChange: (value: string) => void;
	onUnitIdChange: (value: string) => void;
	onProductIdChange: (value: string) => void;
	onStatusChange: (
		value: GetOrganizationsSlugCommissionsInstallmentsQueryParamsStatusEnumKey,
	) => void;
	onExpectedFromChange: (value: string) => void;
	onExpectedToChange: (value: string) => void;
	onClearFilters: () => void;
}

export function CommissionsFiltersPanel({
	searchFilter,
	companyIdFilter,
	unitIdFilter,
	productIdFilter,
	statusFilter,
	effectiveExpectedFrom,
	effectiveExpectedTo,
	companies,
	unitsBySelectedCompany,
	productOptions,
	onSearchChange,
	onCompanyIdChange,
	onUnitIdChange,
	onProductIdChange,
	onStatusChange,
	onExpectedFromChange,
	onExpectedToChange,
	onClearFilters,
}: CommissionsFiltersPanelProps) {
	return (
		<FilterPanel className="xl:grid-cols-10 xl:items-end">
			<div className="space-y-1 xl:col-span-2">
				<p className="text-xs text-muted-foreground">Busca</p>
				<Input
					placeholder="Cliente, produto, empresa, beneficiário..."
					value={searchFilter}
					onChange={(event) => onSearchChange(event.target.value)}
				/>
			</div>

			<div className="space-y-1">
				<p className="text-xs text-muted-foreground">Empresa</p>
				<SearchableSelect
					options={companies.map((company) => ({
						value: company.id,
						label: company.name,
					}))}
					value={companyIdFilter || "ALL"}
					onValueChange={(value) =>
						onCompanyIdChange(value === "ALL" ? "" : value)
					}
					placeholder="Todas as empresas"
					searchPlaceholder="Buscar empresa..."
					emptyMessage="Nenhuma empresa encontrada."
					clearOption={{ value: "ALL", label: "Todas as empresas" }}
				/>
			</div>

			<div className="space-y-1">
				<p className="text-xs text-muted-foreground">Unidade</p>
				<SearchableSelect
					options={unitsBySelectedCompany.map((unit) => ({
						value: unit.id,
						label: unit.name,
					}))}
					value={unitIdFilter || "ALL"}
					onValueChange={(value) =>
						onUnitIdChange(value === "ALL" ? "" : value)
					}
					disabled={!companyIdFilter}
					placeholder="Todas as unidades"
					searchPlaceholder="Buscar unidade..."
					emptyMessage="Nenhuma unidade encontrada."
					clearOption={{ value: "ALL", label: "Todas as unidades" }}
				/>
			</div>

			<div className="space-y-1">
				<p className="text-xs text-muted-foreground">Produto</p>
				<SearchableSelect
					options={productOptions.map((product) => ({
						value: product.id,
						label: product.label,
					}))}
					value={productIdFilter || "ALL"}
					onValueChange={(value) =>
						onProductIdChange(value === "ALL" ? "" : value)
					}
					placeholder="Todos os produtos"
					searchPlaceholder="Buscar produto..."
					emptyMessage="Nenhum produto encontrado."
					clearOption={{ value: "ALL", label: "Todos os produtos" }}
				/>
			</div>

			<div className="space-y-1">
				<p className="text-xs text-muted-foreground">Status</p>
				<Select
					value={statusFilter}
					onValueChange={(value) =>
						onStatusChange(
							value as GetOrganizationsSlugCommissionsInstallmentsQueryParamsStatusEnumKey,
						)
					}
				>
					<SelectTrigger className="w-full">
						<SelectValue placeholder="Status" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="ALL">Todos</SelectItem>
						<SelectItem value="PENDING">Pendente</SelectItem>
						<SelectItem value="PAID">Paga</SelectItem>
						<SelectItem value="CANCELED">Cancelada</SelectItem>
						<SelectItem value="REVERSED">Estornada</SelectItem>
					</SelectContent>
				</Select>
			</div>

			<div className="space-y-1">
				<p className="text-xs text-muted-foreground">Previsão de</p>
				<CalendarDateInput
					value={effectiveExpectedFrom}
					onChange={onExpectedFromChange}
					locale={ptBR}
				/>
			</div>

			<div className="space-y-1">
				<p className="text-xs text-muted-foreground">Previsão até</p>
				<CalendarDateInput
					value={effectiveExpectedTo}
					onChange={onExpectedToChange}
					locale={ptBR}
				/>
			</div>

			<Button
				type="button"
				variant="outline"
				className="w-full xl:justify-self-stretch"
				onClick={onClearFilters}
			>
				<RefreshCcw className="size-4" />
				Limpar
			</Button>
		</FilterPanel>
	);
}
