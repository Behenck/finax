import { format, parse } from "date-fns";

export function parseSaleDateFromApi(value: string) {
	const dateOnly = value.slice(0, 10);
	return parse(dateOnly, "yyyy-MM-dd", new Date());
}

export function toDateInputValue(date?: Date) {
	return date ? format(date, "yyyy-MM-dd") : "";
}

export function parseDateInputValue(value: string) {
	if (!value) {
		return undefined;
	}

	return parse(value, "yyyy-MM-dd", new Date());
}
