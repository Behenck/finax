import { render, screen } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";
import { DynamicFieldsSection } from "../src/pages/_app/sales/-components/sale-form/sections/dynamic-fields-section";

function DynamicFieldsSectionWrapper({
	isDynamicFieldsLoading = true,
}: {
	isDynamicFieldsLoading?: boolean;
}) {
	const form = useForm({
		defaultValues: {
			dynamicFields: {},
		},
	});

	return (
		<DynamicFieldsSection
			control={form.control}
			selectedProductId="product-1"
			isDynamicFieldsLoading={isDynamicFieldsLoading}
			dynamicFieldSchema={[]}
		/>
	);
}

describe("dynamic fields section loading", () => {
	it("should render skeleton instead of loading text", () => {
		render(<DynamicFieldsSectionWrapper />);

		expect(
			document.querySelectorAll('[data-slot="skeleton"]').length,
		).toBeGreaterThan(0);
		expect(
			screen.queryByText("Carregando campos personalizados..."),
		).not.toBeInTheDocument();
	});

	it("should render loaded content inside the reveal wrapper", () => {
		const { container } = render(
			<DynamicFieldsSectionWrapper isDynamicFieldsLoading={false} />,
		);

		expect(
			container.querySelector('[data-slot="loading-reveal"]'),
		).toBeInTheDocument();
		expect(
			screen.getByText("Este produto não possui campos personalizados."),
		).toBeInTheDocument();
	});
});
