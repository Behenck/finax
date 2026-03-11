import { expect, test, type Page } from "@playwright/test";
import {
	APP_ORIGIN,
	jsonResponse,
	mockApi,
	noContent,
	onEndpoint,
	redirectResponse,
} from "./support/api-mocks";
import { sessionFixture } from "./support/fixtures";

type AuthMockOptions = {
	passwordStatus?: 200 | 401 | 403;
	sendOtpStatus?: 204 | 400;
	verifyOtpStatus?: 200 | 401;
	meStatus?: 200 | 401;
	googleCompleteStatus?: 200 | 401;
	passwordRecoverStatus?: 200 | 400;
	passwordResetStatus?: 200 | 400;
};

type AuthMockState = {
	passwordRequests: number;
	sendOtpRequests: number;
	verifyOtpRequests: number;
	meRequests: number;
	googleStartRequests: number;
	googleCompleteRequests: number;
	passwordRecoverRequests: number;
	passwordResetRequests: number;
};

function createAuthMockState(): AuthMockState {
	return {
		passwordRequests: 0,
		sendOtpRequests: 0,
		verifyOtpRequests: 0,
		meRequests: 0,
		googleStartRequests: 0,
		googleCompleteRequests: 0,
		passwordRecoverRequests: 0,
		passwordResetRequests: 0,
	};
}

async function mockAuthApi(
	page: Page,
	options: AuthMockOptions = {},
): Promise<AuthMockState> {
	const {
		passwordStatus = 200,
		sendOtpStatus = 204,
		verifyOtpStatus = 200,
		meStatus = 200,
		googleCompleteStatus = 200,
		passwordRecoverStatus = 200,
		passwordResetStatus = 200,
	} = options;
	const state = createAuthMockState();

	await mockApi(page, [
		onEndpoint({
			method: "POST",
			pathname: "/sessions/password",
			handler: async ({ route }) => {
				state.passwordRequests += 1;

				if (passwordStatus === 200) {
					await route.fulfill(
						jsonResponse(200, {
							accessToken: "mock-access-token",
							refreshToken: "mock-refresh-token",
						}),
					);
					return;
				}

				if (passwordStatus === 403) {
					await route.fulfill(
						jsonResponse(403, {
							message:
								"Para acessar o sistema, primeiro conclua a verificação.",
						}),
					);
					return;
				}

				await route.fulfill(
					jsonResponse(401, {
						message: "Credenciais inválidas.",
					}),
				);
			},
		}),
		onEndpoint({
			method: "POST",
			pathname: "/auth/send-email-otp",
			handler: async ({ route }) => {
				state.sendOtpRequests += 1;

				if (sendOtpStatus === 204) {
					await route.fulfill(noContent());
					return;
				}

				await route.fulfill(
					jsonResponse(400, {
						message: "Usuário não encontrado!",
					}),
				);
			},
		}),
		onEndpoint({
			method: "POST",
			pathname: "/auth/verify-otp",
			handler: async ({ route }) => {
				state.verifyOtpRequests += 1;

				if (verifyOtpStatus === 200) {
					await route.fulfill(
						jsonResponse(200, {
							accessToken: "mock-access-token",
							refreshToken: "mock-refresh-token",
						}),
					);
					return;
				}

				await route.fulfill(
					jsonResponse(401, {
						message: "Código inválido.",
					}),
				);
			},
		}),
		onEndpoint({
			method: "GET",
			pathname: "/sessions/google",
			handler: async ({ route }) => {
				state.googleStartRequests += 1;
				await route.fulfill(
					redirectResponse(
						`${APP_ORIGIN}/google/callback?code=mock-google-oauth-code`,
					),
				);
			},
		}),
		onEndpoint({
			method: "POST",
			pathname: "/sessions/google/complete",
			handler: async ({ route }) => {
				state.googleCompleteRequests += 1;

				if (googleCompleteStatus === 200) {
					await route.fulfill(
						jsonResponse(200, {
							accessToken: "mock-access-token",
							refreshToken: "mock-refresh-token",
						}),
					);
					return;
				}

				await route.fulfill(
					jsonResponse(401, {
						message: "Falha na autenticação com Google.",
					}),
				);
			},
		}),
		onEndpoint({
			method: "GET",
			pathname: "/me",
			handler: async ({ route }) => {
				state.meRequests += 1;

				if (meStatus === 200) {
					await route.fulfill(jsonResponse(200, sessionFixture));
					return;
				}

				await route.fulfill(
					jsonResponse(401, {
						message: "Unauthorized",
					}),
				);
			},
		}),
		onEndpoint({
			method: "POST",
			pathname: "/password/recover",
			handler: async ({ route }) => {
				state.passwordRecoverRequests += 1;

				if (passwordRecoverStatus === 200) {
					await route.fulfill(
						jsonResponse(200, {
							message: "Recovery email sent.",
						}),
					);
					return;
				}

				await route.fulfill(
					jsonResponse(400, {
						message: "Email inválido.",
					}),
				);
			},
		}),
		onEndpoint({
			method: "POST",
			pathname: "/password/reset",
			handler: async ({ route }) => {
				state.passwordResetRequests += 1;

				if (passwordResetStatus === 200) {
					await route.fulfill(
						jsonResponse(200, {
							message: "Password reset successfully.",
						}),
					);
					return;
				}

				await route.fulfill(
					jsonResponse(400, {
						message: "Token inválido.",
					}),
				);
			},
		}),
	]);

	return state;
}

