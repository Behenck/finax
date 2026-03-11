import { expect, test, type Page } from "@playwright/test";
import { jsonResponse, mockApi, onEndpoint } from "./support/api-mocks";
import { emailInviteFixture, linkInviteFixture } from "./support/fixtures";

type InviteFixture = typeof emailInviteFixture | typeof linkInviteFixture;

type PublicInviteMockState = {
	getInviteRequests: number;
	acceptInviteRequests: number;
	acceptInvitePayload: Record<string, unknown> | null;
};

async function mockPublicInviteApi(
	page: Page,
	options: {
		invitesByToken: Record<string, InviteFixture | null>;
		acceptStatus?: 200 | 500;
	} = {
		invitesByToken: {},
		acceptStatus: 200,
	},
): Promise<PublicInviteMockState> {
	const { invitesByToken, acceptStatus = 200 } = options;
	const state: PublicInviteMockState = {
		getInviteRequests: 0,
		acceptInviteRequests: 0,
		acceptInvitePayload: null,
	};

	await mockApi(page, [
		onEndpoint({
			method: "GET",
			pathname: /^\/invites\/[^/]+$/,
			handler: async ({ route, url }) => {
				state.getInviteRequests += 1;
				const token = url.pathname.split("/")[2] ?? "";
				const invite = invitesByToken[token] ?? null;

				if (!invite) {
					await route.fulfill(
						jsonResponse(404, {
							message: "Convite inválido ou expirado!",
						}),
					);
					return;
				}

				await route.fulfill(
					jsonResponse(200, {
						invite,
					}),
				);
			},
		}),
		onEndpoint({
			method: "POST",
			pathname: /^\/invites\/[^/]+\/accept$/,
			handler: async ({ route }) => {
				state.acceptInviteRequests += 1;
				state.acceptInvitePayload =
					(route.request().postDataJSON() as Record<string, unknown>) ?? null;

				if (acceptStatus === 200) {
					await route.fulfill(
						jsonResponse(200, {
							code: "invite-accepted-code",
						}),
					);
					return;
				}

				await route.fulfill(
					jsonResponse(500, {
						message: "Erro ao aceitar convite.",
					}),
				);
			},
		}),
	]);

	return state;
}

async function fillInviteAcceptForm(
	page: Page,
	payload: {
		firstName: string;
		lastName: string;
		password: string;
		confirmPassword: string;
		email?: string;
	},
) {
	await page.locator("#firstName").fill(payload.firstName);
	await page.locator("#lastName").fill(payload.lastName);

	if (payload.email) {
		await page.locator("#email").fill(payload.email);
	}

	await page.locator("#password").fill(payload.password);
	await page.locator("#confirmPassword").fill(payload.confirmPassword);
}

test("should stay on /invite when token is empty", async ({ page }) => {
	await mockPublicInviteApi(page);

	await page.goto("/invite");
	await page.getByRole("button", { name: "Validar Convite" }).click();

	await expect(page).toHaveURL(/\/invite\/?$/);
	await expect(page.getByRole("heading", { name: "Validar Convite" })).toBeVisible();
});

test("should navigate from /invite to /invite/:token/accept when token is valid", async ({
	page,
}) => {
	const state = await mockPublicInviteApi(page, {
		invitesByToken: {
			"token-valido": { ...emailInviteFixture, id: "token-valido" },
		},
	});

	await page.goto("/invite");
	await page.getByPlaceholder("abc123xyz...").fill("token-valido");
	await page.getByRole("button", { name: "Validar Convite" }).click();

	await expect(page).toHaveURL(/\/invite\/token-valido\/accept$/);
	await expect(page.getByRole("heading", { name: "Convite Válido!" })).toBeVisible();
	await expect(page.getByText("Organizacao E2E")).toBeVisible();
	await expect.poll(() => state.getInviteRequests).toBeGreaterThanOrEqual(2);
});

