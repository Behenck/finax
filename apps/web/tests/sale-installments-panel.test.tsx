import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SaleInstallmentsPanel } from "@/pages/_app/sales/-components/sale-installments-panel";

const mocks = vi.hoisted(() => ({
	useSaleCommissionInstallments: vi.fn(),
}));

vi.mock("@/hooks/sales", () => ({
	useSaleCommissionInstallments: (...args: unknown[]) =>
		mocks.useSaleCommissionInstallments(...args),
	usePatchSaleCommissionInstallmentStatus: () => ({
		mutateAsync: vi.fn().mockResolvedValue(undefined),
		isPending: false,
	}),
	useUpdateSaleCommissionInstallment: () => ({
		mutateAsync: vi.fn().mockResolvedValue(undefined),
		isPending: false,
	}),
	useDeleteSaleCommissionInstallment: () => ({
		mutateAsync: vi.fn().mockResolvedValue(undefined),
		isPending: false,
	}),
}));

vi.mock("@/permissions/access", () => ({
	useAbility: () => ({
		can: () => false,
	}),
}));

vi.mock("nuqs", async (importOriginal) => {
	const actual = await importOriginal<typeof import("nuqs")>();

	return {
		...actual,
		useQueryState: () => [false, vi.fn()],
	};
});

describe("sale-installments-panel", () => {
	beforeEach(() => {
		mocks.useSaleCommissionInstallments.mockReset();
		mocks.useSaleCommissionInstallments.mockReturnValue({
			data: {
				installments: [
					{
						id: "inst-1",
						saleCommissionId: "commission-1",
						recipientType: "SELLER",
						sourceType: "PULLED",
						direction: "OUTCOME",
						beneficiaryId: "seller-1",
						beneficiaryKey: "SELLER:seller-1",
						beneficiaryLabel: "Comissão A",
						installmentNumber: 1,
						percentage: 2,
						amount: 2000,
						status: "PAID",
						expectedPaymentDate: "2026-03-10T00:00:00+14:00",
						paymentDate: "2026-03-10T00:00:00+14:00",
					},
					{
						id: "inst-2",
						saleCommissionId: "commission-2",
						recipientType: "PARTNER",
						sourceType: "MANUAL",
						direction: "OUTCOME",
						beneficiaryId: "partner-1",
						beneficiaryKey: "PARTNER:partner-1",
						beneficiaryLabel: "Comissão B",
						installmentNumber: 2,
						percentage: 3,
						amount: 3000,
						status: "PENDING",
						expectedPaymentDate: "2026-03-11T00:00:00.000Z",
						paymentDate: null,
					},
				],
			},
			isLoading: false,
			isError: false,
			refetch: vi.fn(),
		});
	});

	it("should show only installments from selected commission when saleCommissionId is provided", () => {
		render(
			<SaleInstallmentsPanel
				saleId="sale-1"
				saleStatus="COMPLETED"
				saleCommissionId="commission-1"
			/>,
		);

		expect(screen.getByText("Comissão A")).toBeInTheDocument();
		expect(screen.queryByText("Comissão B")).not.toBeInTheDocument();
		expect(
			screen.getByText("Resumo: 1/1 pagas, 0 pendentes, 0 canceladas."),
		).toBeInTheDocument();
		expect(screen.getAllByText("10/03/2026").length).toBeGreaterThan(0);
	});

	it("should keep showing all installments when no commission filter is provided", () => {
		render(<SaleInstallmentsPanel saleId="sale-1" saleStatus="COMPLETED" />);

		expect(screen.getByText("Comissão A")).toBeInTheDocument();
		expect(screen.getByText("Comissão B")).toBeInTheDocument();
		expect(
			screen.getByText("Resumo: 1/2 pagas, 1 pendentes, 0 canceladas."),
		).toBeInTheDocument();
	});
});
