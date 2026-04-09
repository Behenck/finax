import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Dispatch, SetStateAction } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardPartnersOverview } from "../src/pages/_app/_dashboard/-components/dashboard-partners-overview";

const mocks = vi.hoisted(() => {
	const defaults: Record<string, unknown> = {
		startDate: "",
		endDate: "",
		supervisorId: "",
		partnerId: "",
		inactiveMonths: 3,
		dynamicFieldId: "",
		productBreakdownDepth: "FIRST_LEVEL",
	};
	const values = new Map<string, unknown>(Object.entries(defaults));
	const useSalesPartnersDashboard = vi.fn();

	function reset(nextValues: Partial<typeof defaults> = {}) {
		values.clear();
		for (const [key, value] of Object.entries({
			...defaults,
			...nextValues,
		})) {
			values.set(key, value);
		}
		useSalesPartnersDashboard.mockReset();
	}

	return {
		values,
		reset,
		useSalesPartnersDashboard,
	};
});

vi.mock("@tanstack/react-router", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@tanstack/react-router")>();

	return {
		...actual,
		Link: ({
			to,
			children,
			...props
		}: React.ComponentProps<"a"> & { to: string }) => (
			<a href={to} {...props}>
				{children}
			</a>
		),
	};
});

vi.mock("nuqs", async (importOriginal) => {
	const actual = await importOriginal<typeof import("nuqs")>();
	const React = await import("react");

	return {
		...actual,
		useQueryState: (key: string) => {
			const [value, setValue] = React.useState(() => mocks.values.get(key));

			const setQueryState = (
				next: unknown | ((previous: unknown) => unknown),
			) => {
				setValue((previous) => {
					const resolvedValue =
						typeof next === "function"
							? (next as (previous: unknown) => unknown)(previous)
							: next;
					mocks.values.set(key, resolvedValue);
					return resolvedValue;
				});

				return Promise.resolve(null);
			};

			return [
				value,
				setQueryState as Dispatch<SetStateAction<unknown>>,
			] as const;
		},
	};
});

vi.mock("@/hooks/sales", () => ({
	useSalesPartnersDashboard: (...args: unknown[]) =>
		mocks.useSalesPartnersDashboard(...args),
}));

