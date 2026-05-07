import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";
import { SaleCommissionCard } from "@/pages/_app/sales/-components/sale-commission-card";
import type { SaleFormData, SaleFormInput } from "@/schemas/sale-schema";

const defaultValues: SaleFormInput = {
	saleDate: new Date("2026-03-10T00:00:00.000Z"),
	customerId: "11111111-1111-4111-8111-111111111111",
	productId: "22222222-2222-4222-8222-222222222222",
	companyId: "33333333-3333-4333-8333-333333333333",
	unitId: undefined,
	responsibleType: "SELLER",
	responsibleId: "44444444-4444-4444-8444-444444444444",
	totalAmount: "R$ 1.000,00",
	dynamicFields: {},
	commissions: [
		{
			sourceType: "MANUAL",
			recipientType: "OTHER",
			direction: "OUTCOME",
			beneficiaryLabel: "Comissão manual",
			startDate: new Date("2026-03-10T00:00:00.000Z"),
			totalPercentage: 1,
			installments: [
				{
					installmentNumber: 1,
					percentage: 0.5,
					monthsToAdvance: 0,
				},
				{
					installmentNumber: 2,
					percentage: 0.5,
					monthsToAdvance: 1,
				},
			],
		},
	],
};

function SaleCommissionCardHarness(props: {
	onInstallmentCountChange(index: number, nextCount: number): void;
}) {
	const form = useForm<SaleFormInput, unknown, SaleFormData>({
		defaultValues,
	});

	return (
		<SaleCommissionCard
			index={0}
			control={form.control}
			setValue={form.setValue}
			getValues={form.getValues}
			onRemove={() => {}}
			onInstallmentCountChange={props.onInstallmentCountChange}
			companyOptions={[]}
			unitOptions={[]}
			sellerOptions={[]}
			partnerOptions={[]}
			supervisorOptions={[]}
			saleTotalAmountInCents={100_000}
			baseCommissionOptions={[]}
		/>
	);
}

describe("sale-commission-card", () => {
	it("should request one more installment when clicking add installment", async () => {
		const user = userEvent.setup();
		const onInstallmentCountChange = vi.fn();

		render(
			<SaleCommissionCardHarness
				onInstallmentCountChange={onInstallmentCountChange}
			/>,
		);

		await user.click(
			screen.getByRole("button", { name: "Adicionar parcela" }),
		);

		expect(onInstallmentCountChange).toHaveBeenCalledWith(0, 3);
	});
});
