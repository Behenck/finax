import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MemberAccessManager } from "../src/pages/_app/settings/members/-components/members-list/member-access-manager";
import type { MemberListItem } from "../src/pages/_app/settings/members/-components/members-list/utils/types";

const mocks = vi.hoisted(() => ({
	updateMemberAccessMock: vi.fn(),
	updateMemberPermissionsMock: vi.fn(),
	successToastMock: vi.fn(),
	errorToastMock: vi.fn(),
	memberPermissionResponses: new Map<string, Record<string, unknown>>(),
	memberPermissionErrors: new Map<string, unknown>(),
	organizationMembers: [] as MemberListItem[],
	permissionCatalog: {
		permissions: [] as Array<{
			key: string;
			module: string;
			action: string;
			description: string;
		}>,
	},
}));

vi.mock("@/components/loading-skeletons", () => ({
	CardSectionSkeleton: () => <div>loading skeleton</div>,
}));

vi.mock("@/components/ui/dialog", () => ({
	Dialog: ({
		open,
		children,
	}: {
		open: boolean;
		children: ReactNode;
	}) => (open ? <div>{children}</div> : null),
	DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	DialogTitle: ({ children }: { children: ReactNode }) => <h1>{children}</h1>,
	DialogDescription: ({ children }: { children: ReactNode }) => (
		<p>{children}</p>
	),
	DialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/select", async () => {
	const React = await import("react");

	type SelectContextValue = {
		value?: string;
		onValueChange?: (value: string) => void;
		disabled?: boolean;
	};

	const SelectContext = React.createContext<SelectContextValue>({});

	return {
		Select: ({
			value,
			onValueChange,
			disabled,
			children,
		}: {
			value?: string;
			onValueChange?: (value: string) => void;
			disabled?: boolean;
			children: ReactNode;
		}) => (
			<SelectContext.Provider value={{ value, onValueChange, disabled }}>
				<div>{children}</div>
			</SelectContext.Provider>
		),
		SelectTrigger: ({
			children,
			"aria-label": ariaLabel,
		}: {
			children: ReactNode;
			"aria-label"?: string;
		}) => (
			<button type="button" role="combobox" aria-label={ariaLabel}>
				{children}
			</button>
		),
		SelectValue: ({ placeholder }: { placeholder?: string }) => {
			const context = React.useContext(SelectContext);
			return <span>{context.value || placeholder}</span>;
		},
		SelectContent: ({ children }: { children: ReactNode }) => (
			<div>{children}</div>
		),
		SelectItem: ({
			value,
			children,
		}: {
			value: string;
			children: ReactNode;
		}) => {
			const context = React.useContext(SelectContext);
			return (
				<button
					type="button"
					role="option"
					onClick={() => context.onValueChange?.(value)}
					disabled={context.disabled}
				>
					{children}
				</button>
			);
		},
	};
});

vi.mock("@/components/ui/collapsible", () => ({
	Collapsible: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	CollapsibleTrigger: ({ children }: { children: ReactNode }) => (
		<button type="button">{children}</button>
	),
	CollapsibleContent: ({ children }: { children: ReactNode }) => (
		<div>{children}</div>
	),
}));

vi.mock("../src/pages/_app/settings/members/-components/member-access-scope-picker", () => ({
	MemberAccessScopePicker: () => <div>scope picker</div>,
}));

vi.mock(
	"../src/pages/_app/settings/members/-components/members-list/member-access-summary",
	() => ({
		MemberAccessSummary: () => <div>access summary</div>,
	}),
);

vi.mock("@/http/generated", () => ({
	getOrganizationsSlugMembersQueryKey: ({ slug }: { slug: string }) => [
		"members",
		slug,
	],
	getOrganizationsSlugMembersMemberidPermissionsQueryKey: ({
		slug,
		memberId,
	}: {
		slug: string;
		memberId: string;
	}) => ["member-permissions", slug, memberId],
	useGetOrganizationsSlugMembers: ({
		slug,
	}: {
		slug: string;
	}) => ({
		data: {
			members: mocks.organizationMembers,
		},
		isLoading: false,
		queryKey: ["members", slug],
	}),
	useGetOrganizationsSlugPermissionsCatalog: () => ({
		data: mocks.permissionCatalog,
		isLoading: false,
	}),
	useGetOrganizationsSlugMembersMemberidPermissions: (
		{ memberId }: { memberId: string },
		options?: { query?: { enabled?: boolean } },
	) => {
		if (options?.query?.enabled === false) {
			return {
				data: undefined,
				isLoading: false,
				error: null,
			};
		}

		const error = mocks.memberPermissionErrors.get(memberId);
		if (error) {
			return {
				data: undefined,
				isLoading: false,
				error,
			};
		}

		return {
			data: mocks.memberPermissionResponses.get(memberId),
			isLoading: false,
			error: null,
		};
	},
	usePutOrganizationsSlugMembersMemberid: () => ({
		mutateAsync: mocks.updateMemberAccessMock,
		isPending: false,
	}),
	usePutOrganizationsSlugMembersMemberidPermissions: () => ({
		mutateAsync: mocks.updateMemberPermissionsMock,
		isPending: false,
	}),
}));

vi.mock("sonner", () => ({
	toast: {
		success: mocks.successToastMock,
		error: mocks.errorToastMock,
	},
}));

const baseMember: MemberListItem = {
	id: "target-member",
	userId: "target-user",
	role: "MEMBER",
	customersScope: "ORGANIZATION_ALL",
	salesScope: "ORGANIZATION_ALL",
	commissionsScope: "ORGANIZATION_ALL",
	partnersScope: "ORGANIZATION_ALL",
	name: "Destino",
	avatarUrl: null,
	email: "destino@finax.com",
	accesses: [],
};

function buildPermissionResponse({
	memberId,
	name,
	email,
	presetPermissions,
	effectivePermissions,
	overrides = [],
}: {
	memberId: string;
	name: string;
	email: string;
	presetPermissions: string[];
	effectivePermissions: string[];
	overrides?: Array<{ permissionKey: string; effect: "ALLOW" | "DENY" }>;
}) {
	return {
		member: {
			id: memberId,
			userId: `${memberId}-user`,
			role: "MEMBER" as const,
			name,
			email,
		},
		presetPermissions,
		effectivePermissions,
		overrides,
	};
}

function renderMemberAccessManager(
	props: Partial<ComponentProps<typeof MemberAccessManager>> = {},
) {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				retry: false,
			},
		},
	});

	return render(
		<QueryClientProvider client={queryClient}>
			<MemberAccessManager
				member={baseMember}
				organizationSlug="org-teste"
				companies={[]}
				isLoadingCompanies={false}
				canManagePermissions
				initialTab="permissions"
				open
				onOpenChange={() => undefined}
				{...props}
			/>
		</QueryClientProvider>,
	);
}

