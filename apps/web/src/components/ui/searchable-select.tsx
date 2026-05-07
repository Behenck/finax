import { Check, ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type SearchableSelectOption = {
	value: string;
	label: string;
	searchText?: string;
	group?: string;
	disabled?: boolean;
};

type SearchableSelectClearOption = {
	value: string;
	label: string;
	searchText?: string;
};

type SearchableSelectProps = {
	options: SearchableSelectOption[];
	value?: string;
	onValueChange: (value: string) => void;
	placeholder: string;
	searchPlaceholder: string;
	emptyMessage: string;
	clearOption?: SearchableSelectClearOption;
	disabled?: boolean;
	ariaLabel?: string;
	id?: string;
	className?: string;
	contentClassName?: string;
};

function normalizeSearchableSelectText(value: string) {
	return value
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.normalize("NFKC")
		.toLowerCase()
		.trim()
		.replace(/\s+/g, " ");
}

export function SearchableSelect({
	options,
	value,
	onValueChange,
	placeholder,
	searchPlaceholder,
	emptyMessage,
	clearOption,
	disabled = false,
	ariaLabel,
	id,
	className,
	contentClassName,
}: SearchableSelectProps) {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");

	const selectedOption = useMemo(
		() => options.find((option) => option.value === value),
		[options, value],
	);
	const selectedLabel = selectedOption?.label
		? selectedOption.label
		: clearOption && value === clearOption.value
			? clearOption.label
			: placeholder;

	const filteredOptions = useMemo(() => {
		const normalizedQuery = normalizeSearchableSelectText(query);
		if (!normalizedQuery) {
			return options;
		}

		return options.filter((option) =>
			normalizeSearchableSelectText(
				`${option.label} ${option.searchText ?? ""}`,
			).includes(normalizedQuery),
		);
	}, [options, query]);

	const groupedOptions = useMemo(() => {
		const groups: Array<{
			key: string;
			label: string | null;
			options: SearchableSelectOption[];
		}> = [];

		for (const option of filteredOptions) {
			const groupKey = option.group ?? "__ungrouped__";
			const existingGroup = groups.find((group) => group.key === groupKey);

			if (existingGroup) {
				existingGroup.options.push(option);
				continue;
			}

			groups.push({
				key: groupKey,
				label: option.group ?? null,
				options: [option],
			});
		}

		return groups;
	}, [filteredOptions]);

	function handleOpenChange(nextOpen: boolean) {
		setOpen(nextOpen);

		if (!nextOpen) {
			setQuery("");
		}
	}

	function handleSelect(nextValue: string) {
		onValueChange(nextValue);
		setQuery("");
		setOpen(false);
	}

	const isClearSelected = Boolean(
		clearOption && (!value || value === clearOption.value),
	);

	return (
		<Popover open={open} onOpenChange={handleOpenChange}>
			<PopoverTrigger asChild>
				<Button
					id={id}
					type="button"
					variant="outline"
					role="combobox"
					aria-expanded={open}
					aria-label={ariaLabel ?? placeholder}
					disabled={disabled}
					className={cn("w-full justify-between font-normal", className)}
				>
					<span
						className={cn(
							"truncate",
							!selectedOption && value !== clearOption?.value
								? "text-muted-foreground"
								: "text-foreground",
						)}
					>
						{selectedLabel}
					</span>
					<ChevronDown className="size-4 text-muted-foreground" />
				</Button>
			</PopoverTrigger>
			<PopoverContent
				align="start"
				className={cn(
					"w-[var(--radix-popover-trigger-width)] p-2",
					contentClassName,
				)}
			>
				<div className="space-y-2">
					<Input
						autoFocus
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						placeholder={searchPlaceholder}
					/>
					<div className="max-h-64 overflow-y-auto rounded-md border">
						{clearOption ? (
							<button
								type="button"
								className={cn(
									"flex w-full items-center justify-between gap-2 px-2 py-2 text-left text-sm transition-colors hover:bg-accent",
									isClearSelected && "bg-accent",
								)}
								onClick={() => handleSelect(clearOption.value)}
							>
								<span className="truncate">{clearOption.label}</span>
								{isClearSelected ? <Check className="size-4" /> : null}
							</button>
						) : null}

						{clearOption && groupedOptions.length > 0 ? (
							<div className="border-t" />
						) : null}

						{groupedOptions.length === 0 ? (
							<p className="p-2 text-sm text-muted-foreground">{emptyMessage}</p>
						) : (
							groupedOptions.map((group, groupIndex) => (
								<div key={group.key}>
									{groupIndex > 0 ? <div className="border-t" /> : null}
									{group.label ? (
										<p className="px-2 py-2 text-xs font-medium text-muted-foreground">
											{group.label}
										</p>
									) : null}
									{group.options.map((option) => {
										const isSelected = option.value === value;

										return (
											<button
												key={option.value}
												type="button"
												className={cn(
													"flex w-full items-center justify-between gap-2 px-2 py-2 text-left text-sm transition-colors hover:bg-accent",
													isSelected && "bg-accent",
													option.disabled &&
														"cursor-not-allowed opacity-50 hover:bg-transparent",
												)}
												onClick={() => handleSelect(option.value)}
												disabled={option.disabled}
											>
												<span className="truncate">{option.label}</span>
												{isSelected ? <Check className="size-4" /> : null}
											</button>
										);
									})}
								</div>
							))
						)}
					</div>
				</div>
			</PopoverContent>
		</Popover>
	);
}
