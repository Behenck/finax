import { format, isValid, parse, type Locale } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { applyDateInputMask } from "@/utils/date-mask";
import { Button } from "./button";
import { Calendar } from "./calendar";
import { Input } from "./input";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

interface CalendarDateInputProps {
	value?: string;
	onChange: (value: string) => void;
	placeholder?: string;
	disabled?: boolean;
	locale?: Locale;
	"aria-invalid"?: boolean;
}

function countDigitsBeforePosition(value: string, position: number) {
	return value.slice(0, Math.max(position, 0)).replace(/\D/g, "").length;
}

function resolveCaretPositionByDigitCount(value: string, digitCount: number) {
	if (digitCount <= 0) {
		return 0;
	}

	let normalizedDigitCount = 0;
	for (let index = 0; index < value.length; index += 1) {
		if (/\d/.test(value[index])) {
			normalizedDigitCount += 1;
		}

		if (normalizedDigitCount >= digitCount) {
			return index + 1;
		}
	}

	return value.length;
}

export function CalendarDateInput({
	value,
	onChange,
	placeholder = "dd/mm/aaaa",
	disabled,
	locale,
	"aria-invalid": ariaInvalid,
}: CalendarDateInputProps) {
	const inputRef = useRef<HTMLInputElement>(null);

	const selectedDate = useMemo(() => {
		if (!value) {
			return undefined;
		}

		const parsedDate = parse(value, "yyyy-MM-dd", new Date());
		return isValid(parsedDate) ? parsedDate : undefined;
	}, [value]);

	useEffect(() => {
		const input = inputRef.current;
		if (!input) {
			return;
		}

		const formattedValue = selectedDate
			? format(selectedDate, "dd/MM/yyyy")
			: "";
		if (input.value === formattedValue) {
			return;
		}

		input.value = formattedValue;
	}, [selectedDate]);

	function handleInputChange(input: HTMLInputElement) {
		const rawValue = input.value;
		const selectionStart = input.selectionStart ?? rawValue.length;
		const selectionEnd = input.selectionEnd ?? rawValue.length;
		const digitsBeforeSelectionStart = countDigitsBeforePosition(
			rawValue,
			selectionStart,
		);
		const digitsBeforeSelectionEnd = countDigitsBeforePosition(
			rawValue,
			selectionEnd,
		);
		const maskedValue = applyDateInputMask(rawValue);
		if (input.value !== maskedValue) {
			input.value = maskedValue;
			const nextSelectionStart = resolveCaretPositionByDigitCount(
				maskedValue,
				digitsBeforeSelectionStart,
			);
			const nextSelectionEnd = resolveCaretPositionByDigitCount(
				maskedValue,
				digitsBeforeSelectionEnd,
			);
			input.setSelectionRange(nextSelectionStart, nextSelectionEnd);
		}

		if (maskedValue.length === 0) {
			onChange("");
			return;
		}

		if (maskedValue.length !== 10) {
			return;
		}

		const parsedDate = parse(maskedValue, "dd/MM/yyyy", new Date());

		if (
			!isValid(parsedDate) ||
			format(parsedDate, "dd/MM/yyyy") !== maskedValue
		) {
			return;
		}

		onChange(format(parsedDate, "yyyy-MM-dd"));
	}

	return (
		<div className="relative w-full">
			<Input
				ref={inputRef}
				defaultValue={selectedDate ? format(selectedDate, "dd/MM/yyyy") : ""}
				placeholder={placeholder}
				disabled={disabled}
				aria-invalid={ariaInvalid}
				className="pr-11"
				onChange={(event) => handleInputChange(event.target)}
			/>

			<Popover>
				<PopoverTrigger asChild>
					<Button
						type="button"
						size="icon"
						variant="ghost"
						disabled={disabled}
						className="absolute top-1 right-1 h-8 w-8 rounded-md text-muted-foreground/80 hover:bg-accent/70 hover:text-foreground"
						onMouseDown={(event) => event.preventDefault()}
					>
						<CalendarIcon className="h-4 w-4" />
					</Button>
				</PopoverTrigger>

				<PopoverContent
					align="end"
					className="w-auto rounded-lg border border-border/80 p-0 shadow-lg"
				>
					<Calendar
						mode="single"
						locale={locale}
						selected={selectedDate}
						onSelect={(date) => {
							if (!date) {
								onChange("");
								if (inputRef.current) {
									inputRef.current.value = "";
								}
								return;
							}

							const nextValue = format(date, "yyyy-MM-dd");
							onChange(nextValue);
							if (inputRef.current) {
								inputRef.current.value = format(date, "dd/MM/yyyy");
							}
						}}
					/>
				</PopoverContent>
			</Popover>
		</div>
	);
}
