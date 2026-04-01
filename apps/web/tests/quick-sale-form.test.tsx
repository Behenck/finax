import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { QuickSaleForm } from "../src/pages/_app/sales/-components/quick-sale-form";

const ROOT_PRODUCT_ID = "11111111-1111-4111-8111-111111111111";
const CHILD_PRODUCT_A_ID = "22222222-2222-4222-8222-222222222222";
const CHILD_PRODUCT_B_ID = "33333333-3333-4333-8333-333333333333";
const CUSTOMER_ID = "44444444-4444-4444-8444-444444444444";
const SECOND_CUSTOMER_ID = "88888888-8888-4888-8888-888888888888";
const COMPANY_ID = "55555555-5555-4555-8555-555555555555";
const UNIT_ID = "66666666-6666-4666-8666-666666666666";
const SELLER_ID = "77777777-7777-4777-8777-777777777777";

function createWrapper() {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				retry: false,
			},
		},
	});

	return function Wrapper({ children }: { children: ReactNode }) {
		return (
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		);
	};
}

function renderQuickSaleForm(
	props: Partial<React.ComponentProps<typeof QuickSaleForm>> = {},
) {
	const defaultOnSubmitBatch = vi.fn().mockResolvedValue(undefined);
	const defaultOnSuccess = vi.fn();
	const defaultLoadProductDynamicFields = vi.fn().mockResolvedValue([]);
	const onSubmitBatch = props.onSubmitBatch ?? defaultOnSubmitBatch;
	const onSuccess = props.onSuccess ?? defaultOnSuccess;
	const loadProductDynamicFields =
		props.loadProductDynamicFields ?? defaultLoadProductDynamicFields;

	const result = render(
		<QuickSaleForm
			rootProducts={[
				{
					id: ROOT_PRODUCT_ID,
					name: "Produto Pai",
					label: "Produto Pai",
				},
			]}
			hierarchicalProducts={[
				{
					id: ROOT_PRODUCT_ID,
					name: "Produto Pai",
					path: ["Produto Pai"],
					label: "Produto Pai",
					rootId: ROOT_PRODUCT_ID,
					rootName: "Produto Pai",
					depth: 0,
					relativeLabel: "Produto Pai",
					fullLabel: "Produto Pai",
				},
				{
					id: CHILD_PRODUCT_A_ID,
					name: "Subproduto A",
					path: ["Produto Pai", "Subproduto A"],
					label: "Produto Pai -> Subproduto A",
					rootId: ROOT_PRODUCT_ID,
					rootName: "Produto Pai",
					depth: 1,
					relativeLabel: "Subproduto A",
					fullLabel: "Produto Pai -> Subproduto A",
				},
				{
					id: CHILD_PRODUCT_B_ID,
					name: "Subproduto B",
					path: ["Produto Pai", "Subproduto B"],
					label: "Produto Pai -> Subproduto B",
					rootId: ROOT_PRODUCT_ID,
					rootName: "Produto Pai",
					depth: 1,
					relativeLabel: "Subproduto B",
					fullLabel: "Produto Pai -> Subproduto B",
				},
			]}
			customers={[
				{
					id: CUSTOMER_ID,
					name: "Cliente Teste",
					documentType: "CPF",
					documentNumber: "12345678901",
					phone: "11999999999",
				},
			]}
			companies={[
				{
					id: COMPANY_ID,
					name: "Empresa Teste",
					units: [
						{
							id: UNIT_ID,
							name: "Unidade Teste",
						},
					],
				},
			]}
			sellers={[
				{
					id: SELLER_ID,
					name: "Vendedor Teste",
				},
			]}
			partners={[]}
			loadProductDynamicFields={loadProductDynamicFields}
			onSubmitBatch={onSubmitBatch}
			onSuccess={onSuccess}
			initialValues={{
				parentProductId: ROOT_PRODUCT_ID,
				companyId: COMPANY_ID,
				unitId: UNIT_ID,
				responsibleType: "SELLER",
				responsibleId: SELLER_ID,
				items: [
					{
						customerId: CUSTOMER_ID,
						productId: CHILD_PRODUCT_A_ID,
						quantity: "1",
						saleDate: "2026-03-10",
						totalAmount: "R$ 1.000,00",
						dynamicFields: {},
					},
				],
			}}
			{...props}
		/>,
		{
			wrapper: createWrapper(),
		},
	);

	return {
		...result,
		onSubmitBatch,
		onSuccess,
		loadProductDynamicFields,
	};
}