async function fillSignInForm(
	page: Page,
	payload: { email: string; password: string },
) {
	await page.getByPlaceholder("seu@email.com").fill(payload.email);
	await page.getByPlaceholder("************").fill(payload.password);
}

async function fillOtpCode(page: Page, code: string) {
	await page.getByRole("textbox").fill(code);
}

test("should redirect unauthenticated access from / to /sign-in", async ({
	page,
}) => {
	await page.goto("/");

	await expect(page.getByPlaceholder("seu@email.com")).toBeVisible({
		timeout: 15_000,
	});
	expect(new URL(page.url()).pathname).toMatch(/^\/(sign-in)?$/);
});

test("should validate invalid email and short password on sign-in", async ({
	page,
}) => {
	const state = await mockAuthApi(page);

	await page.goto("/sign-in");
	await fillSignInForm(page, { email: "invalido", password: "123" });
	await page.getByRole("button", { name: "Entrar" }).click();

	await expect(page).toHaveURL(/\/sign-in$/);
	await expect
		.poll(() => state.passwordRequests, {
			message: "password endpoint should not be called for invalid form data",
		})
		.toBe(0);
});

test("should stay on sign-in when credentials are invalid", async ({ page }) => {
	const state = await mockAuthApi(page, { passwordStatus: 401 });

	await page.goto("/sign-in");
	await fillSignInForm(page, {
		email: "e2e@example.com",
		password: "123456",
	});
	await page.getByRole("button", { name: "Entrar" }).click();

	await expect(page).toHaveURL(/\/sign-in$/);
	await expect.poll(() => state.passwordRequests).toBe(1);
	await expect.poll(() => state.sendOtpRequests).toBe(0);
});

test("should navigate to verify-otp when password auth returns 403", async ({
	page,
}) => {
	await mockAuthApi(page, { passwordStatus: 403, sendOtpStatus: 204, meStatus: 401 });

	await page.goto("/sign-in");
	await fillSignInForm(page, {
		email: "otp-user@example.com",
		password: "123456",
	});
	await page.getByRole("button", { name: "Entrar" }).click();

	await expect(page).toHaveURL(/\/verify-otp\?email=otp-user%40example\.com/);
	await expect(
		page.getByRole("heading", { name: "Verifique seu email" }),
	).toBeVisible();
});

test("should sign in successfully and render authenticated shell", async ({
	page,
}) => {
	await mockAuthApi(page, { passwordStatus: 200, meStatus: 200 });

	await page.goto("/sign-in");
	await fillSignInForm(page, {
		email: "e2e@example.com",
		password: "123456",
	});
	await page.getByRole("button", { name: "Entrar" }).click();

	await expect(page).toHaveURL("/");
	await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible();
	await expect(page.getByRole("button", { name: "Sair" })).toBeVisible();
});

test("should redirect to sign-in if verify-otp is accessed without email", async ({
	page,
}) => {
	await page.goto("/verify-otp");

	await expect(page.getByPlaceholder("seu@email.com")).toBeVisible({
		timeout: 15_000,
	});
	expect(new URL(page.url()).pathname).toMatch(/^\/(verify-otp|sign-in)$/);
});

test("should validate OTP format on client side", async ({ page }) => {
	const state = await mockAuthApi(page);

	await page.goto("/verify-otp?email=otp-user@example.com");
	await fillOtpCode(page, "123");
	await page.getByRole("button", { name: "Verificar código" }).click();

	await expect(page.getByText("Informe os 6 dígitos.")).toBeVisible();
	await expect.poll(() => state.verifyOtpRequests).toBe(0);
});

test("should stay on verify-otp when API rejects verification", async ({
	page,
}) => {
	const state = await mockAuthApi(page, { verifyOtpStatus: 401 });

	await page.goto("/verify-otp?email=otp-user@example.com");
	await fillOtpCode(page, "123456");
	await page.getByRole("button", { name: "Verificar código" }).click();

	await expect.poll(() => state.verifyOtpRequests).toBe(1);
	await expect(page).toHaveURL(/\/verify-otp\?email=otp-user@example\.com/);
});

