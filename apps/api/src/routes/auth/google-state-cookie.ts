const GOOGLE_STATE_COOKIE_NAME = "oauth_google_state";
const GOOGLE_STATE_COOKIE_TTL_SECONDS = 60 * 10;

function shouldUseSecureCookie() {
	return process.env.NODE_ENV === "production";
}

function appendSecureAttribute(attributes: string[]) {
	if (shouldUseSecureCookie()) {
		attributes.push("Secure");
	}
}

export function createGoogleStateCookie(state: string) {
	const attributes = [
		`${GOOGLE_STATE_COOKIE_NAME}=${encodeURIComponent(state)}`,
		"Path=/",
		"HttpOnly",
		"SameSite=Lax",
		`Max-Age=${GOOGLE_STATE_COOKIE_TTL_SECONDS}`,
	];

	appendSecureAttribute(attributes);

	return attributes.join("; ");
}

export function clearGoogleStateCookie() {
	const attributes = [
		`${GOOGLE_STATE_COOKIE_NAME}=`,
		"Path=/",
		"HttpOnly",
		"SameSite=Lax",
		"Max-Age=0",
		"Expires=Thu, 01 Jan 1970 00:00:00 GMT",
	];

	appendSecureAttribute(attributes);

	return attributes.join("; ");
}

export function readGoogleStateCookie(cookieHeader: string | undefined) {
	if (!cookieHeader) {
		return null;
	}

	const entries = cookieHeader.split(";");
	for (const entry of entries) {
		const [rawName, ...rawValueParts] = entry.trim().split("=");
		if (rawName !== GOOGLE_STATE_COOKIE_NAME) {
			continue;
		}

		const rawValue = rawValueParts.join("=");
		return decodeURIComponent(rawValue);
	}

	return null;
}
