import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FieldError } from "@/components/field-error";

describe("FieldError", () => {
	it("should not render when error is missing", () => {
		render(<FieldError />);

		expect(screen.queryByRole("alert")).not.toBeInTheDocument();
	});

	it("should not render when error message is not a string", () => {
		render(<FieldError error={{ message: 123 }} />);

		expect(screen.queryByRole("alert")).not.toBeInTheDocument();
	});

	it("should render error message with alert role", () => {
		render(<FieldError error={{ message: "Campo obrigatório" }} />);

		expect(screen.getByRole("alert")).toHaveTextContent("Campo obrigatório");
	});
});
