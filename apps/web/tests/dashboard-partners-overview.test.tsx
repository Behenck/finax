import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Dispatch, SetStateAction } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardPartnersOverview } from "../src/pages/_app/_dashboard/-components/dashboard-partners-overview";

const FILTER_START_DATE = "2025-12-01";
const FILTER_END_DATE = "2026-01-10";
const PREVIOUS_MONTH_START_DATE = "2025-12-01";
const PREVIOUS_MONTH_END_DATE = "2025-12-31";

const mocks = vi.hoisted(() => {
	const defaults: Record<string, unknown> = {
		startDate: "2025-12-01",
		endDate: "2026-01-10",
		supervisorId: "",
		partnerIds: "",
		inactiveMonths: 3,
		dynamicFieldId: "",
		productBreakdownDepth: "FIRST_LEVEL",
	};
	const values = new Map<string, unknown>(Object.entries(defaults));
	const usePartnerSalesDashboard = vi.fn();

	function reset(nextValues: Partial<typeof defaults> = {}) {
		values.clear();
		for (const [key, value] of Object.entries({
			...defaults,
			...nextValues,
		})) {
			values.set(key, value);
		}
		usePartnerSalesDashboard.mockReset();
	}

	return {
		values,
		reset,
		usePartnerSalesDashboard,
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
	usePartnerSalesDashboard: (...args: unknown[]) =>
		mocks.usePartnerSalesDashboard(...args),
}));

type RankingItem = {
	partnerId: string;
	partnerName: string;
	supervisorId: string;
	supervisorName: string;
	concludedCount: number;
	concludedAmount: number;
	pendingCount: number;
	pendingAmount: number;
	canceledCount: number;
	canceledAmount: number;
	delinquentCount: number;
	delinquentAmount: number;
};

function buildRankingItem(item: RankingItem) {
	return {
		partnerId: item.partnerId,
		partnerName: item.partnerName,
		status: "ACTIVE",
		supervisors: [
			{
				id: item.supervisorId,
				name: item.supervisorName,
			},
		],
		salesCount: item.concludedCount + item.pendingCount,
		grossAmount: item.concludedAmount + item.pendingAmount,
		averageTicket: 0,
		commissionReceivedAmount: 0,
		netRevenueAmount: 0,
		delinquentSalesCount: item.delinquentCount,
		delinquentGrossAmount: item.delinquentAmount,
		delinquencyRateByCountPct: 0,
		delinquencyRateByAmountPct: 0,
		lastSaleDate: "2026-01-08T00:00:00.000Z",
		salesBreakdown: {
			concluded: {
				salesCount: item.concludedCount,
				grossAmount: item.concludedAmount,
			},
			pending: {
				salesCount: item.pendingCount,
				grossAmount: item.pendingAmount,
			},
			canceled: {
				salesCount: item.canceledCount,
				grossAmount: item.canceledAmount,
			},
		},
	};
}

