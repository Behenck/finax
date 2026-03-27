import { format, startOfMonth } from "date-fns";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
	formatMonthLabel,
	monthValueToDate,
} from "./dashboard-commercial-utils";

interface DashboardMonthPickerProps {
	value: string;
	onChange: (value: string) => void;
	disabled?: boolean;
}

export function DashboardMonthPicker({
	value,
	onChange,
	disabled,
}: DashboardMonthPickerProps) {
	const selectedDate = monthValueToDate(value);

	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button
					type="button"
					variant="outline"
					disabled={disabled}
					className="justify-start gap-2 rounded-full border-border bg-background/80 text-left capitalize"
				>
					<CalendarDays className="size-4 text-muted-foreground" />
					{formatMonthLabel(value)}
				</Button>
			</PopoverTrigger>

			<PopoverContent align="end" className="w-auto p-0">
				<Calendar
					mode="single"
					selected={selectedDate}
					defaultMonth={selectedDate}
					showOutsideDays={false}
					onSelect={(date) => {
						if (!date) {
							return;
						}

						onChange(format(startOfMonth(date), "yyyy-MM"));
					}}
				/>
			</PopoverContent>
		</Popover>
	);
}
