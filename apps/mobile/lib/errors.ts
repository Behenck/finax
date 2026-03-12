import { isAxiosError } from "axios";

export function getApiErrorStatus(error: unknown): number | undefined {
  if (isAxiosError(error)) {
    return error.response?.status;
  }

  return undefined;
}

export function getApiErrorMessage(
  error: unknown,
  fallbackMessage: string,
): string {
  if (isAxiosError(error)) {
    const messageFromApi = error.response?.data?.message;
    if (typeof messageFromApi === "string" && messageFromApi.length > 0) {
      return messageFromApi;
    }
  }

  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return fallbackMessage;
}