function buildDashboardData(
	rankingItems: ReturnType<typeof buildRankingItem>[],
) {
	const supervisorsMap = new Map<string, { id: string; name: string }>();
	const partners = rankingItems.map((item) => {
		for (const supervisor of item.supervisors) {
			supervisorsMap.set(supervisor.id, {
				id: supervisor.id,
				name: supervisor.name ?? "",
			});
		}

		return {
			id: item.partnerId,
			name: item.partnerName,
			status: "ACTIVE",
			supervisors: item.supervisors,
		};
	});

	const totalSales = rankingItems.reduce(
		(sum, item) => sum + item.salesCount,
		0,
	);
	const grossAmount = rankingItems.reduce(
		(sum, item) => sum + item.grossAmount,
		0,
	);

	return {
		period: {
			selected: {
				from: "2025-12-01T00:00:00.000Z",
				to: "2026-01-10T00:00:00.000Z",
			},
			inactiveMonths: 3,
			inactiveRange: {
				from: "2025-10-10T00:00:00.000Z",
				to: "2026-01-10T00:00:00.000Z",
			},
			timelineGranularity: "DAY",
		},
		filters: {
			supervisors: [...supervisorsMap.values()],
			partners,
		},
		summary: {
			totalPartners: partners.length,
			activePartners: partners.length,
			inactivePartners: 0,
			producingPartners: partners.length,
			producingPartnersRatePct: 100,
			partnersWithoutProduction: 0,
			totalSales,
			grossAmount,
			averageTicket: 0,
			averageTicketPerProducingPartner: 0,
			commissionReceivedAmount: 0,
			commissionPendingAmount: 0,
			netRevenueAmount: 0,
			delinquentSalesCount: 0,
			delinquentGrossAmount: 0,
			delinquencyRateByCountPct: 0,
			delinquencyRateByAmountPct: 0,
		},
		ranking: rankingItems,
		timeline: [
			{
				label: "01/01",
				date: "2026-01-01T00:00:00.000Z",
				salesCount: totalSales,
				grossAmount,
			},
		],
		dynamicFieldBreakdown: {
			availableFields: [],
			selectedFieldId: null,
			selectedFieldLabel: null,
			selectedFieldType: null,
			items: [],
		},
		productBreakdown: {
			items: [],
		},
		statusFunnel: {
			items: [
				{ status: "PENDING", label: "Pendente", salesCount: 0, grossAmount: 0 },
				{
					status: "APPROVED",
					label: "Aprovada",
					salesCount: 0,
					grossAmount: 0,
				},
				{
					status: "COMPLETED",
					label: "Concluída",
					salesCount: totalSales,
					grossAmount,
				},
				{
					status: "CANCELED",
					label: "Cancelada",
					salesCount: 0,
					grossAmount: 0,
				},
			],
		},
		pareto: { items: [] },
		ticketByPartner: { items: [] },
		productionHealthTimeline: {
			items: [
				{
					date: "2026-01-01T00:00:00.000Z",
					label: "01/2026",
					producingPartners: partners.length,
					totalPartners: partners.length,
					producingRatePct: 100,
				},
			],
		},
		commissionBreakdown: {
			receivedAmount: 0,
			pendingAmount: 0,
			netRevenueAmount: 0,
			pendingByPartner: {
				items: [],
			},
		},
		delinquencyBreakdown: {
			totalSales: 0,
			buckets: [],
		},
		recencyBreakdown: {
			buckets: [],
		},
		riskRanking: {
			items: [],
		},
	};
}

