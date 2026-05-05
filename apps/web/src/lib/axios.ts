import axios, {
	type AxiosError,
	type AxiosRequestConfig,
	type AxiosResponse,
} from "axios";
import { getAuthToken } from "./auth-token";
import { performClientSignOut } from "./session-logout";

export function resolveApiBaseUrl() {
	const configuredUrl = import.meta.env.VITE_API_URL;

	if (typeof window === "undefined") {
		return configuredUrl;
	}

	const fallbackUrl = `${window.location.protocol}//${window.location.hostname}:3333`;

	if (!configuredUrl) {
		return fallbackUrl;
	}

	try {
		const parsedUrl = new URL(configuredUrl);
		if (
			parsedUrl.hostname === "localhost" ||
			parsedUrl.hostname === "127.0.0.1"
		) {
			parsedUrl.hostname = window.location.hostname;
			return parsedUrl.toString().replace(/\/$/, "");
		}

		return parsedUrl.toString().replace(/\/$/, "");
	} catch {
		return configuredUrl;
	}
}

export const api = axios.create({
	baseURL: resolveApiBaseUrl(),
	withCredentials: true,
});

const PUBLIC_AUTH_PATHS = new Set([
	"/sessions/password",
	"/auth/verify-otp",
	"/sessions/google/complete",
	"/password/recover",
	"/password/reset",
]);

function resolveRequestPath(config?: AxiosRequestConfig) {
	if (!config?.url) {
		return null;
	}

	try {
		const baseURL =
			config.baseURL ??
			(typeof window === "undefined" ? "http://localhost" : window.location.origin);
		return new URL(config.url, baseURL).pathname;
	} catch {
		return config.url.startsWith("/") ? config.url : null;
	}
}

function hasAuthorizationHeader(config?: AxiosRequestConfig) {
	const headers = config?.headers;
	if (!headers) {
		return false;
	}

	if ("Authorization" in headers) {
		return Boolean(headers.Authorization);
	}

	if ("authorization" in headers) {
		return Boolean(headers.authorization);
	}

	return false;
}

function shouldAutoLogout(error: AxiosError<{ message?: string }>) {
	if (error.response?.status !== 401) {
		return false;
	}

	if (!hasAuthorizationHeader(error.config)) {
		return false;
	}

	const requestPath = resolveRequestPath(error.config);
	if (requestPath && PUBLIC_AUTH_PATHS.has(requestPath)) {
		return false;
	}

	return true;
}

api.interceptors.request.use((config) => {
	const token = getAuthToken();

	if (token) {
		config.headers = config.headers ?? {};
		config.headers.Authorization = `Bearer ${token}`;
	}

	return config;
});

api.interceptors.response.use(
	(response) => response,
	async (error: AxiosError<{ message?: string }>) => {
		if (shouldAutoLogout(error)) {
			await performClientSignOut({
				reason: "expired",
			});
		}

		throw error;
	},
);

export function isAxiosError(
	error: unknown,
): error is AxiosError<{ message?: string }> {
	return typeof error === "object" && error !== null && "response" in error;
}

export type RequestConfig<TData = unknown> = {
	baseURL?: string;
	url?: string;
	method?: "GET" | "PUT" | "PATCH" | "POST" | "DELETE" | "OPTIONS" | "HEAD";
	params?: unknown;
	data?: TData | FormData;
	responseType?:
		| "arraybuffer"
		| "blob"
		| "document"
		| "json"
		| "text"
		| "stream";
	signal?: AbortSignal;
	validateStatus?: (status: number) => boolean;
	headers?: AxiosRequestConfig["headers"];
	paramsSerializer?: AxiosRequestConfig["paramsSerializer"];
};
export type ResponseErrorConfig<TError = unknown> = AxiosError<TError>;
export type ResponseConfig<TData = unknown> = {
	data: TData;
	status: number;
	statusText: string;
	headers: AxiosResponse["headers"];
};

type HttpClient = {
	<TData, TError = unknown, TRequestData = unknown>(
		config: RequestConfig<TRequestData>,
		errorType?: TError,
	): Promise<ResponseConfig<TData>>;
	getConfig: () => Partial<RequestConfig>;
	setConfig: (config: RequestConfig) => Partial<RequestConfig>;
};

let clientConfig: Partial<RequestConfig> = {};

export const getConfig = () => clientConfig;

export const setConfig = (config: RequestConfig) => {
	clientConfig = config;
	return getConfig();
};

const requestClient = (async <TData, TError = unknown, TRequestData = unknown>(
	config: RequestConfig<TRequestData>,
	errorType?: TError,
) => {
	void errorType;

	const globalConfig = getConfig();

	return api
		.request<TData, ResponseConfig<TData>>({
			...globalConfig,
			...config,
			headers: {
				...(globalConfig.headers ?? {}),
				...(config.headers ?? {}),
			},
		})
		.catch((error: AxiosError<TError>) => {
			throw error;
		});
}) as HttpClient;

requestClient.getConfig = getConfig;
requestClient.setConfig = setConfig;

export const client = requestClient;

export default requestClient;
