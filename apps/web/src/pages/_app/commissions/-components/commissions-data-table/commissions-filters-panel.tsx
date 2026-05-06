import { RefreshCcw } from "lucide-react";
import { ptBR } from "date-fns/locale";
import { FilterPanel } from "@/components/filter-panel";
import { Button } from "@/components/ui/button";
import { CalendarDateInput } from "@/components/ui/calendar-date-input";
import { Input } from "@/components/ui/input";
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
				<Select
					value={companyIdFilter || "ALL"}
					onValueChange={(value) =>
						onCompanyIdChange(value === "ALL" ? "" : value)
					}
				>
					<SelectTrigger className="w-full">
						<SelectValue placeholder="Todas as empresas" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="ALL">Todas as empresas</SelectItem>
						{companies.map((company) => (
							<SelectItem key={company.id} value={company.id}>
								{company.name}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			<div className="space-y-1">
				<p className="text-xs text-muted-foreground">Unidade</p>
				<Select
					value={unitIdFilter || "ALL"}
					onValueChange={(value) =>
						onUnitIdChange(value === "ALL" ? "" : value)
					}
					disabled={!companyIdFilter}
				>
					<SelectTrigger className="w-full">
						<SelectValue placeholder="Todas as unidades" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="ALL">Todas as unidades</SelectItem>
						{unitsBySelectedCompany.map((unit) => (
							<SelectItem key={unit.id} value={unit.id}>
								{unit.name}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			<div className="space-y-1">
				<p className="text-xs text-muted-foreground">Produto</p>
				<Select
					value={productIdFilter || "ALL"}
					onValueChange={(value) =>
						onProductIdChange(value === "ALL" ? "" : value)
					}
				>
					<SelectTrigger className="w-full">
						<SelectValue placeholder="Todos os produtos" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="ALL">Todos os produtos</SelectItem>
						{productOptions.map((product) => (
							<SelectItem key={product.id} value={product.id}>
								{product.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
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
