import { Check, ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { normalizeJsonImportSearchValue } from "./json-sales-import-helpers";

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
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");

	const selectedOption = useMemo(
		() => options.find((option) => option.id === value),
		[options, value],
	);
	const filteredOptions = useMemo(() => {
		const normalizedQuery = normalizeJsonImportSearchValue(query);
		if (!normalizedQuery) {
			return options;
		}

		return options.filter((option) =>
			normalizeJsonImportSearchValue(option.label).includes(normalizedQuery),
		);
	}, [options, query]);

	function handleOpenChange(nextOpen: boolean) {
		setOpen(nextOpen);

		if (!nextOpen) {
			setQuery("");
		}
	}

	function handleSelect(nextValue?: string) {
		onChange(nextValue);
		setQuery("");
		setOpen(false);
	}

	return (
		<Popover open={open} onOpenChange={handleOpenChange}>
			<PopoverTrigger asChild>
				<Button
					type="button"
					variant="outline"
					role="combobox"
					aria-expanded={open}
					aria-label={ariaLabel}
					disabled={disabled}
					className="w-full justify-between"
				>
					<span className="truncate">{selectedOption?.label ?? placeholder}</span>
					<ChevronDown className="size-4 text-muted-foreground" />
				</Button>
			</PopoverTrigger>
			<PopoverContent
				align="start"
				className="w-[var(--radix-popover-trigger-width)] p-2"
			>
				<div className="space-y-2">
					<Input
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						placeholder={searchPlaceholder}
					/>
					<div className="max-h-64 overflow-y-auto rounded-md border">
						<button
							type="button"
							className={cn(
								"flex w-full items-center justify-between gap-2 px-2 py-2 text-left text-sm transition-colors hover:bg-accent",
								!value && "bg-accent",
							)}
							onClick={() => handleSelect(undefined)}
						>
							<span>{clearLabel}</span>
							{!value ? <Check className="size-4" /> : null}
						</button>

						{filteredOptions.length === 0 ? (
							<p className="p-2 text-sm text-muted-foreground">{emptyLabel}</p>
						) : (
							filteredOptions.map((option) => {
								const isSelected = option.id === value;

								return (
									<button
										key={option.id}
										type="button"
										className={cn(
											"flex w-full items-center justify-between gap-2 px-2 py-2 text-left text-sm transition-colors hover:bg-accent",
											isSelected && "bg-accent",
										)}
										onClick={() => handleSelect(option.id)}
									>
										<span className="truncate">{option.label}</span>
										{isSelected ? <Check className="size-4" /> : null}
									</button>
								);
							})
						)}
					</div>
				</div>
			</PopoverContent>
		</Popover>
	);
}
