import { API_ERROR_MESSAGES } from "./error-messages";
import type { NormalizedApiError } from "./api-error";

export function resolveErrorMessage(error: NormalizedApiError) {
	if (error.code && API_ERROR_MESSAGES[error.code]) {
		return API_ERROR_MESSAGES[error.code];
	}

	return error.message;
}