test("should redirect /invite/:token/accept to /invite/:token when invite is invalid", async ({
	page,
}) => {
	await mockPublicInviteApi(page, {
		invitesByToken: {},
	});

	await page.goto("/invite/token-invalido/accept");

	await expect(page.getByPlaceholder("abc123xyz...")).toHaveValue(
		"token-invalido",
		{ timeout: 15_000 },
	);
	await expect(
		page.getByRole("button", { name: "Validar Convite" }),
	).toBeVisible({ timeout: 15_000 });
	await expect
		.poll(() => new URL(page.url()).pathname, { timeout: 15_000 })
		.toMatch(/^\/invite\/token-invalido(\/accept)?$/);
});

test("should keep email hidden for EMAIL invite and block invalid client submit", async ({
	page,
}) => {
	const state = await mockPublicInviteApi(page, {
		invitesByToken: {
			"invite-email-token": { ...emailInviteFixture, id: "invite-email-token" },
		},
	});

	await page.goto("/invite/invite-email-token/accept");
	await expect(page.getByRole("heading", { name: "Convite Válido!" })).toBeVisible();

	await expect(page.locator("#email")).toHaveCount(0);
	await page.getByRole("button", { name: "Aceitar Convite" }).click();

	await expect.poll(() => state.acceptInviteRequests).toBe(0);
});

test("should accept EMAIL invite and redirect to sign-in with invite email", async ({
	page,
}) => {
	const state = await mockPublicInviteApi(page, {
		invitesByToken: {
			"invite-email-success": {
				...emailInviteFixture,
				id: "invite-email-success",
				email: "convite.email@example.com",
			},
		},
		acceptStatus: 200,
	});

	await page.goto("/invite/invite-email-success/accept");
	await fillInviteAcceptForm(page, {
		firstName: "Ana",
		lastName: "Silva",
		password: "123456",
		confirmPassword: "123456",
	});
	await page.getByRole("button", { name: "Aceitar Convite" }).click();

	await expect.poll(() => state.acceptInviteRequests).toBe(1);
	expect(state.acceptInvitePayload).toMatchObject({
		email: "convite.email@example.com",
		password: "123456",
		name: "Ana Silva",
	});
	await expect(page).toHaveURL(/\/sign-in\?email=convite\.email@example\.com/);
});

test("should render email field for LINK invite and submit typed email", async ({
	page,
}) => {
	const state = await mockPublicInviteApi(page, {
		invitesByToken: {
			"invite-link-success": { ...linkInviteFixture, id: "invite-link-success" },
		},
		acceptStatus: 200,
	});

	await page.goto("/invite/invite-link-success/accept");
	await expect(page.locator("#email")).toBeVisible();

	await fillInviteAcceptForm(page, {
		firstName: "Bruno",
		lastName: "Souza",
		email: "novo.link@example.com",
		password: "123456",
		confirmPassword: "123456",
	});
	await page.getByRole("button", { name: "Aceitar Convite" }).click();

	await expect.poll(() => state.acceptInviteRequests).toBe(1);
	expect(state.acceptInvitePayload).toMatchObject({
		email: "novo.link@example.com",
		password: "123456",
		name: "Bruno Souza",
	});
	await expect(page).toHaveURL(/\/sign-in\?email=novo\.link@example\.com/);
});

test("should stay on accept page when invite acceptance API fails", async ({
	page,
}) => {
	const state = await mockPublicInviteApi(page, {
		invitesByToken: {
			"invite-link-error": { ...linkInviteFixture, id: "invite-link-error" },
		},
		acceptStatus: 500,
	});

	await page.goto("/invite/invite-link-error/accept");
	await fillInviteAcceptForm(page, {
		firstName: "Carlos",
		lastName: "Lima",
		email: "erro.link@example.com",
		password: "123456",
		confirmPassword: "123456",
	});
	await page.getByRole("button", { name: "Aceitar Convite" }).click();

	await expect.poll(() => state.acceptInviteRequests).toBe(1);
	await expect(page).toHaveURL(/\/invite\/invite-link-error\/accept$/);
});
