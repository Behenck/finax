export interface NormalizedApiError {
	status?: number;
	code?: string;
	message: string;
	raw: unknown;
}

export function normalizeApiError(error: any): NormalizedApiError {
	const status = error?.response?.status || error?.status;

	const data = error?.response?.data || error?.data;

	const code = data?.code || data?.errorCode;

	const message =
		data?.message || data?.error || error?.message || "Erro inesperado";

	return {
		status,
		code,
		message,
		raw: error,
	};
}