test("should verify OTP and render authenticated shell", async ({ page }) => {
	await mockAuthApi(page, { verifyOtpStatus: 200, meStatus: 200 });

	await page.goto("/verify-otp?email=otp-user@example.com");
	await fillOtpCode(page, "123456");
	await page.getByRole("button", { name: "Verificar código" }).click();

	await expect(page).toHaveURL("/");
	await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible();
});

test("should redirect google callback without code to sign-in", async ({ page }) => {
	await page.goto("/google/callback");

	await expect(page).toHaveURL(/\/sign-in\?oauthError=/);
	await expect(
		page.getByRole("heading", { name: "Bem-vindo de volta" }),
	).toBeVisible();
});

test("should redirect to sign-in when google callback completion fails", async ({
	page,
}) => {
	const state = await mockAuthApi(page, { googleCompleteStatus: 401, meStatus: 401 });

	await page.goto("/google/callback?code=mock-code");

	await expect.poll(() => state.googleCompleteRequests).toBe(1);
	await expect(page).toHaveURL(/\/sign-in\?oauthError=/);
});

test("should complete google callback and render authenticated shell", async ({
	page,
}) => {
	await mockAuthApi(page, { googleCompleteStatus: 200, meStatus: 200 });

	await page.goto("/google/callback?code=mock-code");

	await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible({
		timeout: 15_000,
	});
	expect(new URL(page.url()).pathname).toMatch(/^\/(google\/callback)?$/);
});

test("should start google login flow from sign-in button", async ({ page }) => {
	const state = await mockAuthApi(page, { googleCompleteStatus: 200, meStatus: 200 });

	await page.goto("/sign-in");
	await page.getByRole("button", { name: "Continuar com Google" }).click();

	await expect.poll(() => state.googleStartRequests).toBe(1);
	await expect(page).toHaveURL(/\/google\/callback\?code=mock-google-oauth-code/);
});

test("should validate email on password recovery form", async ({ page }) => {
	const state = await mockAuthApi(page);

	await page.goto("/password/recover");
	await page.getByPlaceholder("seuemail@exemplo.com").fill("email-invalido");
	await page.getByRole("button", { name: "Enviar instruções" }).click();

	await expect(page).toHaveURL(/\/password\/recover$/);
	await expect.poll(() => state.passwordRecoverRequests).toBe(0);
});

test("should request password recovery and navigate to forgot page", async ({
	page,
}) => {
	const state = await mockAuthApi(page, { passwordRecoverStatus: 200 });

	await page.goto("/password/recover");
	await page.getByPlaceholder("seuemail@exemplo.com").fill("reset@example.com");
	await page.getByRole("button", { name: "Enviar instruções" }).click();

	await expect.poll(() => state.passwordRecoverRequests).toBe(1);
	await expect(page).toHaveURL(/\/password\/forgot\?email=reset@example\.com/);
	await expect(page.getByRole("heading", { name: "Email enviado!" })).toBeVisible();
});

test("should redirect /password/forgot to /password/recover when email is missing", async ({
	page,
}) => {
	await page.goto("/password/forgot");

	await expect(page).toHaveURL(/\/password\/recover$/);
});

test("should resend password recovery email from forgot page", async ({ page }) => {
	const state = await mockAuthApi(page, { passwordRecoverStatus: 200 });

	await page.goto("/password/forgot?email=reset@example.com");
	await page.getByRole("button", { name: "Reenviar email" }).click();

	await expect.poll(() => state.passwordRecoverRequests).toBe(1);
	await expect(page).toHaveURL(/\/password\/forgot\?email=reset@example\.com/);
});

test("should validate password reset form on client side", async ({ page }) => {
	const state = await mockAuthApi(page);

	await page.goto("/password/reset?token=reset-token");
	await page.getByPlaceholder("Mínimo de 6 caracteres").fill("123");
	await page.getByPlaceholder("Confirme sua nova senha").fill("123");
	await page.getByRole("button", { name: "Redefinir Senha" }).click();

	await expect
		.poll(() => state.passwordResetRequests, {
			message: "password reset endpoint should not be called for invalid form data",
		})
		.toBe(0);
});

test("should reset password and navigate back to sign-in", async ({ page }) => {
	const state = await mockAuthApi(page, { passwordResetStatus: 200 });

	await page.goto("/password/reset?token=reset-token");
	await page.getByPlaceholder("Mínimo de 6 caracteres").fill("123456");
	await page.getByPlaceholder("Confirme sua nova senha").fill("123456");
	await page.getByRole("button", { name: "Redefinir Senha" }).click();

	await expect.poll(() => state.passwordResetRequests).toBe(1);
	await expect(page).toHaveURL(/\/sign-in$/);
	await expect(
		page.getByRole("heading", { name: "Bem-vindo de volta" }),
	).toBeVisible();
});