describe("member access manager permission copy", () => {
	beforeEach(() => {
		mocks.updateMemberAccessMock.mockReset();
		mocks.updateMemberPermissionsMock.mockReset();
		mocks.successToastMock.mockReset();
		mocks.errorToastMock.mockReset();
		mocks.memberPermissionResponses.clear();
		mocks.memberPermissionErrors.clear();
		mocks.updateMemberAccessMock.mockResolvedValue(undefined);
		mocks.updateMemberPermissionsMock.mockResolvedValue(undefined);
		mocks.permissionCatalog.permissions = [
			{
				key: "sales.view",
				module: "sales",
				action: "view",
				description: "Visualizar vendas",
			},
			{
				key: "sales.manage",
				module: "sales",
				action: "manage",
				description: "Gerenciar vendas",
			},
		];
		mocks.organizationMembers = [
			baseMember,
			{
				...baseMember,
				id: "source-member-1",
				userId: "source-user-1",
				name: "Usuário Base",
				email: "base@finax.com",
			},
			{
				...baseMember,
				id: "source-member-2",
				userId: "source-user-2",
				name: "Outro Usuário",
				email: "outro@finax.com",
			},
		];
		mocks.memberPermissionResponses.set(
			"target-member",
			buildPermissionResponse({
				memberId: "target-member",
				name: "Destino",
				email: "destino@finax.com",
				presetPermissions: ["sales.view"],
				effectivePermissions: ["sales.view"],
			}),
		);
		mocks.memberPermissionResponses.set(
			"source-member-1",
			buildPermissionResponse({
				memberId: "source-member-1",
				name: "Usuário Base",
				email: "base@finax.com",
				presetPermissions: ["sales.view"],
				effectivePermissions: ["sales.manage"],
				overrides: [
					{ permissionKey: "sales.manage", effect: "ALLOW" },
					{ permissionKey: "sales.view", effect: "DENY" },
				],
			}),
		);
		mocks.memberPermissionResponses.set(
			"source-member-2",
			buildPermissionResponse({
				memberId: "source-member-2",
				name: "Outro Usuário",
				email: "outro@finax.com",
				presetPermissions: ["sales.view"],
				effectivePermissions: ["sales.view", "sales.manage"],
				overrides: [{ permissionKey: "sales.manage", effect: "ALLOW" }],
			}),
		);
	});

	it("shows the copy selector only on the permissions tab and excludes the current member", async () => {
		renderMemberAccessManager({ initialTab: "access" });

		expect(
			screen.queryByText("Copiar permissões de outro usuário"),
		).not.toBeInTheDocument();

		renderMemberAccessManager({ initialTab: "permissions" });

		expect(
			await screen.findByText("Copiar permissões de outro usuário"),
		).toBeInTheDocument();
		expect(screen.getByRole("option", { name: /Usuário Base/i })).toBeVisible();
		expect(
			screen.queryByRole("option", { name: /Destino/i }),
		).not.toBeInTheDocument();
	});

	it("copies permissions as a preview and recalculates target overrides on save when presets differ", async () => {
		const user = userEvent.setup();
		renderMemberAccessManager();

		await user.click(screen.getByRole("option", { name: /Usuário Base/i }));

		await waitFor(() => {
			expect(
				screen.getByText(/Permissões copiadas de/i),
			).toBeInTheDocument();
		});

		expect(mocks.updateMemberPermissionsMock).not.toHaveBeenCalled();

		const saveButton = screen.getByRole("button", {
			name: "Salvar permissões",
		});
		expect(saveButton).toBeEnabled();

		await user.click(saveButton);

		await waitFor(() => {
			expect(mocks.updateMemberPermissionsMock).toHaveBeenCalledWith({
				slug: "org-teste",
				memberId: "target-member",
				data: {
					overrides: [
						{ permissionKey: "sales.manage", effect: "ALLOW" },
						{ permissionKey: "sales.view", effect: "DENY" },
					],
				},
			});
		});
	});

	it("copies permissions and keeps the same final result when source and target presets are aligned", async () => {
		const user = userEvent.setup();
		mocks.memberPermissionResponses.set(
			"source-member-1",
			buildPermissionResponse({
				memberId: "source-member-1",
				name: "Usuário Base",
				email: "base@finax.com",
				presetPermissions: ["sales.view"],
				effectivePermissions: ["sales.view", "sales.manage"],
				overrides: [{ permissionKey: "sales.manage", effect: "ALLOW" }],
			}),
		);

		renderMemberAccessManager();
		await user.click(screen.getByRole("option", { name: /Usuário Base/i }));
		await user.click(
			await screen.findByRole("button", { name: "Salvar permissões" }),
		);

		await waitFor(() => {
			expect(mocks.updateMemberPermissionsMock).toHaveBeenCalledWith({
				slug: "org-teste",
				memberId: "target-member",
				data: {
					overrides: [{ permissionKey: "sales.manage", effect: "ALLOW" }],
				},
			});
		});
	});

	it("shows an error and preserves the current form state when the source permissions fail to load", async () => {
		const user = userEvent.setup();
		mocks.memberPermissionErrors.set("source-member-2", {
			response: {
				data: {
					message: "Falha ao buscar permissões do usuário de origem.",
				},
			},
		});

		renderMemberAccessManager();

		expect(
			screen.getByRole("button", { name: "Salvar permissões" }),
		).toBeDisabled();

		await user.click(screen.getByRole("option", { name: /Outro Usuário/i }));

		await waitFor(() => {
			expect(
				screen.getByText("Falha ao buscar permissões do usuário de origem."),
			).toBeInTheDocument();
		});

		expect(
			screen.getByRole("button", { name: "Salvar permissões" }),
		).toBeDisabled();
		expect(mocks.updateMemberPermissionsMock).not.toHaveBeenCalled();
	});
});
