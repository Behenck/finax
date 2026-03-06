import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { AccountProvider } from "generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { createTestApp } from "../../utils/test-app";

let app: any;

function jsonResponse(payload: unknown, status = 200) {
	return new Response(JSON.stringify(payload), {
		status,
		headers: {
			"Content-Type": "application/json",
		},
	});
}

describe("Google authentication", () => {
	beforeAll(async () => {
		app = await createTestApp();
	});

	afterAll(async () => {
		await app.close();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("should start Google OAuth flow with redirect and state cookie", async () => {
		const response = await request(app.server).get("/sessions/google");

		expect(response.statusCode).toBe(302);
		expect(response.headers.location).toContain(
			"https://accounts.google.com/o/oauth2/v2/auth",
		);
		expect(response.headers["set-cookie"]).toBeDefined();
		expect(response.headers["set-cookie"][0]).toContain("oauth_google_state=");
	});

	it("should redirect to sign-in when callback state is invalid", async () => {
		const response = await request(app.server)
			.get("/sessions/google/callback")
			.set("Cookie", "oauth_google_state=invalid-state")
			.query({
				code: "google-auth-code",
				state: "different-state",
			});

		expect(response.statusCode).toBe(302);
		expect(response.headers.location).toContain("/sign-in");
		expect(response.headers.location).toContain("oauthError=");
	});

	it("should create user and account on first Google login", async () => {
		const fetchMock = vi.spyOn(globalThis, "fetch");
		fetchMock.mockResolvedValueOnce(
			jsonResponse({
				access_token: "google-access-token",
				token_type: "Bearer",
				expires_in: 3600,
			}),
		);
		fetchMock.mockResolvedValueOnce(
			jsonResponse({
				sub: "google-sub-new-user",
				email: "google.new.user@example.com",
				email_verified: true,
				name: "Google New User",
				picture: "https://example.com/google-new-user.png",
			}),
		);

		const callbackResponse = await request(app.server)
			.get("/sessions/google/callback")
			.set("Cookie", "oauth_google_state=state-1")
			.query({
				code: "google-auth-code",
				state: "state-1",
			});

		expect(callbackResponse.statusCode).toBe(302);
		expect(callbackResponse.headers.location).toContain("/google/callback?code=");

		const createdUser = await prisma.user.findUnique({
			where: {
				email: "google.new.user@example.com",
			},
			select: {
				id: true,
				name: true,
				avatarUrl: true,
				emailVerifiedAt: true,
			},
		});

		expect(createdUser).not.toBeNull();
		expect(createdUser?.name).toBe("Google New User");
		expect(createdUser?.avatarUrl).toBe("https://example.com/google-new-user.png");
		expect(createdUser?.emailVerifiedAt).not.toBeNull();

		const googleAccount = await prisma.account.findUnique({
			where: {
				provider_providerAccountId: {
					provider: AccountProvider.GOOGLE,
					providerAccountId: "google-sub-new-user",
				},
			},
			select: {
				userId: true,
			},
		});

		expect(googleAccount?.userId).toBe(createdUser?.id);
	});

	it("should link existing user by email without duplicating user", async () => {
		const existingUser = await prisma.user.create({
			data: {
				name: "User Before Link",
				email: "existing.email.link@example.com",
				avatarUrl: "https://example.com/original-avatar.png",
			},
			select: {
				id: true,
			},
		});

		const fetchMock = vi.spyOn(globalThis, "fetch");
		fetchMock.mockResolvedValueOnce(
			jsonResponse({
				access_token: "google-access-token",
				token_type: "Bearer",
				expires_in: 3600,
			}),
		);
		fetchMock.mockResolvedValueOnce(
			jsonResponse({
				sub: "google-sub-existing-email",
				email: "existing.email.link@example.com",
				email_verified: true,
				name: "Google Linked User",
				picture: "https://example.com/google-linked-avatar.png",
			}),
		);

		const callbackResponse = await request(app.server)
			.get("/sessions/google/callback")
			.set("Cookie", "oauth_google_state=state-2")
			.query({
				code: "google-auth-code",
				state: "state-2",
			});

		expect(callbackResponse.statusCode).toBe(302);
		expect(callbackResponse.headers.location).toContain("/google/callback?code=");

		const usersWithEmail = await prisma.user.findMany({
			where: {
				email: "existing.email.link@example.com",
			},
			select: {
				id: true,
				name: true,
				avatarUrl: true,
			},
		});

		expect(usersWithEmail).toHaveLength(1);
		expect(usersWithEmail[0]?.id).toBe(existingUser.id);
		expect(usersWithEmail[0]?.name).toBe("Google Linked User");
		expect(usersWithEmail[0]?.avatarUrl).toBe(
			"https://example.com/google-linked-avatar.png",
		);

		const linkedAccount = await prisma.account.findUnique({
			where: {
				provider_providerAccountId: {
					provider: AccountProvider.GOOGLE,
					providerAccountId: "google-sub-existing-email",
				},
			},
			select: {
				userId: true,
			},
		});

		expect(linkedAccount?.userId).toBe(existingUser.id);
	});

	it("should not duplicate account and should not resync profile after initial Google link", async () => {
		const user = await prisma.user.create({
			data: {
				name: "Original Name",
				email: "already.linked.google@example.com",
				avatarUrl: "https://example.com/original-avatar.png",
				emailVerifiedAt: new Date(),
				accounts: {
					create: {
						provider: AccountProvider.GOOGLE,
						providerAccountId: "google-sub-linked",
					},
				},
			},
			select: {
				id: true,
			},
		});

		const fetchMock = vi.spyOn(globalThis, "fetch");
		fetchMock.mockResolvedValueOnce(
			jsonResponse({
				access_token: "google-access-token",
				token_type: "Bearer",
				expires_in: 3600,
			}),
		);
		fetchMock.mockResolvedValueOnce(
			jsonResponse({
				sub: "google-sub-linked",
				email: "already.linked.google@example.com",
				email_verified: true,
				name: "Changed Google Name",
				picture: "https://example.com/changed-google-avatar.png",
			}),
		);

		const callbackResponse = await request(app.server)
			.get("/sessions/google/callback")
			.set("Cookie", "oauth_google_state=state-3")
			.query({
				code: "google-auth-code",
				state: "state-3",
			});

		expect(callbackResponse.statusCode).toBe(302);
		expect(callbackResponse.headers.location).toContain("/google/callback?code=");

		const updatedUser = await prisma.user.findUnique({
			where: {
				id: user.id,
			},
			select: {
				name: true,
				avatarUrl: true,
			},
		});

		expect(updatedUser?.name).toBe("Original Name");
		expect(updatedUser?.avatarUrl).toBe("https://example.com/original-avatar.png");

		const linkedAccountsCount = await prisma.account.count({
			where: {
				provider: AccountProvider.GOOGLE,
				providerAccountId: "google-sub-linked",
			},
		});

		expect(linkedAccountsCount).toBe(1);
	});

	it("should complete google session exchange with a valid oauth code", async () => {
		const fetchMock = vi.spyOn(globalThis, "fetch");
		fetchMock.mockResolvedValueOnce(
			jsonResponse({
				access_token: "google-access-token",
				token_type: "Bearer",
				expires_in: 3600,
			}),
		);
		fetchMock.mockResolvedValueOnce(
			jsonResponse({
				sub: "google-sub-complete",
				email: "google.complete.flow@example.com",
				email_verified: true,
				name: "Google Complete",
				picture: "https://example.com/google-complete.png",
			}),
		);

		const callbackResponse = await request(app.server)
			.get("/sessions/google/callback")
			.set("Cookie", "oauth_google_state=state-4")
			.query({
				code: "google-auth-code",
				state: "state-4",
			});

		expect(callbackResponse.statusCode).toBe(302);

		const callbackUrl = new URL(callbackResponse.headers.location);
		const oauthCode = callbackUrl.searchParams.get("code");

		expect(oauthCode).toBeTruthy();

		const completeResponse = await request(app.server)
			.post("/sessions/google/complete")
			.send({
				code: oauthCode,
			});

		expect(completeResponse.statusCode).toBe(200);
		expect(completeResponse.body).toHaveProperty("accessToken");
		expect(completeResponse.body).toHaveProperty("refreshToken");
	});

	it("should reject invalid oauth code in complete endpoint", async () => {
		const completeResponse = await request(app.server)
			.post("/sessions/google/complete")
			.send({
				code: "invalid-code",
			});

		expect(completeResponse.statusCode).toBe(401);
		expect(completeResponse.body.message).toBe(
			"Google authentication code is invalid or expired.",
		);
	});
});
