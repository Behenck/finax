import { z } from "zod";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USER_INFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

const GoogleTokenResponseSchema = z.object({
	access_token: z.string(),
	token_type: z.string(),
	expires_in: z.number(),
	scope: z.string().optional(),
	id_token: z.string().optional(),
});

const GoogleUserInfoSchema = z.object({
	sub: z.string(),
	email: z.string().optional(),
	email_verified: z.boolean().optional(),
	name: z.string().optional(),
	picture: z.string().optional(),
});

function getGoogleConfig() {
	const clientId = process.env.GOOGLE_CLIENT_ID;
	const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
	const callbackUrl = process.env.GOOGLE_CALLBACK_URL;

	if (!clientId || !clientSecret || !callbackUrl) {
		throw new Error("Google OAuth environment variables are not configured.");
	}

	return {
		clientId,
		clientSecret,
		callbackUrl,
	};
}

export function buildGoogleAuthUrl({ state }: { state: string }) {
	const { clientId, callbackUrl } = getGoogleConfig();
	const url = new URL(GOOGLE_AUTH_URL);

	url.searchParams.set("client_id", clientId);
	url.searchParams.set("redirect_uri", callbackUrl);
	url.searchParams.set("response_type", "code");
	url.searchParams.set("scope", "openid email profile");
	url.searchParams.set("state", state);
	url.searchParams.set("access_type", "offline");
	url.searchParams.set("prompt", "consent");

	return url.toString();
}

export async function exchangeCodeForGoogleTokens({
	code,
	redirectUri,
}: {
	code: string;
	redirectUri: string;
}) {
	const { clientId, clientSecret } = getGoogleConfig();
	const body = new URLSearchParams({
		code,
		client_id: clientId,
		client_secret: clientSecret,
		redirect_uri: redirectUri,
		grant_type: "authorization_code",
	});

	const response = await fetch(GOOGLE_TOKEN_URL, {
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
		},
		body,
	});

	if (!response.ok) {
		throw new Error("Failed to exchange Google authorization code.");
	}

	const rawData: unknown = await response.json();
	return GoogleTokenResponseSchema.parse(rawData);
}

export async function fetchGoogleUserInfo({
	accessToken,
}: {
	accessToken: string;
}) {
	const response = await fetch(GOOGLE_USER_INFO_URL, {
		headers: {
			Authorization: `Bearer ${accessToken}`,
		},
	});

	if (!response.ok) {
		throw new Error("Failed to fetch Google user info.");
	}

	const rawData: unknown = await response.json();
	return GoogleUserInfoSchema.parse(rawData);
}