describe("quick-sale-form", () => {
	it("should add and remove items while enforcing maximum of 50", async () => {
		const user = userEvent.setup();
		renderQuickSaleForm({
			initialValues: {
				parentProductId: ROOT_PRODUCT_ID,
				companyId: COMPANY_ID,
				unitId: UNIT_ID,
				responsibleType: "SELLER",
				responsibleId: SELLER_ID,
				items: [
					{
						customerId: CUSTOMER_ID,
						productId: CHILD_PRODUCT_A_ID,
						quantity: "49",
						saleDate: "2026-03-10",
						totalAmount: "R$ 1.000,00",
						dynamicFields: {},
					},
				],
			},
		});

		const addButton = screen.getByRole("button", { name: "Adicionar item" });
		await user.click(addButton);

		expect(screen.getAllByText(/Item \d+/)).toHaveLength(2);
		expect(addButton).toBeDisabled();

		const removeSecondItemButton = screen.getByRole("button", {
			name: "Remover item 2",
		});
		await user.click(removeSecondItemButton);

		expect(screen.getAllByText(/Item \d+/)).toHaveLength(1);
	});

	it("should prefill added item product based on the last item product", async () => {
		const user = userEvent.setup();
		const { onSubmitBatch } = renderQuickSaleForm({
			initialValues: {
				parentProductId: ROOT_PRODUCT_ID,
				companyId: COMPANY_ID,
				unitId: UNIT_ID,
				responsibleType: "SELLER",
				responsibleId: SELLER_ID,
				items: [
					{
						customerId: CUSTOMER_ID,
						productId: CHILD_PRODUCT_B_ID,
						quantity: "1",
						saleDate: "2026-03-10",
						totalAmount: "R$ 1.000,00",
						dynamicFields: {},
					},
				],
			},
		});

		await user.click(screen.getByRole("button", { name: "Adicionar item" }));

		const totalAmountInputs = screen.getAllByPlaceholderText("R$ 0,00");
		await user.clear(totalAmountInputs[1] as HTMLInputElement);
		await user.type(totalAmountInputs[1] as HTMLInputElement, "100");
		await user.click(screen.getByRole("button", { name: "Salvar vendas" }));

		await waitFor(() => {
			expect(onSubmitBatch).toHaveBeenCalledTimes(1);
		});

		const payload = onSubmitBatch.mock.calls[0]?.[0];
		expect(payload.items).toHaveLength(2);
		expect(payload.items[0]?.customerId).toBe(CUSTOMER_ID);
		expect(payload.items[1]?.customerId).toBe(CUSTOMER_ID);
		expect(payload.items[0]?.productId).toBe(CHILD_PRODUCT_B_ID);
		expect(payload.items[1]?.productId).toBe(CHILD_PRODUCT_B_ID);
	});

	it("should duplicate the clicked item and preserve customer", async () => {
		const user = userEvent.setup();
		const { onSubmitBatch } = renderQuickSaleForm();

		await user.click(screen.getByRole("button", { name: "Duplicar item 1" }));
		await user.click(screen.getByRole("button", { name: "Salvar vendas" }));

		expect(screen.getAllByText(/Item \d+/)).toHaveLength(2);
		expect(screen.getAllByDisplayValue("R$ 1.000,00")).toHaveLength(2);
		await waitFor(() => {
			expect(onSubmitBatch).toHaveBeenCalledTimes(1);
		});
		const payload = onSubmitBatch.mock.calls[0]?.[0];
		expect(payload.items[0]?.customerId).toBe(CUSTOMER_ID);
		expect(payload.items[1]?.customerId).toBe(CUSTOMER_ID);
	});

	it("should disable copy when duplicating would exceed total limit", () => {
		renderQuickSaleForm({
			initialValues: {
				parentProductId: ROOT_PRODUCT_ID,
				companyId: COMPANY_ID,
				unitId: UNIT_ID,
				responsibleType: "SELLER",
				responsibleId: SELLER_ID,
				items: [
					{
						customerId: CUSTOMER_ID,
						productId: CHILD_PRODUCT_A_ID,
						quantity: "50",
						saleDate: "2026-03-10",
						totalAmount: "R$ 1.000,00",
						dynamicFields: {},
					},
				],
			},
		});

		expect(
			screen.getByRole("button", { name: "Duplicar item 1" }),
		).toBeDisabled();
	});

	it("should render dynamic fields by item product", async () => {
		const loadProductDynamicFields = vi
			.fn()
			.mockImplementation(async (productId: string) => {
				if (productId === CHILD_PRODUCT_A_ID) {
					return [
						{
							fieldId: "field-a",
							label: "Campo A",
							type: "TEXT",
							required: false,
							options: [],
						},
					];
				}

				if (productId === CHILD_PRODUCT_B_ID) {
					return [
						{
							fieldId: "field-b",
							label: "Campo B",
							type: "TEXT",
							required: false,
							options: [],
						},
					];
				}

				return [];
			});

		renderQuickSaleForm({
			loadProductDynamicFields,
			initialValues: {
				parentProductId: ROOT_PRODUCT_ID,
				companyId: COMPANY_ID,
				unitId: UNIT_ID,
				responsibleType: "SELLER",
				responsibleId: SELLER_ID,
				items: [
					{
						customerId: CUSTOMER_ID,
						productId: CHILD_PRODUCT_A_ID,
						quantity: "1",
						saleDate: "2026-03-10",
						totalAmount: "R$ 1.000,00",
						dynamicFields: {},
					},
					{
						customerId: CUSTOMER_ID,
						productId: CHILD_PRODUCT_B_ID,
						quantity: "1",
						saleDate: "2026-03-11",
						totalAmount: "R$ 2.000,00",
						dynamicFields: {},
					},
				],
			},
		});

		await waitFor(() => {
			expect(screen.getByText("Campo A")).toBeInTheDocument();
			expect(screen.getByText("Campo B")).toBeInTheDocument();
		});
	});

	it("should search customers with 3 letters and select from suggestions", async () => {
		const user = userEvent.setup();

		renderQuickSaleForm({
			customers: [
				{
					id: CUSTOMER_ID,
					name: "Cliente Teste",
					documentType: "CPF",
					documentNumber: "12345678901",
					phone: "11999999999",
				},
				{
					id: SECOND_CUSTOMER_ID,
					name: "Claudio Braga",
					documentType: "CPF",
					documentNumber: "98765432100",
					phone: "11988887777",
				},
			],
			initialValues: {
				parentProductId: ROOT_PRODUCT_ID,
				companyId: COMPANY_ID,
				unitId: UNIT_ID,
				responsibleType: "SELLER",
				responsibleId: SELLER_ID,
				items: [
					{
						customerId: "",
						productId: CHILD_PRODUCT_A_ID,
						quantity: "1",
						saleDate: "2026-03-10",
						totalAmount: "R$ 1.000,00",
						dynamicFields: {},
					},
				],
			},
		});

		const customerInput = screen.getByPlaceholderText(
			"Digite o nome, documento ou celular do cliente",
		);

		await user.type(customerInput, "Cl");
		expect(
			screen.getByText("Digite pelo menos 3 letras para buscar clientes."),
		).toBeInTheDocument();

		await user.type(customerInput, "a");
		await user.click(screen.getByRole("button", { name: /Claudio Braga/i }));

		expect(customerInput).toHaveValue("Claudio Braga");
		expect(
			screen.getByRole("button", { name: "Editar cliente" }),
		).toBeInTheDocument();
	});

	it("should submit distinct customers across different items", async () => {
		const user = userEvent.setup();
		const { onSubmitBatch } = renderQuickSaleForm({
			customers: [
				{
					id: CUSTOMER_ID,
					name: "Cliente Teste",
					documentType: "CPF",
					documentNumber: "12345678901",
					phone: "11999999999",
				},
				{
					id: SECOND_CUSTOMER_ID,
					name: "Claudio Braga",
					documentType: "CPF",
					documentNumber: "98765432100",
					phone: "11988887777",
				},
			],
			initialValues: {
				parentProductId: ROOT_PRODUCT_ID,
				companyId: COMPANY_ID,
				unitId: UNIT_ID,
				responsibleType: "SELLER",
				responsibleId: SELLER_ID,
				items: [
					{
						customerId: CUSTOMER_ID,
						productId: CHILD_PRODUCT_A_ID,
						quantity: "1",
						saleDate: "2026-03-10",
						totalAmount: "R$ 1.000,00",
						dynamicFields: {},
					},
					{
						customerId: "",
						productId: CHILD_PRODUCT_B_ID,
						quantity: "1",
						saleDate: "2026-03-11",
						totalAmount: "R$ 2.000,00",
						dynamicFields: {},
					},
				],
			},
		});

		const customerInputs = screen.getAllByPlaceholderText(
			"Digite o nome, documento ou celular do cliente",
		);
		await user.type(customerInputs[1] as HTMLInputElement, "Cla");
		await user.click(screen.getByRole("button", { name: /Claudio Braga/i }));
		await user.click(screen.getByRole("button", { name: "Salvar vendas" }));

		await waitFor(() => {
			expect(onSubmitBatch).toHaveBeenCalledTimes(1);
		});
		const payload = onSubmitBatch.mock.calls[0]?.[0];
		expect(payload.items).toHaveLength(2);
		expect(payload.items[0]?.customerId).toBe(CUSTOMER_ID);
		expect(payload.items[1]?.customerId).toBe(SECOND_CUSTOMER_ID);
	});

	it("should require customer per item before submit", async () => {
		const user = userEvent.setup();
		const { onSubmitBatch } = renderQuickSaleForm({
			initialValues: {
				parentProductId: ROOT_PRODUCT_ID,
				companyId: COMPANY_ID,
				unitId: UNIT_ID,
				responsibleType: "SELLER",
				responsibleId: SELLER_ID,
				items: [
					{
						customerId: "",
						productId: CHILD_PRODUCT_A_ID,
						quantity: "1",
						saleDate: "2026-03-10",
						totalAmount: "R$ 1.000,00",
						dynamicFields: {},
					},
				],
			},
		});

		await user.click(screen.getByRole("button", { name: "Salvar vendas" }));

		await waitFor(() => {
			expect(onSubmitBatch).not.toHaveBeenCalled();
		});
		expect(screen.getByText("Selecione o cliente do item")).toBeInTheDocument();
	});

	it("should submit and call success callback", async () => {
		const user = userEvent.setup();
		const { onSubmitBatch, onSuccess } = renderQuickSaleForm();

		await user.click(screen.getByRole("button", { name: "Salvar vendas" }));

		await waitFor(() => {
			expect(onSubmitBatch).toHaveBeenCalledTimes(1);
		});

		expect(onSuccess).toHaveBeenCalledTimes(1);
		expect(onSubmitBatch).toHaveBeenCalledWith(
			expect.objectContaining({
				parentProductId: ROOT_PRODUCT_ID,
				companyId: COMPANY_ID,
				items: [
					expect.objectContaining({
						customerId: CUSTOMER_ID,
						productId: CHILD_PRODUCT_A_ID,
						totalAmount: 100_000,
					}),
				],
			}),
		);
	});

	it("should replicate item by quantity on submit", async () => {
		const user = userEvent.setup();
		const { onSubmitBatch } = renderQuickSaleForm({
			initialValues: {
				parentProductId: ROOT_PRODUCT_ID,
				companyId: COMPANY_ID,
				unitId: UNIT_ID,
				responsibleType: "SELLER",
				responsibleId: SELLER_ID,
				items: [
					{
						customerId: CUSTOMER_ID,
						productId: CHILD_PRODUCT_A_ID,
						quantity: "3",
						saleDate: "2026-03-10",
						totalAmount: "R$ 1.000,00",
						dynamicFields: {},
					},
				],
			},
		});

		await user.click(screen.getByRole("button", { name: "Salvar vendas" }));

		await waitFor(() => {
			expect(onSubmitBatch).toHaveBeenCalledTimes(1);
		});

		const payload = onSubmitBatch.mock.calls[0]?.[0];
		expect(payload.items).toHaveLength(3);
		expect(
			payload.items.every(
				(item: { customerId: string }) => item.customerId === CUSTOMER_ID,
			),
		).toBe(true);
		expect(
			payload.items.every(
				(item: { productId: string }) => item.productId === CHILD_PRODUCT_A_ID,
			),
		).toBe(true);
	});

	it("should keep form values and show error message when submit fails", async () => {
		const user = userEvent.setup();
		const { onSubmitBatch } = renderQuickSaleForm({
			onSubmitBatch: vi.fn().mockRejectedValue({
				response: {
					data: {
						message: "Falha ao salvar lote",
					},
				},
			}),
		});

		await user.click(screen.getByRole("button", { name: "Salvar vendas" }));

		await waitFor(() => {
			expect(onSubmitBatch).toHaveBeenCalledTimes(1);
			expect(screen.getByText("Falha ao salvar lote")).toBeInTheDocument();
		});

		expect(screen.getByDisplayValue("R$ 1.000,00")).toBeInTheDocument();
	});
});
