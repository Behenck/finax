import { render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppSidebar } from "../src/pages/_app/-components/sidebar";

const mocks = vi.hoisted(() => ({
	useLocation: vi.fn(),
	canMock: vi.fn(),
	setOpenMobile: vi.fn(),
}));

vi.mock("@tanstack/react-router", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@tanstack/react-router")>();

	return {
		...actual,
		useLocation: () => mocks.useLocation(),
		Link: ({ to, children, ...props }: ComponentProps<"a"> & { to: string }) => (
			<a href={to} {...props}>
				{children}
			</a>
		),
	};
});

vi.mock("@/components/ui/collapsible", () => ({
	Collapsible: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
	CollapsibleContent: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	CollapsibleTrigger: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
}));

vi.mock("@/components/ui/separator", () => ({
	Separator: () => <div />,
}));

vi.mock("@/components/ui/sidebar", () => ({
	Sidebar: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
	SidebarContent: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	SidebarGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
	SidebarHeader: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	SidebarMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
	SidebarMenuButton: ({
		children,
		isActive,
	}: {
		children: React.ReactNode;
		isActive?: boolean;
	}) => <div data-active={isActive ? "true" : "false"}>{children}</div>,
	SidebarMenuItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
	SidebarMenuSub: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
	SidebarMenuSubButton: ({
		children,
		isActive,
	}: {
		children: React.ReactNode;
		isActive?: boolean;
	}) => <div data-active={isActive ? "true" : "false"}>{children}</div>,
	SidebarMenuSubItem: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	SidebarRail: () => <div />,
	SidebarTrigger: () => <button type="button">Trigger</button>,
	useSidebar: () => ({
		state: "expanded",
		isMobile: false,
		setOpenMobile: mocks.setOpenMobile,
	}),
}));

vi.mock("@/context/app-context", () => ({
	useApp: () => ({
		organization: {
			name: "Org Test",
		},
	}),
}));

vi.mock("@/permissions/access", () => ({
	useAbility: () => ({
		can: mocks.canMock,
	}),
}));

describe("AppSidebar dashboard partners item", () => {
	beforeEach(() => {
		mocks.useLocation.mockReset();
		mocks.canMock.mockReset();
		mocks.canMock.mockReturnValue(true);
		mocks.useLocation.mockReturnValue({
			pathname: "/",
			search: {},
		});
	});

	it("should render dashboard partners link and active state", () => {
		render(<AppSidebar />);

		const partnerLinks = screen.getAllByRole("link", {
			name: "Parceiros",
		});
		const dashboardPartnersLink = partnerLinks.find(
			(link) => link.getAttribute("href") === "/",
		);

		expect(dashboardPartnersLink).toBeDefined();
		expect(dashboardPartnersLink).toHaveAttribute("href", "/");

		const parentWithActiveState = dashboardPartnersLink?.closest("[data-active]");
		expect(parentWithActiveState).toHaveAttribute("data-active", "true");
	});
});
