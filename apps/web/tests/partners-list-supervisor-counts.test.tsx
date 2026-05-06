import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { ListPartners } from "../src/pages/_app/registers/partners/-components/list-partners";

vi.mock("@tanstack/react-router", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@tanstack/react-router")>();

	return {
		...actual,
		Link: ({
			children,
			to,
		}: {
			children?: ReactNode;
			to?: string;
		}) => <a href={typeof to === "string" ? to : "#"}>{children}</a>,
	};
});

vi.mock("@tanstack/react-query", () => ({
	useQueryClient: () => ({
		invalidateQueries: vi.fn(),
	}),
}));

vi.mock("@/context/app-context", () => ({
	useApp: () => ({
		organization: {
			slug: "org-teste",
		},
	}),
}));

vi.mock("@/http/generated", () => ({
	getOrganizationsSlugPartnersQueryKey: vi.fn(),
	usePutOrganizationsSlugPartnersPartnerid: () => ({
		mutateAsync: vi.fn(),
		isPending: false,
	}),
}));

vi.mock("@/components/ui/dropdown-menu", () => ({
	DropdownMenu: ({ children }: { children: ReactNode }) => <>{children}</>,
	DropdownMenuTrigger: ({ children }: { children: ReactNode }) => (
		<>{children}</>
	),
	DropdownMenuContent: ({ children }: { children: ReactNode }) => (
		<>{children}</>
	),
	DropdownMenuGroup: ({ children }: { children: ReactNode }) => <>{children}</>,
	DropdownMenuItem: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock(
	"../src/pages/_app/registers/partners/-components/details-partner",
	() => ({
		DetailsPartner: () => null,
	}),
);

vi.mock(
	"../src/pages/_app/registers/partners/-components/delete-partner",
	() => ({
		DeletePartner: () => null,
	}),
);

vi.mock(
	"../src/pages/_app/registers/partners/-components/assign-supervisor",
	() => ({
		AssignSupervisor: ({
			supervisorPartnerCounts,
		}: {
			supervisorPartnerCounts: Record<string, number>;
		}) => (
			<div data-testid="assign-supervisor-count">
				{supervisorPartnerCounts["supervisor-1"] ?? 0}
			</div>
		),
	}),
);

vi.mock("@/components/responsive-data-view", () => ({
	ResponsiveDataView: ({ desktop }: { desktop: ReactNode }) => <>{desktop}</>,
}));

function buildPartner(id: string, supervisorIds: string[]) {
	return {
		id,
		name: `Parceiro ${id}`,
		email: `${id}@teste.com`,
		phone: null,
		companyName: `Empresa ${id}`,
		documentType: null,
		document: null,
		country: "Brasil",
		state: "SP",
		city: null,
		street: null,
		zipCode: null,
		neighborhood: null,
		number: null,
		complement: null,
		organization: {
			slug: "org-teste",
		},
		status: "ACTIVE" as const,
		user: null,
		supervisor: supervisorIds[0]
			? {
					id: supervisorIds[0],
					name: "Supervisor 1",
				}
			: null,
		supervisors: supervisorIds.map((supervisorId) => ({
			id: supervisorId,
			name: supervisorId === "supervisor-1" ? "Supervisor 1" : "Supervisor 2",
		})),
		currentMonthSalesAmount: 0,
		currentMonthSalesCount: 0,
	};
}

describe("partners list supervisor counts", () => {
	it("should keep supervisor counts based on the full partners list", () => {
		const allPartners = [
			buildPartner("partner-1", ["supervisor-1"]),
			buildPartner("partner-2", ["supervisor-1"]),
			buildPartner("partner-3", ["supervisor-2"]),
		];

		render(
			<ListPartners
				partners={[allPartners[0]!]}
				allPartners={allPartners}
			/>,
		);

		expect(screen.getAllByTestId("assign-supervisor-count")[0]).toHaveTextContent(
			"2",
		);
	});
});
