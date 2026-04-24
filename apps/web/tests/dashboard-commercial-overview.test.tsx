import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { DashboardCommercialOverview } from "../src/pages/_app/_dashboard/-components/dashboard-commercial-overview";

const mocks = vi.hoisted(() => ({
	useSalesDashboardMock: vi.fn(),
	useGetOrganizationsSlugProductsMock: vi.fn(),
}));

vi.mock("@tanstack/react-router", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@tanstack/react-router")>();

	return {
		...actual,
		Link: ({ children, to }: { children: ReactNode; to?: string }) => (
			<a href={typeof to === "string" ? to : "#"}>{children}</a>
		),
	};
});

vi.mock("nuqs", async (importOriginal) => {
	const actual = await importOriginal<typeof import("nuqs")>();

	return {
		...actual,
		useQueryState: () => ["2026-03", vi.fn()],
	};
});

vi.mock("@/context/app-context", () => ({
	useApp: () => ({
		organization: {
			slug: "org-teste",
		},
	}),
}));

vi.mock("@/hooks/sales", () => ({
	useSalesDashboard: (...args: unknown[]) => mocks.useSalesDashboardMock(...args),
}));

vi.mock("@/http/generated", () => ({
	useGetOrganizationsSlugProducts: (...args: unknown[]) =>
		mocks.useGetOrganizationsSlugProductsMock(...args),
}));

vi.mock(
	"../src/pages/_app/_dashboard/-components/dashboard-month-picker",
	() => ({
		DashboardMonthPicker: () => <div data-testid="dashboard-month-picker" />,
	}),
);

vi.mock("@/components/loading-reveal", () => ({
	LoadingReveal: ({
		loading,
		contentKey: _contentKey,
		skeleton,
		children,
	}: {
		loading: boolean;
		contentKey?: string;
		skeleton?: ReactNode;
		children: ReactNode;
	}) => <>{loading ? skeleton : children}</>,
}));

describe("dashboard commercial overview", () => {
	it("should render the pre-cancellation KPI from dashboard data", () => {
		mocks.useSalesDashboardMock.mockReturnValue({
			data: {
				sales: {
					current: {
						count: 4,
						grossAmount: 550_000,
						averageTicket: 137_500,
					},
					previous: {
						count: 1,
						grossAmount: 100_000,
						averageTicket: 100_000,
					},
					preCancellation: {
						count: 2,
						threshold: 3,
					},
					byStatus: {
						PENDING: { count: 1, amount: 200_000 },
						APPROVED: { count: 2, amount: 200_000 },
						COMPLETED: { count: 1, amount: 150_000 },
						CANCELED: { count: 1, amount: 500_000 },
					},
					timeline: [
						{
							date: "2026-03-02T00:00:00.000Z",
							count: 1,
							amount: 150_000,
						},
					],
					topProducts: [],
					topResponsibles: [],
				},
				commissions: {
					reference: "SALE_DATE",
					current: {
						INCOME: {
							total: { count: 1, amount: 42_000 },
							pending: { count: 1, amount: 42_000 },
							paid: { count: 0, amount: 0 },
							canceled: { count: 0, amount: 0 },
							reversed: { count: 0, amount: 0 },
						},
						OUTCOME: {
							total: { count: 1, amount: 15_000 },
							pending: { count: 1, amount: 15_000 },
							paid: { count: 0, amount: 0 },
							canceled: { count: 0, amount: 0 },
							reversed: { count: 0, amount: 0 },
						},
						netAmount: 27_000,
					},
					previous: {
						INCOME: {
							total: { count: 1, amount: 9_000 },
							pending: { count: 1, amount: 9_000 },
							paid: { count: 0, amount: 0 },
							canceled: { count: 0, amount: 0 },
							reversed: { count: 0, amount: 0 },
						},
						OUTCOME: {
							total: { count: 1, amount: 4_000 },
							pending: { count: 1, amount: 4_000 },
							paid: { count: 0, amount: 0 },
							canceled: { count: 0, amount: 0 },
							reversed: { count: 0, amount: 0 },
						},
						netAmount: 5_000,
					},
				},
			},
			isLoading: false,
			isError: false,
			refetch: vi.fn(),
		});
		mocks.useGetOrganizationsSlugProductsMock.mockReturnValue({
			data: {
				products: [],
			},
		});

		render(<DashboardCommercialOverview />);

		expect(screen.getByText("Pré-cancelamento")).toBeInTheDocument();
		expect(screen.getByText("3+ inadimplência(s) abertas")).toBeInTheDocument();
		const preCancellationCard = screen
			.getByText("Pré-cancelamento")
			.closest("[data-slot='card']");

		expect(preCancellationCard).not.toBeNull();
		expect(within(preCancellationCard as HTMLElement).getByText("2")).toBeInTheDocument();
	});
});
