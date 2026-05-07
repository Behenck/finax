import { Check, ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
	BRAZILIAN_STATE_OPTIONS,
	formatBrazilianStateLabel,
	normalizeBrazilianStateSearchValue,
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
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");

	const selectedOption = useMemo(
		() => BRAZILIAN_STATE_OPTIONS.find((option) => option.value === value),
		[value],
	);
	const filteredOptions = useMemo(() => {
		const normalizedQuery = normalizeBrazilianStateSearchValue(query);
		if (!normalizedQuery) {
			return BRAZILIAN_STATE_OPTIONS;
		}

		return BRAZILIAN_STATE_OPTIONS.filter((option) =>
			normalizeBrazilianStateSearchValue(
				`${option.label} ${option.value} ${formatBrazilianStateLabel(option)}`,
			).includes(normalizedQuery),
		);
	}, [query]);

	function handleOpenChange(nextOpen: boolean) {
		setOpen(nextOpen);

		if (!nextOpen) {
			setQuery("");
		}
	}

	function handleSelect(nextValue: string) {
		onChange(nextValue);
		setOpen(false);
		setQuery("");
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
					<span className="truncate">
						{selectedOption
							? formatBrazilianStateLabel(selectedOption)
							: placeholder}
					</span>
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
						placeholder="Buscar estado..."
					/>
					<div className="max-h-64 overflow-y-auto rounded-md border">
						{filteredOptions.length === 0 ? (
							<p className="p-2 text-sm text-muted-foreground">
								Nenhum estado encontrado.
							</p>
						) : (
							filteredOptions.map((option) => {
								const isSelected = option.value === value;

								return (
									<button
										key={option.value}
										type="button"
										className={cn(
											"flex w-full items-center justify-between gap-2 px-2 py-2 text-left text-sm transition-colors hover:bg-accent",
											isSelected && "bg-accent",
										)}
										onClick={() => handleSelect(option.value)}
									>
										<span className="truncate">
											{formatBrazilianStateLabel(option)}
										</span>
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
