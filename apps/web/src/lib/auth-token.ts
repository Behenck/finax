import Cookies from "js-cookie";

const AUTH_TOKEN_COOKIE_NAME = "token";

function shouldUseSecureCookie() {
	return typeof window !== "undefined" && window.location.protocol === "https:";
}

export function getAuthToken() {
	return Cookies.get(AUTH_TOKEN_COOKIE_NAME);
}

export function setAuthToken(token: string) {
	Cookies.set(AUTH_TOKEN_COOKIE_NAME, token, {
		expires: 1,
		path: "/",
		sameSite: "strict",
		secure: shouldUseSecureCookie(),
	});
}

export function removeAuthToken() {
	Cookies.remove(AUTH_TOKEN_COOKIE_NAME, {
		path: "/",
	});
}