function buildDashboardData() {
	return {
		period: {
			selected: {
				from: "2026-04-01T00:00:00.000Z",
				to: "2026-04-09T00:00:00.000Z",
			},
			inactiveMonths: 3,
			inactiveRange: {
				from: "2026-01-09T00:00:00.000Z",
				to: "2026-04-09T00:00:00.000Z",
			},
			timelineGranularity: "DAY",
		},
		filters: {
			supervisors: [
				{
					id: "supervisor-1",
					name: "Supervisor 1",
				},
			],
			partners: [
				{
					id: "partner-1",
					name: "Parceiro Alpha",
					status: "ACTIVE",
					supervisorId: "supervisor-1",
					supervisorName: "Supervisor 1",
				},
			],
		},
		summary: {
			totalPartners: 1,
			activePartners: 1,
			inactivePartners: 0,
			producingPartners: 1,
			producingPartnersRatePct: 100,
			partnersWithoutProduction: 0,
			totalSales: 3,
			grossAmount: 150_000,
			averageTicket: 50_000,
			averageTicketPerProducingPartner: 150_000,
			commissionReceivedAmount: 15_000,
			commissionPendingAmount: 4_000,
			netRevenueAmount: 12_000,
			delinquentSalesCount: 1,
			delinquentGrossAmount: 30_000,
			delinquencyRateByCountPct: 33.33,
			delinquencyRateByAmountPct: 20,
		},
		ranking: [
			{
				partnerId: "partner-1",
				partnerName: "Parceiro Alpha",
				status: "ACTIVE",
				supervisor: {
					id: "supervisor-1",
					name: "Supervisor 1",
				},
				salesCount: 3,
				grossAmount: 150_000,
				averageTicket: 50_000,
				commissionReceivedAmount: 15_000,
				netRevenueAmount: 12_000,
				delinquentSalesCount: 1,
				delinquentGrossAmount: 30_000,
				delinquencyRateByCountPct: 33.33,
				delinquencyRateByAmountPct: 20,
				lastSaleDate: "2026-04-08T00:00:00.000Z",
			},
		],
		timeline: [
			{
				label: "01/04",
				date: "2026-04-01T00:00:00.000Z",
				salesCount: 1,
				grossAmount: 50_000,
			},
			{
				label: "08/04",
				date: "2026-04-08T00:00:00.000Z",
				salesCount: 2,
				grossAmount: 100_000,
			},
		],
		dynamicFieldBreakdown: {
			availableFields: [
				{
					fieldId: "field-1",
					label: "Canal",
					type: "SELECT",
				},
			],
			selectedFieldId: "field-1",
			selectedFieldLabel: "Canal",
			selectedFieldType: "SELECT",
			items: [
				{
					valueId: "value-1",
					label: "Online",
					salesCount: 3,
					grossAmount: 150_000,
				},
			],
		},
		productBreakdown: {
			items: [
				{
					valueId: "product-1",
					label: "Seguro Auto",
					salesCount: 3,
					grossAmount: 150_000,
				},
			],
		},
		statusFunnel: {
			items: [
				{ status: "PENDING", label: "Pendente", salesCount: 1, grossAmount: 50_000 },
				{ status: "APPROVED", label: "Aprovada", salesCount: 1, grossAmount: 50_000 },
				{ status: "COMPLETED", label: "Concluída", salesCount: 1, grossAmount: 50_000 },
				{ status: "CANCELED", label: "Cancelada", salesCount: 0, grossAmount: 0 },
			],
		},
		pareto: { items: [] },
		ticketByPartner: { items: [] },
		productionHealthTimeline: {
			items: [
				{
					date: "2026-04-01T00:00:00.000Z",
					label: "04/2026",
					producingPartners: 1,
					totalPartners: 1,
					producingRatePct: 100,
				},
			],
		},
		commissionBreakdown: {
			receivedAmount: 15_000,
			pendingAmount: 4_000,
			netRevenueAmount: 12_000,
			pendingByPartner: {
				items: [
					{
						partnerId: "partner-1",
						partnerName: "Parceiro Alpha",
						status: "ACTIVE",
						supervisor: {
							id: "supervisor-1",
							name: "Supervisor 1",
						},
						salesCount: 3,
						grossAmount: 150_000,
						pendingAmount: 4_000,
						lastSaleDate: "2026-04-08T00:00:00.000Z",
					},
				],
			},
		},
		delinquencyBreakdown: {
			totalSales: 1,
			buckets: [],
		},
		recencyBreakdown: {
			buckets: [],
		},
		riskRanking: {
			items: [
				{
					partnerId: "partner-1",
					partnerName: "Parceiro Alpha",
					status: "ACTIVE",
					supervisor: {
						id: "supervisor-1",
						name: "Supervisor 1",
					},
					totalSales: 3,
					grossAmount: 150_000,
					delinquentSalesCount: 1,
					delinquentGrossAmount: 30_000,
					delinquencyRateByCountPct: 33.33,
					delinquencyRateByAmountPct: 20,
					lastSaleDate: "2026-04-08T00:00:00.000Z",
				},
			],
		},
	};
}

describe("DashboardPartnersOverview", () => {
	beforeEach(() => {
		mocks.reset();
	});

	it("should render loading skeleton state", () => {
		mocks.useSalesPartnersDashboard.mockReturnValue({
			isLoading: true,
			isError: false,
			data: undefined,
			refetch: vi.fn(),
		});

		const { container } = render(<DashboardPartnersOverview />);

		expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
	});

	it("should render error state and retry action", async () => {
		const refetch = vi.fn();
		const user = userEvent.setup();

		mocks.useSalesPartnersDashboard.mockReturnValue({
			isLoading: false,
			isError: true,
			data: undefined,
			refetch,
		});

		render(<DashboardPartnersOverview />);

		expect(
			screen.getByText("Não foi possível carregar o dashboard de parceiros."),
		).toBeInTheDocument();

		await user.click(
			screen.getByRole("button", {
				name: "Tentar novamente",
			}),
		);

		expect(refetch).toHaveBeenCalledTimes(1);
	});

	it("should render main dashboard blocks when data is loaded", () => {
		mocks.useSalesPartnersDashboard.mockReturnValue({
			isLoading: false,
			isError: false,
			data: buildDashboardData(),
			refetch: vi.fn(),
		});

		render(<DashboardPartnersOverview />);

		expect(
			screen.getByText("Painel de parceiros e supervisores"),
		).toBeInTheDocument();
		expect(
			screen.getByText("Timeline de produção e faturamento"),
		).toBeInTheDocument();
		expect(screen.getByText("Ranking de parceiros")).toBeInTheDocument();
		expect(screen.getAllByText("Parceiro Alpha").length).toBeGreaterThan(0);
	});
});
