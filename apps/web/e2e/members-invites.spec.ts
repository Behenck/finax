import { expect, test, type Page } from "@playwright/test";
import {
	getCopiedText,
	jsonResponse,
	mockApi,
	mockClipboard,
	onEndpoint,
	setAuthCookie,
} from "./support/api-mocks";
import {
	companiesFixture,
	membersFixture,
	pendingInvitesFixture,
	sessionFixture,
} from "./support/fixtures";

type SessionFixture = typeof sessionFixture;

type MembersInvitesMockState = {
	createInviteRequests: number;
	createInvitePayload: Record<string, unknown> | null;
	createInviteLinkRequests: number;
	createInviteLinkSlug: string | null;
};

async function mockMembersInvitesApi(
	page: Page,
	options: {
		session?: SessionFixture;
		pendingInvites?: readonly (typeof pendingInvitesFixture)[number][];
	} = {},
): Promise<MembersInvitesMockState> {
	const session = options.session ?? sessionFixture;
	const pendingInvites = options.pendingInvites ?? pendingInvitesFixture;
	const organizationSlug = session.organization.slug;
	const state: MembersInvitesMockState = {
		createInviteRequests: 0,
		createInvitePayload: null,
		createInviteLinkRequests: 0,
		createInviteLinkSlug: null,
	};

	await mockApi(page, [
		onEndpoint({
			method: "GET",
			pathname: "/me",
			handler: async ({ route }) => {
				await route.fulfill(jsonResponse(200, session));
			},
		}),
		onEndpoint({
			method: "GET",
			pathname: `/organizations/${organizationSlug}/members`,
			handler: async ({ route }) => {
				await route.fulfill(
					jsonResponse(200, {
						members: membersFixture,
					}),
				);
			},
		}),
		onEndpoint({
			method: "GET",
			pathname: `/organizations/${organizationSlug}/companies`,
			handler: async ({ route }) => {
				await route.fulfill(
					jsonResponse(200, {
						companies: companiesFixture,
					}),
				);
			},
		}),
		onEndpoint({
			method: "GET",
			pathname: `/organizations/${organizationSlug}/invites`,
			handler: async ({ route }) => {
				await route.fulfill(
					jsonResponse(200, {
						invites: pendingInvites,
					}),
				);
			},
		}),
		onEndpoint({
			method: "POST",
			pathname: `/organizations/${organizationSlug}/invites`,
			handler: async ({ route }) => {
				state.createInviteRequests += 1;
				state.createInvitePayload =
					(route.request().postDataJSON() as Record<string, unknown>) ?? null;

				await route.fulfill(
					jsonResponse(201, {
						inviteId: "created-invite-1",
					}),
				);
			},
		}),
		onEndpoint({
			method: "POST",
			pathname: /^\/organizations\/[^/]+\/invites\/link$/,
			handler: async ({ route, url }) => {
				state.createInviteLinkRequests += 1;
				const slugFromUrl = url.pathname.split("/")[2] ?? null;
				state.createInviteLinkSlug = slugFromUrl;

				await route.fulfill(
					jsonResponse(201, {
						url: "https://finax.example/invite/mock-link-token",
						expiresAt: null,
					}),
				);
			},
		}),
	]);

	return state;
}

async function openMembersSettings(page: Page) {
	await page.goto("/settings/members");
	await expect(
		page.getByRole("button", { name: /convidar via link/i }),
	).toBeVisible({ timeout: 15_000 });
}

test("should validate email before creating invite by email and role", async ({
	page,
}) => {
	await setAuthCookie(page);
	const state = await mockMembersInvitesApi(page);

	await openMembersSettings(page);
	await page.getByPlaceholder("joao.silva@dominio.com").fill("email-invalido");
	await page.getByRole("button", { name: "Enviar convite" }).click();

	await expect(page.getByText("Email inválido!")).toBeVisible();
	await expect.poll(() => state.createInviteRequests).toBe(0);
});

test("should create invite by email and role with expected payload", async ({
	page,
}) => {
	await setAuthCookie(page);
	const state = await mockMembersInvitesApi(page);

	await openMembersSettings(page);
	await page
		.getByPlaceholder("joao.silva@dominio.com")
		.fill("novo.membro@example.com");
	await page.getByRole("button", { name: "Enviar convite" }).click();

	await expect.poll(() => state.createInviteRequests).toBe(1);
	expect(state.createInvitePayload).toMatchObject({
		email: "novo.membro@example.com",
		role: "MEMBER",
	});
});

test("should create invite link using current organization slug and copy URL", async ({
	page,
}) => {
	await mockClipboard(page);

	const sessionWithCustomSlug: SessionFixture = {
		...sessionFixture,
		organization: {
			...sessionFixture.organization,
			slug: "slug-dinamico-e2e",
		},
	};

	await setAuthCookie(page);
	const state = await mockMembersInvitesApi(page, {
		session: sessionWithCustomSlug,
	});

	await openMembersSettings(page);
	await page.getByRole("button", { name: "Convidar via link" }).click();

	await expect.poll(() => state.createInviteLinkRequests).toBe(1);
	await expect.poll(() => state.createInviteLinkSlug).toBe("slug-dinamico-e2e");
	await expect
		.poll(async () => getCopiedText(page))
		.toBe("https://finax.example/invite/mock-link-token");
});

test("should render pending invites, filter by search and role, and show empty state", async ({
	page,
}) => {
	await setAuthCookie(page);
	await mockMembersInvitesApi(page);

	await openMembersSettings(page);
	await page.getByText("Convites pendentes").click();

	const pendingPanel = page.getByRole("tabpanel", { name: "Convites pendentes" });
	await expect(pendingPanel.getByText("ana.admin@example.com")).toBeVisible();
	await expect(pendingPanel.getByText("bruno.member@example.com")).toBeVisible();

	const searchInput = pendingPanel.getByPlaceholder("Buscar por email ou autor");
	await searchInput.fill("ana.admin");
	await expect(pendingPanel.getByText("ana.admin@example.com")).toBeVisible();
	await expect(pendingPanel.getByText("bruno.member@example.com")).toHaveCount(0);

	await searchInput.clear();
	await pendingPanel.getByRole("combobox").click();
	await page.getByRole("option", { name: "Admin" }).click();

	await expect(pendingPanel.getByText("ana.admin@example.com")).toBeVisible();
	await expect(pendingPanel.getByText("bruno.member@example.com")).toHaveCount(0);

	await searchInput.fill("nao-existe");
	await expect(
		pendingPanel.getByText("Nenhum convite pendente encontrado com os filtros atuais."),
	).toBeVisible();
});
