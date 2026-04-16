import type { FastifyRequest } from "fastify";

export function normalizeOrigin(input?: string | null) {
	if (!input) {
		return null;
	}

	try {
		const parsedUrl = new URL(input);
		if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
			return null;
		}

		return parsedUrl.origin;
	} catch {
		return null;
	}
}

export function getDefaultAppWebUrl() {
	return normalizeOrigin(process.env.APP_WEB_URL) ?? "http://localhost:5173";
}

export function getAllowedAppWebOrigins() {
	const rawOrigins = [
		process.env.APP_WEB_URL,
		...(process.env.APP_WEB_URLS?.split(",") ?? []),
	];

	return Array.from(
		new Set(
			rawOrigins
				.map((origin) => normalizeOrigin(origin?.trim()))
				.filter((origin): origin is string => Boolean(origin)),
		),
	);
}

export function resolveAppWebUrlFromRequest(request: FastifyRequest) {
	const allowedOrigins = getAllowedAppWebOrigins();
	if (allowedOrigins.length === 0) {
		return null;
	}

	const originFromHeader = normalizeOrigin(request.headers.origin);
	if (originFromHeader && allowedOrigins.includes(originFromHeader)) {
		return originFromHeader;
	}

	const originFromReferer = normalizeOrigin(request.headers.referer);
	if (originFromReferer && allowedOrigins.includes(originFromReferer)) {
		return originFromReferer;
	}

	return null;
}
