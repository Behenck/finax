import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { CalendarDateInput } from "@/components/ui/calendar-date-input";

describe("CalendarDateInput", () => {
	it("should render initial value as dd/MM/yyyy", async () => {
		render(
			<CalendarDateInput value="2026-03-10" onChange={vi.fn()} />,
		);

		await waitFor(() => {
			expect(screen.getByPlaceholderText("dd/mm/aaaa")).toHaveValue(
				"10/03/2026",
			);
		});
	});

	it("should not call onChange for partial typing", async () => {
		const onChange = vi.fn();
		const user = userEvent.setup();
		render(<CalendarDateInput onChange={onChange} />);

		const input = screen.getByPlaceholderText("dd/mm/aaaa");
		await user.type(input, "1203");

		expect(input).toHaveValue("12/03");
		expect(onChange).not.toHaveBeenCalled();
	});

	it("should call onChange with yyyy-MM-dd when typing a valid date", async () => {
		const onChange = vi.fn();
		const user = userEvent.setup();
		render(<CalendarDateInput onChange={onChange} />);

		const input = screen.getByPlaceholderText("dd/mm/aaaa");
		await user.type(input, "15032026");

		expect(input).toHaveValue("15/03/2026");
		expect(onChange).toHaveBeenCalledTimes(1);
		expect(onChange).toHaveBeenCalledWith("2026-03-15");
	});

	it("should not call onChange when typing an invalid date", async () => {
		const onChange = vi.fn();
		const user = userEvent.setup();
		render(<CalendarDateInput onChange={onChange} />);

		const input = screen.getByPlaceholderText("dd/mm/aaaa");
		await user.type(input, "31022026");

		expect(input).toHaveValue("31/02/2026");
		expect(onChange).not.toHaveBeenCalled();
	});

	it("should call onChange with empty string when input is cleared", async () => {
		const onChange = vi.fn();
		const user = userEvent.setup();
		render(
			<CalendarDateInput value="2026-03-10" onChange={onChange} />,
		);

		const input = screen.getByPlaceholderText("dd/mm/aaaa");
		await user.clear(input);

		expect(input).toHaveValue("");
		expect(onChange).toHaveBeenCalledWith("");
	});

	it("should update input value when value prop changes", async () => {
		const onChange = vi.fn();
		const { rerender } = render(<CalendarDateInput onChange={onChange} />);
		const input = screen.getByPlaceholderText("dd/mm/aaaa");

		expect(input).toHaveValue("");

		rerender(
			<CalendarDateInput value="2026-12-25" onChange={onChange} />,
		);

		await waitFor(() => {
			expect(input).toHaveValue("25/12/2026");
		});
	});

	it("should preserve caret position when editing first day digit", async () => {
		function ControlledCalendarDateInput() {
			const [value, setValue] = useState("2026-03-15");
			return <CalendarDateInput value={value} onChange={setValue} />;
		}

		render(<ControlledCalendarDateInput />);

		const input = screen.getByPlaceholderText("dd/mm/aaaa");
		input.focus();
		input.setSelectionRange(0, 1);

		fireEvent.change(input, {
			target: {
				value: "05/03/2026",
				selectionStart: 1,
				selectionEnd: 1,
			},
		});

		await waitFor(() => {
			expect(input).toHaveValue("05/03/2026");
		});
		expect(input.selectionStart).toBe(1);
		expect(input.selectionEnd).toBe(1);
	});
});
