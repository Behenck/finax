import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Dispatch, SetStateAction } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	DashboardPartnersOverview,
	dedupeAvailableDynamicFields,
} from "../src/pages/_app/_dashboard/-components/dashboard-partners-overview";

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
			partnerName: item.partnerName,
			partnerCompanyName: null,
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
			preCancellation: {
				threshold: null,
				salesCount: 0,
				grossAmount: 0,
			},
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

	it("renders dashboard content inside the reveal wrapper after loading", () => {
		mocks.usePartnerSalesDashboard.mockReturnValue({
			isLoading: false,
			isError: false,
			data: buildDashboardData([]),
			refetch: vi.fn(),
		});

		const { container } = render(<DashboardPartnersOverview />);

		expect(
			container.querySelector('[data-slot="loading-reveal"]'),
		).toBeInTheDocument();
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

	it("renders delinquency buckets by open count and highlights pre-cancellation", () => {
		const data = buildDashboardData([]);
		data.delinquencyBreakdown = {
			totalSales: 3,
			preCancellation: {
				threshold: 3,
				salesCount: 1,
				grossAmount: 150000,
			},
			buckets: [
				{
					key: "OPEN_COUNT_1",
					label: "1 inadimplência",
					salesCount: 1,
					grossAmount: 40000,
				},
				{
					key: "OPEN_COUNT_2",
					label: "2 inadimplências",
					salesCount: 1,
					grossAmount: 60000,
				},
				{
					key: "PRE_CANCELLATION",
					label: "Pré-cancelamento",
					salesCount: 1,
					grossAmount: 150000,
				},
			],
		};

		mocks.usePartnerSalesDashboard.mockReturnValue({
			isLoading: false,
			isError: false,
			data,
			refetch: vi.fn(),
		});

		render(<DashboardPartnersOverview />);

		expect(screen.getByText("1 inadimplência")).toBeInTheDocument();
		expect(screen.getByText("2 inadimplências")).toBeInTheDocument();
		expect(screen.getAllByText("Pré-cancelamento").length).toBeGreaterThan(0);
		expect(screen.getByText("A partir de 3 inadimplências")).toBeInTheDocument();
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

	it("keeps the selected partner filter while the dashboard refetches", async () => {
		const user = userEvent.setup();
		const partnerId = "11111111-1111-4111-8111-111111111111";

		mocks.usePartnerSalesDashboard.mockImplementation(
			(args: { partnerIds?: string }) => {
				if (args.partnerIds) {
					return {
						isLoading: true,
						isError: false,
						data: undefined,
						refetch: vi.fn(),
					};
				}

				return {
					isLoading: false,
					isError: false,
					data: buildDashboardData([
						buildRankingItem({
							partnerId,
							partnerName: "Parceiro Alpha",
							supervisorId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
							supervisorName: "Supervisor Base",
							concludedCount: 0,
							concludedAmount: 0,
							pendingCount: 0,
							pendingAmount: 0,
							canceledCount: 0,
							canceledAmount: 0,
							delinquentCount: 0,
							delinquentAmount: 0,
						}),
					]),
					refetch: vi.fn(),
				};
			},
		);

		render(<DashboardPartnersOverview />);

		await user.click(screen.getByRole("button", { name: "Filtros" }));
		await user.click(screen.getByRole("button", { name: /Todos os parceiros/i }));
		await user.click(screen.getByText("Parceiro Alpha"));

		expect(mocks.values.get("partnerIds")).toBe(partnerId);
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

	it("renders the full partner ranking inside a scroll area with fixed height", () => {
		mocks.usePartnerSalesDashboard.mockReturnValue({
			isLoading: false,
			isError: false,
			data: buildDashboardData([
				buildRankingItem({
					partnerId: "10000000-0000-0000-0000-000000000001",
					partnerName: "Parceiro 1",
					supervisorId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
					supervisorName: "Supervisor Base",
					concludedCount: 5,
					concludedAmount: 500_000,
					pendingCount: 1,
					pendingAmount: 50_000,
					canceledCount: 0,
					canceledAmount: 0,
					delinquentCount: 0,
					delinquentAmount: 0,
				}),
				buildRankingItem({
					partnerId: "10000000-0000-0000-0000-000000000002",
					partnerName: "Parceiro 2",
					supervisorId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
					supervisorName: "Supervisor Base",
					concludedCount: 4,
					concludedAmount: 400_000,
					pendingCount: 1,
					pendingAmount: 40_000,
					canceledCount: 0,
					canceledAmount: 0,
					delinquentCount: 0,
					delinquentAmount: 0,
				}),
				buildRankingItem({
					partnerId: "10000000-0000-0000-0000-000000000003",
					partnerName: "Parceiro 3",
					supervisorId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
					supervisorName: "Supervisor Base",
					concludedCount: 3,
					concludedAmount: 300_000,
					pendingCount: 1,
					pendingAmount: 30_000,
					canceledCount: 0,
					canceledAmount: 0,
					delinquentCount: 0,
					delinquentAmount: 0,
				}),
				buildRankingItem({
					partnerId: "10000000-0000-0000-0000-000000000004",
					partnerName: "Parceiro 4",
					supervisorId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
					supervisorName: "Supervisor Base",
					concludedCount: 2,
					concludedAmount: 200_000,
					pendingCount: 1,
					pendingAmount: 20_000,
					canceledCount: 0,
					canceledAmount: 0,
					delinquentCount: 0,
					delinquentAmount: 0,
				}),
				buildRankingItem({
					partnerId: "10000000-0000-0000-0000-000000000005",
					partnerName: "Parceiro 5",
					supervisorId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
					supervisorName: "Supervisor Base",
					concludedCount: 2,
					concludedAmount: 190_000,
					pendingCount: 0,
					pendingAmount: 0,
					canceledCount: 0,
					canceledAmount: 0,
					delinquentCount: 0,
					delinquentAmount: 0,
				}),
				buildRankingItem({
					partnerId: "10000000-0000-0000-0000-000000000006",
					partnerName: "Parceiro 6",
					supervisorId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
					supervisorName: "Supervisor Base",
					concludedCount: 1,
					concludedAmount: 180_000,
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

		const { container } = render(<DashboardPartnersOverview />);

		expect(screen.getAllByText("Parceiro 1").length).toBeGreaterThan(0);
		expect(screen.getAllByText("Parceiro 6").length).toBeGreaterThan(0);

		const scrollArea = container.querySelector(
			'[data-slot="scroll-area"].h-\\[19rem\\]',
		);
		expect(scrollArea).toBeInTheDocument();
		expect(screen.getByText("Participação por parceiro")).toBeInTheDocument();
	});

	it("shows podium details when hovering the top ranked partner", async () => {
		const user = userEvent.setup();

		mocks.usePartnerSalesDashboard.mockReturnValue({
			isLoading: false,
			isError: false,
			data: buildDashboardData([
				buildRankingItem({
					partnerId: "10000000-0000-0000-0000-000000000001",
					partnerName: "Parceiro 1",
					supervisorId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
					supervisorName: "Supervisor Base",
					concludedCount: 5,
					concludedAmount: 500_000,
					pendingCount: 1,
					pendingAmount: 50_000,
					canceledCount: 1,
					canceledAmount: 25_000,
					delinquentCount: 0,
					delinquentAmount: 0,
				}),
				buildRankingItem({
					partnerId: "10000000-0000-0000-0000-000000000002",
					partnerName: "Parceiro 2",
					supervisorId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
					supervisorName: "Supervisor Base",
					concludedCount: 4,
					concludedAmount: 400_000,
					pendingCount: 0,
					pendingAmount: 0,
					canceledCount: 0,
					canceledAmount: 0,
					delinquentCount: 0,
					delinquentAmount: 0,
				}),
				buildRankingItem({
					partnerId: "10000000-0000-0000-0000-000000000003",
					partnerName: "Parceiro 3",
					supervisorId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
					supervisorName: "Supervisor Base",
					concludedCount: 3,
					concludedAmount: 300_000,
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

		await user.hover(
			screen.getByRole("button", {
				name: /detalhes do parceiro parceiro 1 na posição 1/i,
			}),
		);

		expect((await screen.findAllByText("#1 Parceiro 1")).length).toBeGreaterThan(
			0,
		);
		expect(screen.getAllByText("Produção total").length).toBeGreaterThan(0);
		expect(screen.getAllByText("Participação").length).toBeGreaterThan(0);
		expect(screen.getAllByText("Canceladas").length).toBeGreaterThan(0);
	});

	it("renders the partner sales share card with sold partners only", () => {
		mocks.usePartnerSalesDashboard.mockReturnValue({
			isLoading: false,
			isError: false,
			data: buildDashboardData([
				buildRankingItem({
					partnerId: "30000000-0000-0000-0000-000000000001",
					partnerName: "Parceiro Líder",
					supervisorId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
					supervisorName: "Supervisor Base",
					concludedCount: 3,
					concludedAmount: 300_000,
					pendingCount: 1,
					pendingAmount: 50_000,
					canceledCount: 0,
					canceledAmount: 0,
					delinquentCount: 0,
					delinquentAmount: 0,
				}),
				buildRankingItem({
					partnerId: "30000000-0000-0000-0000-000000000002",
					partnerName: "Parceiro Apoio",
					supervisorId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
					supervisorName: "Supervisor Base",
					concludedCount: 2,
					concludedAmount: 100_000,
					pendingCount: 0,
					pendingAmount: 0,
					canceledCount: 0,
					canceledAmount: 0,
					delinquentCount: 0,
					delinquentAmount: 0,
				}),
				buildRankingItem({
					partnerId: "30000000-0000-0000-0000-000000000003",
					partnerName: "Parceiro Sem Valor",
					supervisorId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
					supervisorName: "Supervisor Base",
					concludedCount: 0,
					concludedAmount: 0,
					pendingCount: 0,
					pendingAmount: 0,
					canceledCount: 1,
					canceledAmount: 20_000,
					delinquentCount: 0,
					delinquentAmount: 0,
				}),
			]),
			refetch: vi.fn(),
		});

		render(<DashboardPartnersOverview />);

		const shareCard = screen
			.getByText("Participação por parceiro")
			.closest('[data-slot="card"]');
		expect(shareCard).not.toBeNull();
		expect(
			within(shareCard as HTMLElement).getByText(
				"Distribuição do valor vendido por parceiro no período filtrado.",
			),
		).toBeInTheDocument();
		expect(
			(shareCard as HTMLElement).querySelector(
				'[data-slot="chart"].h-\\[340px\\]',
			),
		).toBeInTheDocument();
		expect(
			within(shareCard as HTMLElement).queryByText("Valor total vendido"),
		).not.toBeInTheDocument();
		expect(
			(shareCard as HTMLElement).querySelector(
				'[data-slot="scroll-area"].max-h-\\[224px\\]',
			),
		).toBeNull();
		expect(
			within(shareCard as HTMLElement).queryByText("Parceiro Sem Valor"),
		).not.toBeInTheDocument();
	});

	it("renders an empty state in the partner sales share card when there are no sold partners", () => {
		mocks.usePartnerSalesDashboard.mockReturnValue({
			isLoading: false,
			isError: false,
			data: buildDashboardData([]),
			refetch: vi.fn(),
		});

		render(<DashboardPartnersOverview />);

		const shareCard = screen
			.getByText("Participação por parceiro")
			.closest('[data-slot="card"]');
		expect(shareCard).not.toBeNull();
		expect(
			within(shareCard as HTMLElement).getByText(
				"Nenhum parceiro com valor vendido no período selecionado.",
			),
		).toBeInTheDocument();
	});

	it("keeps the supervisor dropdown partner list inside a scroll area with fixed height", async () => {
		const user = userEvent.setup();

		mocks.usePartnerSalesDashboard.mockReturnValue({
			isLoading: false,
			isError: false,
			data: buildDashboardData([
				buildRankingItem({
					partnerId: "20000000-0000-0000-0000-000000000001",
					partnerName: "Parceiro Supervisor 1",
					supervisorId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
					supervisorName: "Supervisor Base",
					concludedCount: 5,
					concludedAmount: 500_000,
					pendingCount: 0,
					pendingAmount: 0,
					canceledCount: 0,
					canceledAmount: 0,
					delinquentCount: 0,
					delinquentAmount: 0,
				}),
				buildRankingItem({
					partnerId: "20000000-0000-0000-0000-000000000002",
					partnerName: "Parceiro Supervisor 2",
					supervisorId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
					supervisorName: "Supervisor Base",
					concludedCount: 4,
					concludedAmount: 400_000,
					pendingCount: 0,
					pendingAmount: 0,
					canceledCount: 0,
					canceledAmount: 0,
					delinquentCount: 0,
					delinquentAmount: 0,
				}),
				buildRankingItem({
					partnerId: "20000000-0000-0000-0000-000000000003",
					partnerName: "Parceiro Supervisor 3",
					supervisorId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
					supervisorName: "Supervisor Base",
					concludedCount: 3,
					concludedAmount: 300_000,
					pendingCount: 0,
					pendingAmount: 0,
					canceledCount: 0,
					canceledAmount: 0,
					delinquentCount: 0,
					delinquentAmount: 0,
				}),
				buildRankingItem({
					partnerId: "20000000-0000-0000-0000-000000000004",
					partnerName: "Parceiro Supervisor 4",
					supervisorId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
					supervisorName: "Supervisor Base",
					concludedCount: 2,
					concludedAmount: 200_000,
					pendingCount: 0,
					pendingAmount: 0,
					canceledCount: 0,
					canceledAmount: 0,
					delinquentCount: 0,
					delinquentAmount: 0,
				}),
				buildRankingItem({
					partnerId: "20000000-0000-0000-0000-000000000005",
					partnerName: "Parceiro Supervisor 5",
					supervisorId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
					supervisorName: "Supervisor Base",
					concludedCount: 2,
					concludedAmount: 190_000,
					pendingCount: 0,
					pendingAmount: 0,
					canceledCount: 0,
					canceledAmount: 0,
					delinquentCount: 0,
					delinquentAmount: 0,
				}),
				buildRankingItem({
					partnerId: "20000000-0000-0000-0000-000000000006",
					partnerName: "Parceiro Supervisor 6",
					supervisorId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
					supervisorName: "Supervisor Base",
					concludedCount: 1,
					concludedAmount: 180_000,
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

		const { container } = render(<DashboardPartnersOverview />);

		await user.click(screen.getByRole("button", { name: /Supervisor Base/i }));

		expect(screen.getAllByText("Parceiro Supervisor 1").length).toBeGreaterThan(
			0,
		);
		expect(screen.getAllByText("Parceiro Supervisor 6").length).toBeGreaterThan(
			0,
		);

		const nestedScrollArea = container.querySelector(
			'[data-slot="scroll-area"].max-h-\\[17\\.5rem\\]',
		);
		expect(nestedScrollArea).toBeInTheDocument();
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

	it("deduplicates custom field options by label and preserves the selected field", () => {
		const result = dedupeAvailableDynamicFields(
			[
				{
					fieldId: "11111111-1111-4111-8111-111111111111",
					label: "Canal",
					type: "SELECT",
				},
				{
					fieldId: "22222222-2222-4222-8222-222222222222",
					label: "Canal",
					type: "SELECT",
				},
				{
					fieldId: "33333333-3333-4333-8333-333333333333",
					label: "Origem",
					type: "SELECT",
				},
			],
			"22222222-2222-4222-8222-222222222222",
		);

		expect(result).toHaveLength(2);
		expect(result[0]).toMatchObject({
			fieldId: "22222222-2222-4222-8222-222222222222",
			label: "Canal",
		});
		expect(result[1]).toMatchObject({
			fieldId: "33333333-3333-4333-8333-333333333333",
			label: "Origem",
		});
	});

	it("keeps the dashboard visible while only the custom field card is reloading", () => {
		const baseData = buildDashboardData([
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
		]);

		mocks.reset({
			dynamicFieldId: "11111111-1111-4111-8111-111111111111",
		});

		mocks.usePartnerSalesDashboard.mockImplementation(
			(args: Record<string, unknown>) => {
				if (
					args.startDate === PREVIOUS_MONTH_START_DATE &&
					args.endDate === PREVIOUS_MONTH_END_DATE
				) {
					return {
						isLoading: false,
						isError: false,
						data: baseData,
						refetch: vi.fn(),
					};
				}

				if (args.dynamicFieldId) {
					return {
						isLoading: true,
						isError: false,
						data: undefined,
						refetch: vi.fn(),
					};
				}

				return {
					isLoading: false,
					isError: false,
					data: baseData,
					refetch: vi.fn(),
				};
			},
		);

		const { container } = render(<DashboardPartnersOverview />);

		expect(screen.getByText("Dashboard de parceiros")).toBeInTheDocument();
		expect(screen.getByText("Total de parceiros")).toBeInTheDocument();
		expect(
			container.querySelectorAll('[data-slot="skeleton"]').length,
		).toBeGreaterThan(0);
		expect(
			screen.queryByText("Não foi possível carregar o dashboard de parceiros."),
		).not.toBeInTheDocument();
	});

	it("keeps the dashboard visible while only the product breakdown card is reloading", () => {
		const baseData = buildDashboardData([
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
		]);

		mocks.reset({
			productBreakdownDepth: "ALL_LEVELS",
		});

		mocks.usePartnerSalesDashboard.mockImplementation(
			(args: Record<string, unknown>) => {
				if (
					args.startDate === PREVIOUS_MONTH_START_DATE &&
					args.endDate === PREVIOUS_MONTH_END_DATE
				) {
					return {
						isLoading: false,
						isError: false,
						data: baseData,
						refetch: vi.fn(),
					};
				}

				if (args.productBreakdownDepth === "ALL_LEVELS") {
					return {
						isLoading: true,
						isError: false,
						data: undefined,
						refetch: vi.fn(),
					};
				}

				return {
					isLoading: false,
					isError: false,
					data: baseData,
					refetch: vi.fn(),
				};
			},
		);

		const { container } = render(<DashboardPartnersOverview />);

		expect(screen.getByText("Dashboard de parceiros")).toBeInTheDocument();
		expect(screen.getByText("Total de parceiros")).toBeInTheDocument();
		expect(
			container.querySelectorAll('[data-slot="skeleton"]').length,
		).toBeGreaterThan(0);
		expect(
			screen.queryByText("Não foi possível carregar o dashboard de parceiros."),
		).not.toBeInTheDocument();
	});
});
