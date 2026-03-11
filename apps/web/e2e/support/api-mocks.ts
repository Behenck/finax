import type { Page, Route } from "@playwright/test";

export const APP_ORIGIN = "http://127.0.0.1:4173";
export const API_ORIGIN = "http://localhost:3333";
export const API_PATTERN = `${API_ORIGIN}/**`;

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS";

export type ApiHandlerContext = {
	route: Route;
	url: URL;
	method: string;
};

export type ApiHandler = (
	context: ApiHandlerContext,
) => boolean | Promise<boolean>;

const corsHeaders = {
	"access-control-allow-origin": APP_ORIGIN,
	"access-control-allow-credentials": "true",
	"access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
	"access-control-allow-headers": "*",
};

export function jsonResponse(
	status: number,
	body: unknown,
	headers: Record<string, string> = {},
) {
	return {
		status,
		headers: {
			...corsHeaders,
			"content-type": "application/json",
			...headers,
		},
		body: JSON.stringify(body),
	};
}

export function noContent(status = 204) {
	return {
		status,
		headers: corsHeaders,
		body: "",
	};
}

export function redirectResponse(location: string, status = 302) {
	return {
		status,
		headers: {
			location,
		},
		body: "",
	};
}

export function onEndpoint({
	method,
	pathname,
	handler,
}: {
	method: HttpMethod;
	pathname: string | RegExp;
	handler: (context: ApiHandlerContext) => Promise<void> | void;
}): ApiHandler {
	const expectedMethod = method.toUpperCase();

	return async (context) => {
		const matchesMethod = context.method === expectedMethod;
		const matchesPath =
			typeof pathname === "string"
				? context.url.pathname === pathname
				: pathname.test(context.url.pathname);

		if (!matchesMethod || !matchesPath) {
			return false;
		}

		await handler(context);
		return true;
	};
}

export async function mockApi(page: Page, handlers: ApiHandler[]) {
	await page.route(API_PATTERN, async (route) => {
		const request = route.request();
		const url = new URL(request.url());
		const method = request.method().toUpperCase();
		const context: ApiHandlerContext = {
			route,
			url,
			method,
		};

		if (method === "OPTIONS") {
			await route.fulfill(noContent());
			return;
		}

		for (const handler of handlers) {
			const handled = await handler(context);
			if (handled) {
				return;
			}
		}

		await route.fulfill(
			jsonResponse(404, {
				message: `No mock for ${method} ${url.pathname}`,
			}),
		);
	});
}

export async function setAuthCookie(page: Page, token = "mock-access-token") {
	await page.context().addCookies([
		{
			name: "token",
			value: token,
			url: APP_ORIGIN,
		},
	]);
}

declare global {
	interface Window {
		__copiedText?: string;
	}
}

export async function mockClipboard(page: Page) {
	await page.addInitScript(() => {
		Object.defineProperty(window, "__copiedText", {
			value: "",
			writable: true,
			configurable: true,
		});

		Object.defineProperty(navigator, "clipboard", {
			configurable: true,
			value: {
				writeText: async (value: string) => {
					window.__copiedText = value;
				},
			},
		});
	});
}

export async function getCopiedText(page: Page) {
	return page.evaluate(() => window.__copiedText ?? "");
}
