import { format, isValid, parse } from "date-fns";
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
	"aria-invalid"?: boolean;
}

export function CalendarDateInput({
	value,
	onChange,
	placeholder = "dd/mm/aaaa",
	disabled,
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

		input.value = selectedDate ? format(selectedDate, "dd/MM/yyyy") : "";
	}, [selectedDate]);

	function handleInputChange(rawValue: string) {
		const maskedValue = applyDateInputMask(rawValue);
		if (inputRef.current) {
			inputRef.current.value = maskedValue;
		}

		if (maskedValue.length === 0) {
			onChange("");
			return;
		}

		if (maskedValue.length !== 10) {
			return;
		}

		const parsedDate = parse(maskedValue, "dd/MM/yyyy", new Date());

		if (!isValid(parsedDate) || format(parsedDate, "dd/MM/yyyy") !== maskedValue) {
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
				onChange={(event) => handleInputChange(event.target.value)}
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
