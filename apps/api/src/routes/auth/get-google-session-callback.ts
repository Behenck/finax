import { prisma } from "@/lib/prisma";
import { AccountProvider } from "generated/prisma/enums";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { getDefaultAppWebUrl, resolveAppWebUrlFromRequest } from "./app-web-url";
import {
	exchangeCodeForGoogleTokens,
	fetchGoogleUserInfo,
} from "./google-oauth";
import {
	GOOGLE_OAUTH_STATE_PURPOSE,
	verifyGoogleOAuthState,
} from "./google-oauth-state";
import {
	clearGoogleStateCookie,
	readGoogleStateCookie,
} from "./google-state-cookie";

const GoogleSessionCallbackQuerySchema = z.object({
	code: z.string().optional(),
	state: z.string().optional(),
});

function getGoogleCallbackUrl() {
	const callbackUrl = process.env.GOOGLE_CALLBACK_URL;
	if (!callbackUrl) {
		throw new Error("Google callback URL is not configured.");
	}

	return callbackUrl;
}

function extractEmailDomain(email: string) {
	const [, domain] = email.split("@");
	return domain;
}

function buildSignInErrorRedirectUrl(message: string, appWebUrl: string) {
	const redirectUrl = new URL("/sign-in", appWebUrl);
	redirectUrl.searchParams.set("oauthError", message);
	return redirectUrl.toString();
}

function buildProfileErrorRedirectUrl(message: string, appWebUrl: string) {
	const redirectUrl = new URL("/profile", appWebUrl);
	redirectUrl.searchParams.set("googleError", message);
	return redirectUrl.toString();
}

function buildProfileSuccessRedirectUrl(
	type: "linked" | "synced",
	appWebUrl: string,
) {
	const redirectUrl = new URL("/profile", appWebUrl);
	if (type === "linked") {
		redirectUrl.searchParams.set("googleLinked", "true");
	} else {
		redirectUrl.searchParams.set("googleSynced", "true");
	}

	return redirectUrl.toString();
}

function buildGoogleCallbackSuccessUrl(code: string, appWebUrl: string) {
	const redirectUrl = new URL("/google/callback", appWebUrl);
	redirectUrl.searchParams.set("code", code);
	return redirectUrl.toString();
}

