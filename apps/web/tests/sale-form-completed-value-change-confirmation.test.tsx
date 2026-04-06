import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useController } from "react-hook-form";
import type { ReactNode } from "react";
import { z } from "zod";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SaleForm } from "../src/pages/_app/sales/-components/sale-form";
import type { SaleDetail } from "../src/pages/_app/sales/-components/sale-form/types";

const mocks = vi.hoisted(() => ({
	updateSaleMock: vi.fn().mockResolvedValue(undefined),
	navigateMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@tanstack/react-router", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@tanstack/react-router")>();

	return {
		...actual,
		useNavigate: () => mocks.navigateMock,
	};
});

vi.mock("@/context/app-context", () => ({
	useApp: () => ({
		organization: {
			slug: "org-test",
		},
	}),
}));

vi.mock("@/permissions/access", () => ({
	useAbility: () => ({
		can: () => true,
	}),
}));

vi.mock("@/schemas/sale-schema", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/schemas/sale-schema")>();

	return {
		...actual,
		saleSchema: z.object({
			saleDate: z.coerce.date(),
			customerId: z.string(),
			productId: z.string(),
			companyId: z.string(),
			unitId: z.string().optional(),
			responsibleType: z.enum(["SELLER", "PARTNER"]),
			responsibleId: z.string(),
			totalAmount: z.string().min(1),
			notes: z.string().optional(),
			dynamicFields: z.record(z.string(), z.unknown()).default({}),
			commissions: z.array(z.any()).optional(),
		}),
	};
});

vi.mock("@/hooks/sales", () => ({
	useCreateSale: () => ({
		mutateAsync: vi.fn().mockResolvedValue({
			saleId: "sale-1",
		}),
		isPending: false,
	}),
	useUpdateSale: () => ({
		mutateAsync: mocks.updateSaleMock,
		isPending: false,
	}),
	useSaleFormOptions: () => ({
		companies: [
			{
				id: "company-1",
				name: "Empresa Teste",
				units: [],
				employees: [],
			},
		],
		customers: [
			{
				id: "customer-1",
				name: "Cliente Teste",
			},
		],
		hierarchicalProducts: [
			{
				id: "product-1",
				name: "Produto Teste",
				path: ["Produto Teste"],
				label: "Produto Teste",
				rootId: "product-1",
				rootName: "Produto Teste",
				depth: 0,
				relativeLabel: "Produto Teste",
				fullLabel: "Produto Teste",
			},
		],
		sellers: [
			{
				id: "seller-1",
				name: "Vendedor Teste",
			},
		],
		partners: [],
		supervisors: [],
		isLoading: false,
		isError: false,
		refetch: vi.fn().mockResolvedValue(undefined),
	}),
}));

vi.mock(
	"../src/pages/_app/sales/-components/sale-form/hooks/use-sale-commissions",
	() => ({
		useSaleCommissions: () => ({
			commissionScenariosQuery: {
				isFetching: false,
				isError: false,
			},
			hasSelectedProduct: true,
			hasRequestedCommissionForCurrentProduct: true,
			hasLoadedCommissionForCurrentProduct: true,
			matchedCommissionScenario: null,
			pulledCommissionsCount: 0,
			handleFetchCommissionScenarios: vi.fn(),
			handleAddManualCommission: vi.fn(),
			handleRemoveCommission: vi.fn(),
			handleRemovePulledCommissions: vi.fn(),
			handleInstallmentCountChange: vi.fn(),
			resetOnProductChange: vi.fn(),
		}),
	}),
);

vi.mock(
	"../src/pages/_app/sales/-components/sale-form/hooks/use-sale-dynamic-fields",
	() => ({
		useSaleDynamicFields: () => ({
			dynamicFieldSchema: [],
			isDynamicFieldsLoading: false,
		}),
	}),
);

vi.mock(
	"../src/pages/_app/sales/-components/sale-form/hooks/use-quick-customer",
	() => ({
		useQuickCustomer: () => ({
			quickCreatedCustomer: null,
			createQuickCustomer: vi.fn().mockResolvedValue(undefined),
			isCreatingQuickCustomer: false,
		}),
	}),
);

vi.mock(
	"../src/pages/_app/sales/-components/sale-form/sections/product-section",
	() => ({
		ProductSection: () => null,
	}),
);
vi.mock(
	"../src/pages/_app/sales/-components/sale-form/sections/customer-section",
	() => ({
		CustomerSection: () => null,
	}),
);
vi.mock(
	"../src/pages/_app/sales/-components/sale-form/sections/classification-section",
	() => ({
		ClassificationSection: () => null,
	}),
);
vi.mock(
	"../src/pages/_app/sales/-components/sale-form/sections/dynamic-fields-section",
	() => ({
		DynamicFieldsSection: () => null,
	}),
);
vi.mock(
	"../src/pages/_app/sales/-components/sale-form/sections/commissions-section",
	() => ({
		CommissionsSection: () => null,
	}),
);
vi.mock(
	"../src/pages/_app/sales/-components/sale-form/sections/notes-section",
	() => ({
		NotesSection: () => null,
	}),
);
vi.mock(
	"../src/pages/_app/sales/-components/sale-form/sections/sale-data-section",
	() => ({
		SaleDataSection: ({ control }: { control: unknown }) => {
			const { field } = useController({
				control: control as never,
				name: "totalAmount",
			});

			return (
				<input
					aria-label="Total amount"
					value={(field.value as string | undefined) ?? ""}
					onChange={(event) => field.onChange(event.target.value)}
				/>
			);
		},
	}),
);
vi.mock(
	"../src/pages/_app/sales/-components/sale-form/sections/submit-actions",
	() => ({
		SubmitActions: () => <button type="submit">Salvar</button>,
	}),
);

