import { act, fireEvent, renderHook } from "@testing-library/react";
import { type MouseEvent as ReactMouseEvent } from "react";
import { describe, expect, it, vi } from "vitest";
import { useCheckboxMultiSelect } from "@/hooks/use-checkbox-multi-select";

function createClickEvent(shiftKey: boolean) {
	return {
		shiftKey,
	} as Pick<ReactMouseEvent<HTMLElement>, "shiftKey">;
}

describe("useCheckboxMultiSelect", () => {
	it("should select all visible ids with Ctrl+A outside editable fields", () => {
		const toggleOne = vi.fn();
		const toggleMany = vi.fn();

		renderHook(() =>
			useCheckboxMultiSelect({
				visibleIds: ["a", "b", "c"],
				toggleOne,
				toggleMany,
			}),
		);

		fireEvent.keyDown(window, { key: "a", ctrlKey: true });

		expect(toggleMany).toHaveBeenCalledTimes(1);
		expect(toggleMany).toHaveBeenCalledWith(["a", "b", "c"], true);
	});

	it("should not intercept Ctrl+A from editable fields", () => {
		const toggleOne = vi.fn();
		const toggleMany = vi.fn();

		renderHook(() =>
			useCheckboxMultiSelect({
				visibleIds: ["a", "b", "c"],
				toggleOne,
				toggleMany,
			}),
		);

		const input = document.createElement("input");
		document.body.appendChild(input);
		fireEvent.keyDown(input, { key: "a", ctrlKey: true, bubbles: true });
		input.remove();

		expect(toggleMany).not.toHaveBeenCalled();
	});

	it("should clear selection with Escape when onClearSelection is provided", () => {
		const toggleOne = vi.fn();
		const toggleMany = vi.fn();
		const onClearSelection = vi.fn();

		renderHook(() =>
			useCheckboxMultiSelect({
				visibleIds: ["a", "b", "c"],
				toggleOne,
				toggleMany,
				onClearSelection,
			}),
		);

		fireEvent.keyDown(window, { key: "Escape" });

		expect(onClearSelection).toHaveBeenCalledTimes(1);
		expect(toggleMany).not.toHaveBeenCalled();
	});

	it("should clear visible selectable ids with Escape when onClearSelection is missing", () => {
		const toggleOne = vi.fn();
		const toggleMany = vi.fn();

		renderHook(() =>
			useCheckboxMultiSelect({
				visibleIds: ["a", "b", "c"],
				isSelectable: (id) => id !== "b",
				toggleOne,
				toggleMany,
			}),
		);

		fireEvent.keyDown(window, { key: "Escape" });

		expect(toggleMany).toHaveBeenCalledTimes(1);
		expect(toggleMany).toHaveBeenCalledWith(["a", "c"], false);
	});

	it("should not intercept Escape from editable fields", () => {
		const toggleOne = vi.fn();
		const toggleMany = vi.fn();
		const onClearSelection = vi.fn();

		renderHook(() =>
			useCheckboxMultiSelect({
				visibleIds: ["a", "b", "c"],
				toggleOne,
				toggleMany,
				onClearSelection,
			}),
		);

		const textarea = document.createElement("textarea");
		document.body.appendChild(textarea);
		fireEvent.keyDown(textarea, { key: "Escape", bubbles: true });
		textarea.remove();

		expect(onClearSelection).not.toHaveBeenCalled();
		expect(toggleMany).not.toHaveBeenCalled();
	});

	it("should apply forward range selection with Shift+click", () => {
		const toggleOne = vi.fn();
		const toggleMany = vi.fn();
		const { result } = renderHook(() =>
			useCheckboxMultiSelect({
				visibleIds: ["a", "b", "c", "d"],
				toggleOne,
				toggleMany,
			}),
		);

		act(() => {
			result.current.onCheckboxClick("b", createClickEvent(false));
			result.current.onCheckboxCheckedChange("b", true);
		});
		act(() => {
			result.current.onCheckboxClick("d", createClickEvent(true));
			result.current.onCheckboxCheckedChange("d", true);
		});

		expect(toggleMany).toHaveBeenCalledWith(["b", "c", "d"], true);
	});

	it("should apply backward range selection with Shift+click", () => {
		const toggleOne = vi.fn();
		const toggleMany = vi.fn();
		const { result } = renderHook(() =>
			useCheckboxMultiSelect({
				visibleIds: ["a", "b", "c", "d"],
				toggleOne,
				toggleMany,
			}),
		);

		act(() => {
			result.current.onCheckboxClick("d", createClickEvent(false));
			result.current.onCheckboxCheckedChange("d", true);
		});
		act(() => {
			result.current.onCheckboxClick("b", createClickEvent(true));
			result.current.onCheckboxCheckedChange("b", true);
		});

		expect(toggleMany).toHaveBeenCalledWith(["b", "c", "d"], true);
	});

	it("should apply range deselection with Shift+click", () => {
		const toggleOne = vi.fn();
		const toggleMany = vi.fn();
		const { result } = renderHook(() =>
			useCheckboxMultiSelect({
				visibleIds: ["a", "b", "c", "d"],
				toggleOne,
				toggleMany,
			}),
		);

		act(() => {
			result.current.onCheckboxClick("b", createClickEvent(false));
			result.current.onCheckboxCheckedChange("b", true);
		});
		act(() => {
			result.current.onCheckboxClick("d", createClickEvent(true));
			result.current.onCheckboxCheckedChange("d", false);
		});

		expect(toggleMany).toHaveBeenCalledWith(["b", "c", "d"], false);
	});

	it("should ignore non-selectable ids in range and Ctrl+A", () => {
		const toggleOne = vi.fn();
		const toggleMany = vi.fn();
		const { result } = renderHook(() =>
			useCheckboxMultiSelect({
				visibleIds: ["a", "b", "c", "d"],
				isSelectable: (id) => id !== "c",
				toggleOne,
				toggleMany,
			}),
		);

		fireEvent.keyDown(window, { key: "a", ctrlKey: true });
		expect(toggleMany).toHaveBeenCalledWith(["a", "b", "d"], true);

		act(() => {
			result.current.onCheckboxClick("b", createClickEvent(false));
			result.current.onCheckboxCheckedChange("b", true);
		});
		act(() => {
			result.current.onCheckboxClick("d", createClickEvent(true));
			result.current.onCheckboxCheckedChange("d", true);
		});

		expect(toggleMany).toHaveBeenCalledWith(["b", "d"], true);
	});

	it("should reset range anchor when visible ids change", () => {
		const toggleOne = vi.fn();
		const toggleMany = vi.fn();
		const { rerender, result } = renderHook(
			(props: { visibleIds: string[] }) =>
				useCheckboxMultiSelect({
					visibleIds: props.visibleIds,
					toggleOne,
					toggleMany,
				}),
			{
				initialProps: {
					visibleIds: ["a", "b", "c"],
				},
			},
		);

		act(() => {
			result.current.onCheckboxClick("b", createClickEvent(false));
			result.current.onCheckboxCheckedChange("b", true);
		});

		toggleOne.mockClear();
		toggleMany.mockClear();

		rerender({
			visibleIds: ["x", "y", "z"],
		});

		act(() => {
			result.current.onCheckboxClick("z", createClickEvent(true));
			result.current.onCheckboxCheckedChange("z", true);
		});

		expect(toggleMany).not.toHaveBeenCalled();
		expect(toggleOne).toHaveBeenCalledWith("z", true);
	});
});
