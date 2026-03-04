import axios, {
	type AxiosError,
	type AxiosRequestConfig,
	type AxiosResponse,
} from "axios";
import Cookies from "js-cookie";

export const api = axios.create({
	baseURL: import.meta.env.VITE_API_URL,
	withCredentials: true,
});

api.interceptors.request.use((config) => {
	const token = Cookies.get("token");

	if (token) {
		config.headers = config.headers ?? {};
		config.headers.Authorization = `Bearer ${token}`;
	}

	return config;
});

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

const requestClient = (async <
	TData,
	TError = unknown,
	TRequestData = unknown,
>(
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

export default requestClient
