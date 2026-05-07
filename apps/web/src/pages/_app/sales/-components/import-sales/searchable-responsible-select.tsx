import {
	SearchableSelect,
	type SearchableSelectOption,
} from "@/components/ui/searchable-select";

export type SearchableResponsibleOption = {
	id: string;
	label: string;
};

interface SearchableResponsibleSelectProps {
	options: SearchableResponsibleOption[];
	value?: string;
	onChange: (value?: string) => void;
	placeholder: string;
	emptyLabel: string;
	disabled?: boolean;
	searchPlaceholder?: string;
	clearLabel?: string;
	ariaLabel?: string;
}

export function SearchableResponsibleSelect({
	options,
	value,
	onChange,
	placeholder,
	emptyLabel,
	disabled = false,
	searchPlaceholder = "Buscar responsável...",
	clearLabel = "Selecionar...",
	ariaLabel,
}: SearchableResponsibleSelectProps) {
	const searchableOptions: SearchableSelectOption[] = options.map((option) => ({
		value: option.id,
		label: option.label,
	}));

	return (
		<SearchableSelect
			options={searchableOptions}
			value={value}
			onValueChange={(nextValue) =>
				onChange(nextValue === "__clear__" ? undefined : nextValue)
			}
			placeholder={placeholder}
			searchPlaceholder={searchPlaceholder}
			emptyMessage={emptyLabel}
			clearOption={{
				value: "__clear__",
				label: clearLabel,
			}}
			disabled={disabled}
			ariaLabel={ariaLabel}
		/>
	);
}
