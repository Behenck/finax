import { useMemo } from "react";
import {
	SearchableSelect,
	type SearchableSelectOption,
} from "@/components/ui/searchable-select";
import {
	BRAZILIAN_STATE_OPTIONS,
	formatBrazilianStateLabel,
} from "./brazilian-state-options";

interface PartnerStateSelectProps {
	value?: string;
	onChange: (value: string) => void;
	disabled?: boolean;
	placeholder?: string;
	ariaLabel?: string;
}

export function PartnerStateSelect({
	value,
	onChange,
	disabled = false,
	placeholder = "Selecione",
	ariaLabel = "Selecionar estado",
}: PartnerStateSelectProps) {
	const searchableOptions = useMemo<SearchableSelectOption[]>(
		() =>
			BRAZILIAN_STATE_OPTIONS.map((option) => ({
				value: option.value,
				label: formatBrazilianStateLabel(option),
				searchText: `${option.label} ${option.value}`,
			})),
		[],
	);

	return (
		<SearchableSelect
			options={searchableOptions}
			value={value}
			onValueChange={onChange}
			placeholder={placeholder}
			searchPlaceholder="Buscar estado..."
			emptyMessage="Nenhum estado encontrado."
			disabled={disabled}
			ariaLabel={ariaLabel}
		/>
	);
}