vi.mock(
	"../src/pages/_app/sales/-components/sale-form/dialogs/quick-customer-dialog",
	() => ({
		QuickCustomerDialog: () => null,
	}),
);
vi.mock(
	"../src/pages/_app/sales/-components/sale-form/dialogs/edit-selected-customer-dialog",
	() => ({
		EditSelectedCustomerDialog: () => null,
	}),
);

function buildInitialSale(): SaleDetail {
	return {
		id: "sale-1",
		organizationId: "org-1",
		companyId: "company-1",
		unitId: null,
		customerId: "customer-1",
		productId: "product-1",
		responsibleType: "SELLER",
		responsibleId: "seller-1",
		createdById: "user-1",
		saleDate: "2026-03-10T00:00:00.000Z",
		totalAmount: 100_000,
		status: "COMPLETED",
		notes: null,
		createdAt: "2026-03-10T00:00:00.000Z",
		updatedAt: "2026-03-10T00:00:00.000Z",
		customer: {
			id: "customer-1",
			name: "Cliente Teste",
		},
		product: {
			id: "product-1",
			name: "Produto Teste",
		},
		company: {
			id: "company-1",
			name: "Empresa Teste",
		},
		unit: null,
		createdBy: {
			id: "user-1",
			name: "Usuário Teste",
			avatarUrl: null,
		},
		responsible: {
			type: "SELLER",
			id: "seller-1",
			name: "Vendedor Teste",
		},
		dynamicFieldSchema: [],
		dynamicFieldValues: {},
		commissions: [
			{
				id: "commission-1",
				sourceType: "PULLED",
				recipientType: "SELLER",
				direction: "OUTCOME",
				calculationBase: "SALE_TOTAL",
				beneficiaryId: "seller-1",
				beneficiaryLabel: "Vendedor Teste",
				startDate: "2026-03-10T00:00:00.000Z",
				totalPercentage: 1,
				totalAmount: 1_000,
				sortOrder: 0,
				installments: [
					{
						installmentNumber: 1,
						percentage: 1,
						amount: 1_000,
						status: "PENDING",
						expectedPaymentDate: "2026-03-10T00:00:00.000Z",
						paymentDate: null,
					},
				],
			},
		],
	} as SaleDetail;
}

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

function renderSaleForm() {
	return render(<SaleForm mode="UPDATE" initialSale={buildInitialSale()} />, {
		wrapper: createWrapper(),
	});
}

describe("sale-form completed value change confirmation", () => {
	beforeEach(() => {
		mocks.updateSaleMock.mockReset();
		mocks.updateSaleMock.mockResolvedValue(undefined);
		mocks.navigateMock.mockReset();
		mocks.navigateMock.mockResolvedValue(undefined);
	});

	it("opens confirmation and sends applyValueChangeToCommissions=true when applying to pending installments", async () => {
		const user = userEvent.setup();

		renderSaleForm();

		const totalAmountInput = screen.getByLabelText("Total amount");
		await user.clear(totalAmountInput);
		await user.type(totalAmountInput, "2000");

		await user.click(screen.getByRole("button", { name: "Salvar" }));

		expect(
			await screen.findByText("Aplicar alteração de valor nas comissões?"),
		).toBeInTheDocument();
		expect(mocks.updateSaleMock).not.toHaveBeenCalled();

		await user.click(
			await screen.findByRole("button", { name: "Aplicar nas pendentes" }),
		);

		await waitFor(() => {
			expect(mocks.updateSaleMock).toHaveBeenCalledWith({
				saleId: "sale-1",
				data: expect.objectContaining({
					totalAmount: 200_000,
					applyValueChangeToCommissions: true,
				}),
			});
		});
	});

	it("sends applyValueChangeToCommissions=false when user chooses not to apply", async () => {
		const user = userEvent.setup();

		renderSaleForm();

		const totalAmountInput = screen.getByLabelText("Total amount");
		await user.clear(totalAmountInput);
		await user.type(totalAmountInput, "2000");

		await user.click(screen.getByRole("button", { name: "Salvar" }));
		await user.click(await screen.findByRole("button", { name: "Não aplicar" }));

		await waitFor(() => {
			expect(mocks.updateSaleMock).toHaveBeenCalledWith({
				saleId: "sale-1",
				data: expect.objectContaining({
					totalAmount: 200_000,
					applyValueChangeToCommissions: false,
				}),
			});
		});
	});
});
