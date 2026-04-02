import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SaleInstallmentsPanel } from "@/pages/_app/sales/-components/sale-installments-panel";

const mocks = vi.hoisted(() => ({
	useSaleCommissionInstallments: vi.fn(),
	reverseInstallment: vi.fn().mockResolvedValue(undefined),
	useProductCommissionReversalRules: vi.fn(),
	canMock: vi.fn(),
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
	useReverseSaleCommissionInstallment: () => ({
		mutateAsync: mocks.reverseInstallment,
		isPending: false,
	}),
	useDeleteSaleCommissionInstallment: () => ({
		mutateAsync: vi.fn().mockResolvedValue(undefined),
		isPending: false,
	}),
}));

vi.mock("@/hooks/commissions", () => ({
	useProductCommissionReversalRules: (...args: unknown[]) =>
		mocks.useProductCommissionReversalRules(...args),
}));

vi.mock("@/permissions/access", () => ({
	useAbility: () => ({
		can: mocks.canMock,
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
		mocks.reverseInstallment.mockReset();
		mocks.useProductCommissionReversalRules.mockReset();
		mocks.canMock.mockReset();
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
		mocks.useProductCommissionReversalRules.mockReturnValue({
			data: { rules: [] },
			isLoading: false,
			isError: false,
		});
		mocks.canMock.mockReturnValue(false);
	});

	it("should show only installments from selected commission when saleCommissionId is provided", () => {
		render(
			<SaleInstallmentsPanel
				saleId="sale-1"
				saleStatus="COMPLETED"
				saleProductId="product-1"
				saleCommissionId="commission-1"
			/>,
		);

		expect(screen.getByText("Comissão A")).toBeInTheDocument();
		expect(screen.queryByText("Comissão B")).not.toBeInTheDocument();
		expect(
			screen.getByText(
				"Resumo: 1/1 pagas, 0 pendentes, 0 canceladas, 0 estornadas.",
			),
		).toBeInTheDocument();
		expect(screen.getAllByText("10/03/2026").length).toBeGreaterThan(0);
	});

	it("should keep showing all installments when no commission filter is provided", () => {
		render(
			<SaleInstallmentsPanel
				saleId="sale-1"
				saleStatus="COMPLETED"
				saleProductId="product-1"
			/>,
		);

		expect(screen.getByText("Comissão A")).toBeInTheDocument();
		expect(screen.getByText("Comissão B")).toBeInTheDocument();
		expect(
			screen.getByText(
				"Resumo: 1/2 pagas, 1 pendentes, 0 canceladas, 0 estornadas.",
			),
		).toBeInTheDocument();
	});

	it("should hide only zero installments when show-zero switch is disabled", () => {
		mocks.useSaleCommissionInstallments.mockReturnValue({
			data: {
				installments: [
					{
						id: "inst-positive",
						saleCommissionId: "commission-1",
						recipientType: "SELLER",
						sourceType: "PULLED",
						direction: "OUTCOME",
						beneficiaryId: "seller-1",
						beneficiaryKey: "SELLER:seller-1",
						beneficiaryLabel: "Comissão Positiva",
						installmentNumber: 1,
						percentage: 2,
						amount: 2000,
						status: "PAID",
						expectedPaymentDate: "2026-03-10T00:00:00.000Z",
						paymentDate: "2026-03-10T00:00:00.000Z",
					},
					{
						id: "inst-negative",
						saleCommissionId: "commission-2",
						recipientType: "PARTNER",
						sourceType: "MANUAL",
						direction: "OUTCOME",
						beneficiaryId: "partner-1",
						beneficiaryKey: "PARTNER:partner-1",
						beneficiaryLabel: "Comissão Estornada",
						installmentNumber: 1,
						percentage: 2,
						amount: -13000,
						status: "REVERSED",
						expectedPaymentDate: "2026-03-11T00:00:00.000Z",
						paymentDate: "2026-03-11T00:00:00.000Z",
					},
					{
						id: "inst-zero",
						saleCommissionId: "commission-3",
						recipientType: "SUPERVISOR",
						sourceType: "MANUAL",
						direction: "OUTCOME",
						beneficiaryId: "supervisor-1",
						beneficiaryKey: "SUPERVISOR:supervisor-1",
						beneficiaryLabel: "Comissão Zerada",
						installmentNumber: 1,
						percentage: 2,
						amount: 0,
						status: "PENDING",
						expectedPaymentDate: "2026-03-12T00:00:00.000Z",
						paymentDate: null,
					},
				],
			},
			isLoading: false,
			isError: false,
			refetch: vi.fn(),
		});

		render(
			<SaleInstallmentsPanel
				saleId="sale-1"
				saleStatus="COMPLETED"
				saleProductId="product-1"
			/>,
		);

		expect(screen.getByText("Comissão Positiva")).toBeInTheDocument();
		expect(screen.getByText("Comissão Estornada")).toBeInTheDocument();
		expect(screen.queryByText("Comissão Zerada")).not.toBeInTheDocument();
	});

	it("should open reversal dialog immediately and show loading until rule calculation is ready", async () => {
		const user = userEvent.setup();
		let productRulesState: {
			data: { rules: Array<{ installmentNumber: number; percentage: number }> } | undefined;
			isLoading: boolean;
			isError: boolean;
		} = {
			data: undefined,
			isLoading: true,
			isError: false,
		};

		mocks.canMock.mockImplementation(
			(_action: string, permission: string) =>
				permission === "sales.commissions.installments.status.change",
		);
		mocks.useProductCommissionReversalRules.mockImplementation(
			() => productRulesState,
		);
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
						amount: 10000,
						status: "PAID",
						expectedPaymentDate: "2026-03-10T00:00:00.000Z",
						paymentDate: "2026-03-10T00:00:00.000Z",
					},
				],
			},
			isLoading: false,
			isError: false,
			refetch: vi.fn(),
		});

		const { container, rerender } = render(
			<SaleInstallmentsPanel
				saleId="sale-1"
				saleStatus="COMPLETED"
				saleProductId="product-1"
			/>,
		);

		const actionsTrigger = container.querySelector(
			'button[aria-haspopup="menu"]',
		);
		expect(actionsTrigger).not.toBeNull();

		await user.click(actionsTrigger as HTMLButtonElement);
		await user.click(screen.getByRole("menuitem", { name: "Estornar parcela" }));

		expect(
			screen.getByText("Calculando regra automática..."),
		).toBeInTheDocument();

		productRulesState = {
			data: {
				rules: [
					{
						installmentNumber: 1,
						percentage: 65,
					},
				],
			},
			isLoading: false,
			isError: false,
		};
		rerender(
			<SaleInstallmentsPanel
				saleId="sale-1"
				saleStatus="COMPLETED"
				saleProductId="product-1"
			/>,
		);

		await waitFor(() => {
			expect(screen.getByDisplayValue("-65.00")).toBeInTheDocument();
		});
	});

	it("should keep reversal dialog open with manual fallback when rule load fails", async () => {
		const user = userEvent.setup();

		mocks.canMock.mockImplementation(
			(_action: string, permission: string) =>
				permission === "sales.commissions.installments.status.change",
		);
		mocks.useProductCommissionReversalRules.mockReturnValue({
			data: undefined,
			isLoading: false,
			isError: true,
		});
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
						amount: 10000,
						status: "PAID",
						expectedPaymentDate: "2026-03-10T00:00:00.000Z",
						paymentDate: "2026-03-10T00:00:00.000Z",
					},
				],
			},
			isLoading: false,
			isError: false,
			refetch: vi.fn(),
		});

		const { container } = render(
			<SaleInstallmentsPanel
				saleId="sale-1"
				saleStatus="COMPLETED"
				saleProductId="product-1"
			/>,
		);

		const actionsTrigger = container.querySelector(
			'button[aria-haspopup="menu"]',
		);
		expect(actionsTrigger).not.toBeNull();

		await user.click(actionsTrigger as HTMLButtonElement);
		await user.click(screen.getByRole("menuitem", { name: "Estornar parcela" }));

		expect(
			screen.getByText("Não foi possível calcular automaticamente."),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Confirmar estorno" }),
		).toBeInTheDocument();
	});

	it("should reject positive reversal input", async () => {
		const user = userEvent.setup();
		mocks.canMock.mockImplementation(
			(_action: string, permission: string) =>
				permission === "sales.commissions.installments.status.change",
		);
		mocks.useProductCommissionReversalRules.mockReturnValue({
			data: {
				rules: [
					{
						installmentNumber: 1,
						percentage: 65,
					},
				],
			},
			isLoading: false,
			isError: false,
		});
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
						amount: 10000,
						status: "PAID",
						expectedPaymentDate: "2026-03-10T00:00:00.000Z",
						paymentDate: "2026-03-10T00:00:00.000Z",
					},
				],
			},
			isLoading: false,
			isError: false,
			refetch: vi.fn(),
		});

		const { container } = render(
			<SaleInstallmentsPanel
				saleId="sale-1"
				saleStatus="COMPLETED"
				saleProductId="product-1"
			/>,
		);

		const actionsTrigger = container.querySelector(
			'button[aria-haspopup="menu"]',
		);
		expect(actionsTrigger).not.toBeNull();

		await user.click(actionsTrigger as HTMLButtonElement);
		await user.click(screen.getByRole("menuitem", { name: "Estornar parcela" }));

		const amountInput = screen.getByPlaceholderText("-130.00");
		await user.clear(amountInput);
		await user.type(amountInput, "50");
		await user.click(screen.getByRole("button", { name: "Confirmar estorno" }));

		await waitFor(() => {
			expect(mocks.reverseInstallment).not.toHaveBeenCalled();
		});
	});
});
