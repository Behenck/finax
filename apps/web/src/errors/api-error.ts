export interface NormalizedApiError {
	status?: number;
	code?: string;
	message: string;
	raw: unknown;
}

function getRecord(value: unknown): Record<string, unknown> | null {
	if (typeof value !== "object" || value === null) {
		return null;
	}

	return value as Record<string, unknown>;
}

function getString(value: unknown) {
	return typeof value === "string" ? value : undefined;
}

function getNumber(value: unknown) {
	return typeof value === "number" ? value : undefined;
}

export function normalizeApiError(error: unknown): NormalizedApiError {
	const errorRecord = getRecord(error);
	const responseRecord = getRecord(errorRecord?.response);
	const responseData = getRecord(responseRecord?.data);
	const errorData = getRecord(errorRecord?.data);
	const data = responseData ?? errorData;

	const status =
		getNumber(responseRecord?.status) ?? getNumber(errorRecord?.status);
	const code = getString(data?.code) ?? getString(data?.errorCode);

	const message =
		getString(data?.message) ??
		getString(data?.error) ??
		getString(errorRecord?.message) ??
		"Erro inesperado";

	return {
		status,
		code,
		message,
		raw: error,
	};
}