describe("DashboardPartnersOverview", () => {
	beforeEach(() => {
		mocks.reset();
	});

	it("renders loading skeleton while main dashboard query is loading", () => {
		mocks.usePartnerSalesDashboard.mockReturnValue({
			isLoading: true,
			isError: false,
			data: undefined,
			refetch: vi.fn(),
		});

		const { container } = render(<DashboardPartnersOverview />);

		expect(
			container.querySelectorAll('[data-slot="skeleton"]').length,
		).toBeGreaterThan(0);
	});

	it("renders global error state and retries", async () => {
		const refetch = vi.fn();
		const user = userEvent.setup();

		mocks.usePartnerSalesDashboard.mockReturnValue({
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

	it("uses filtered range for dashboard data and previous month only for canceled metrics", () => {
		mocks.usePartnerSalesDashboard.mockReturnValue({
			isLoading: false,
			isError: false,
			data: buildDashboardData([]),
			refetch: vi.fn(),
		});

		render(<DashboardPartnersOverview />);

		const queryCalls = mocks.usePartnerSalesDashboard.mock.calls.map(
			([args]) => args as Record<string, unknown>,
		);
		expect(
			queryCalls.some(
				(call) =>
					call.startDate === FILTER_START_DATE &&
					call.endDate === FILTER_END_DATE,
			),
		).toBe(true);
		expect(
			queryCalls.some(
				(call) =>
					call.startDate === PREVIOUS_MONTH_START_DATE &&
					call.endDate === PREVIOUS_MONTH_END_DATE,
			),
		).toBe(true);
	});

	it("renders supervisors and linked partners from the same filtered ranking data", async () => {
		const user = userEvent.setup();
		mocks.usePartnerSalesDashboard.mockReturnValue({
			isLoading: false,
			isError: false,
			data: buildDashboardData([
				buildRankingItem({
					partnerId: "11111111-1111-1111-1111-111111111111",
					partnerName: "Parceiro Base",
					supervisorId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
					supervisorName: "Supervisor Base",
					concludedCount: 2,
					concludedAmount: 120_000,
					pendingCount: 1,
					pendingAmount: 40_000,
					canceledCount: 0,
					canceledAmount: 0,
					delinquentCount: 0,
					delinquentAmount: 0,
				}),
				buildRankingItem({
					partnerId: "22222222-2222-2222-2222-222222222222",
					partnerName: "Parceiro Alpha",
					supervisorId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
					supervisorName: "Supervisor 1",
					concludedCount: 1,
					concludedAmount: 50_000,
					pendingCount: 0,
					pendingAmount: 0,
					canceledCount: 0,
					canceledAmount: 0,
					delinquentCount: 0,
					delinquentAmount: 0,
				}),
			]),
			refetch: vi.fn(),
		});

		render(<DashboardPartnersOverview />);

		expect(
			screen.getByText(
				"Produção agregada por supervisor no período filtrado, com canceladas do mês anterior.",
			),
		).toBeInTheDocument();
		expect(screen.getByText(/mês anterior/i)).toBeInTheDocument();
		expect(screen.getByText("Supervisor Base")).toBeInTheDocument();
		expect(screen.getByText("Supervisor 1")).toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: /Supervisor Base/i }));
		await user.click(screen.getByRole("button", { name: /Supervisor 1/i }));

		expect(screen.getAllByText("Parceiro Base").length).toBeGreaterThan(0);
		expect(screen.getAllByText("Parceiro Alpha").length).toBeGreaterThan(0);
	});

	it("renders canceled amount from previous month while keeping other metrics from filtered period", async () => {
		const user = userEvent.setup();
		const filteredData = buildDashboardData([
			buildRankingItem({
				partnerId: "11111111-1111-1111-1111-111111111111",
				partnerName: "Parceiro Base",
				supervisorId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
				supervisorName: "Supervisor Base",
				concludedCount: 2,
				concludedAmount: 120_000,
				pendingCount: 1,
				pendingAmount: 40_000,
				canceledCount: 1,
				canceledAmount: 12_345,
				delinquentCount: 0,
				delinquentAmount: 0,
			}),
		]);
		const previousMonthData = buildDashboardData([
			buildRankingItem({
				partnerId: "11111111-1111-1111-1111-111111111111",
				partnerName: "Parceiro Base",
				supervisorId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
				supervisorName: "Supervisor Base",
				concludedCount: 0,
				concludedAmount: 0,
				pendingCount: 0,
				pendingAmount: 0,
				canceledCount: 9,
				canceledAmount: 987_654,
				delinquentCount: 0,
				delinquentAmount: 0,
			}),
		]);

		mocks.usePartnerSalesDashboard.mockImplementation(
			(args: Record<string, unknown>) => {
				if (
					args.startDate === FILTER_START_DATE &&
					args.endDate === FILTER_END_DATE
				) {
					return {
						isLoading: false,
						isError: false,
						data: filteredData,
						refetch: vi.fn(),
					};
				}

				if (
					args.startDate === PREVIOUS_MONTH_START_DATE &&
					args.endDate === PREVIOUS_MONTH_END_DATE
				) {
					return {
						isLoading: false,
						isError: false,
						data: previousMonthData,
						refetch: vi.fn(),
					};
				}

				return {
					isLoading: false,
					isError: false,
					data: filteredData,
					refetch: vi.fn(),
				};
			},
		);

		render(<DashboardPartnersOverview />);
		await user.click(screen.getByRole("button", { name: /Supervisor Base/i }));

		const supervisorTable = screen
			.getByText("Inadimplentes (R$ + qtd)")
			.closest("table");
		expect(supervisorTable).not.toBeNull();
		expect(
			within(supervisorTable as HTMLTableElement).getByText(/1\.200,00/),
		).toBeInTheDocument();
		expect(
			within(supervisorTable as HTMLTableElement).getByText(/9\.876,54/),
		).toBeInTheDocument();
		expect(
			within(supervisorTable as HTMLTableElement).queryByText(/123,45/),
		).not.toBeInTheDocument();
	});
});