export async function getGoogleSessionCallback(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.get(
			"/sessions/google/callback",
			{
				schema: {
					tags: ["auth"],
					summary: "Google OAuth callback",
					querystring: GoogleSessionCallbackQuerySchema,
					response: {
						302: z.null(),
					},
				},
			},
			async (request, reply) => {
				const fallbackAppWebUrl =
					resolveAppWebUrlFromRequest(request) ?? getDefaultAppWebUrl();

				const redirectToSignInWithError = (message: string) => {
					reply.header("Set-Cookie", clearGoogleStateCookie());
					return reply.redirect(
						buildSignInErrorRedirectUrl(message, fallbackAppWebUrl),
					);
				};

				const { code, state } = request.query;
				const stateFromCookie = readGoogleStateCookie(request.headers.cookie);

				if (!code || !state || !stateFromCookie || state !== stateFromCookie) {
					return redirectToSignInWithError(
						"Não foi possível validar o login com Google.",
					);
				}

				let oauthStatePayload: ReturnType<typeof verifyGoogleOAuthState>;
				try {
					oauthStatePayload = verifyGoogleOAuthState(app, state);
				} catch {
					return redirectToSignInWithError(
						"Não foi possível validar o login com Google.",
					);
				}

				const isProfileFlow =
					oauthStatePayload.purpose === GOOGLE_OAUTH_STATE_PURPOSE.LINK ||
					oauthStatePayload.purpose === GOOGLE_OAUTH_STATE_PURPOSE.SYNC;
				const appWebUrl = oauthStatePayload.appWebUrl ?? fallbackAppWebUrl;

				const redirectToError = (message: string) => {
					reply.header("Set-Cookie", clearGoogleStateCookie());

					if (isProfileFlow) {
						return reply.redirect(buildProfileErrorRedirectUrl(message, appWebUrl));
					}

					return reply.redirect(buildSignInErrorRedirectUrl(message, appWebUrl));
				};

				try {
					const tokenResponse = await exchangeCodeForGoogleTokens({
						code,
						redirectUri: getGoogleCallbackUrl(),
					});

					const googleUser = await fetchGoogleUserInfo({
						accessToken: tokenResponse.access_token,
					});

					const email = googleUser.email?.trim().toLowerCase();

					if (!email || !googleUser.email_verified) {
						return redirectToError(
							"Sua conta Google precisa ter e-mail verificado.",
						);
					}

					if (oauthStatePayload.purpose === GOOGLE_OAUTH_STATE_PURPOSE.SIGN_IN) {
						const now = new Date();
						const existingGoogleAccount = await prisma.account.findUnique({
							where: {
								provider_providerAccountId: {
									provider: AccountProvider.GOOGLE,
									providerAccountId: googleUser.sub,
								},
							},
							select: {
								userId: true,
							},
						});

						let userId = existingGoogleAccount?.userId;

						if (!userId) {
							const userFromEmail = await prisma.user.findUnique({
								where: {
									email,
								},
								select: {
									id: true,
									emailVerifiedAt: true,
								},
							});

							if (userFromEmail) {
								const updateData: {
									name?: string;
									avatarUrl?: string;
									emailVerifiedAt?: Date;
								} = {};

								if (googleUser.name) {
									updateData.name = googleUser.name;
								}

								if (googleUser.picture) {
									updateData.avatarUrl = googleUser.picture;
								}

								if (!userFromEmail.emailVerifiedAt) {
									updateData.emailVerifiedAt = now;
								}

								await prisma.$transaction(async (tx) => {
									await tx.account.create({
										data: {
											provider: AccountProvider.GOOGLE,
											providerAccountId: googleUser.sub,
											userId: userFromEmail.id,
										},
									});

									if (Object.keys(updateData).length > 0) {
										await tx.user.update({
											where: {
												id: userFromEmail.id,
											},
											data: updateData,
										});
									}
								});

								userId = userFromEmail.id;
							} else {
								const domain = extractEmailDomain(email);
								const autoJoinOrganization = domain
									? await prisma.organization.findFirst({
											where: {
												domain,
												shouldAttachUserByDomain: true,
											},
											select: {
												id: true,
											},
									  })
									: null;

								const createdUser = await prisma.user.create({
									data: {
										email,
										name: googleUser.name ?? null,
										avatarUrl: googleUser.picture ?? null,
										emailVerifiedAt: now,
										accounts: {
											create: {
												provider: AccountProvider.GOOGLE,
												providerAccountId: googleUser.sub,
											},
										},
										member_on: autoJoinOrganization
											? {
													create: {
														organizationId: autoJoinOrganization.id,
													},
												}
											: undefined,
									},
									select: {
										id: true,
									},
								});

								userId = createdUser.id;
							}
						}

						if (!userId) {
							return redirectToError(
								"Não foi possível identificar o usuário do login Google.",
							);
						}

						const oauthCode = await reply.jwtSign(
							{
								sub: userId,
								purpose: "google_complete",
							},
							{ expiresIn: "60s" },
						);

						reply.header("Set-Cookie", clearGoogleStateCookie());
						return reply.redirect(
							buildGoogleCallbackSuccessUrl(oauthCode, appWebUrl),
						);
					}

					const userId = oauthStatePayload.sub;
					if (!userId) {
						return redirectToError(
							"Não foi possível identificar o usuário para vincular a conta Google.",
						);
					}

					const user = await prisma.user.findUnique({
						where: {
							id: userId,
						},
						select: {
							id: true,
							emailVerifiedAt: true,
						},
					});

					if (!user) {
						return redirectToError("Usuário não encontrado para vinculação Google.");
					}

					const existingGoogleAccount = await prisma.account.findUnique({
						where: {
							provider_providerAccountId: {
								provider: AccountProvider.GOOGLE,
								providerAccountId: googleUser.sub,
							},
						},
						select: {
							userId: true,
						},
					});

					if (oauthStatePayload.purpose === GOOGLE_OAUTH_STATE_PURPOSE.SYNC) {
						if (!existingGoogleAccount || existingGoogleAccount.userId !== userId) {
							return redirectToError(
								"Essa conta Google não está vinculada ao seu usuário.",
							);
						}
					} else {
						if (existingGoogleAccount && existingGoogleAccount.userId !== userId) {
							return redirectToError(
								"Essa conta Google já está vinculada a outro usuário.",
							);
						}

						if (!existingGoogleAccount) {
							await prisma.account.create({
								data: {
									provider: AccountProvider.GOOGLE,
									providerAccountId: googleUser.sub,
									userId,
								},
							});
						}
					}

					const updateData: {
						name?: string;
						avatarUrl?: string;
						emailVerifiedAt?: Date;
					} = {};

					if (googleUser.name) {
						updateData.name = googleUser.name;
					}

					if (googleUser.picture) {
						updateData.avatarUrl = googleUser.picture;
					}

					if (!user.emailVerifiedAt) {
						updateData.emailVerifiedAt = new Date();
					}

					if (Object.keys(updateData).length > 0) {
						await prisma.user.update({
							where: {
								id: userId,
							},
							data: updateData,
						});
					}

					reply.header("Set-Cookie", clearGoogleStateCookie());
					return reply.redirect(
						buildProfileSuccessRedirectUrl(
							oauthStatePayload.purpose === GOOGLE_OAUTH_STATE_PURPOSE.LINK
								? "linked"
								: "synced",
							appWebUrl,
						),
					);
				} catch (error) {
					request.log.error({ error }, "Google callback authentication failed");
					return redirectToError("Não foi possível concluir o login com Google.");
				}
			},
		);
}
