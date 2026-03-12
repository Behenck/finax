import axios, {
  AxiosHeaders,
  type AxiosError,
  type InternalAxiosRequestConfig,
} from "axios";
import Constants from "expo-constants";
import { Platform } from "react-native";
import {
  clearStoredTokens,
  getStoredTokens,
  setStoredTokens,
} from "@/lib/auth-storage";
import type { AuthTokens } from "@/types/auth";

type RetryableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

type RefreshResponse = {
  accessToken: string;
  refreshToken: string;
};

const API_PORT = 3333;

function normalizeApiBaseUrl(url: string): string {
  return url.trim().replace(/\/$/, "");
}

function resolveHostFromExpo(): string | null {
  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants as unknown as { expoGoConfig?: { debuggerHost?: string } })
      .expoGoConfig?.debuggerHost;

  if (!hostUri) {
    return null;
  }

  return hostUri.split(":")[0] ?? null;
}

export function resolveApiBaseUrl(): string {
  const envBaseUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envBaseUrl && envBaseUrl.trim().length > 0) {
    return normalizeApiBaseUrl(envBaseUrl);
  }

  const expoHost = resolveHostFromExpo();
  if (expoHost) {
    return `http://${expoHost}:${API_PORT}`;
  }

  if (Platform.OS === "android") {
    return `http://10.0.2.2:${API_PORT}`;
  }

  return `http://127.0.0.1:${API_PORT}`;
}

export const api = axios.create({
  baseURL: resolveApiBaseUrl(),
  timeout: 15000,
});

const refreshClient = axios.create({
  baseURL: resolveApiBaseUrl(),
  timeout: 15000,
});

let cachedTokens: AuthTokens | null = null;
let refreshPromise: Promise<AuthTokens | null> | null = null;
const authInvalidatedListeners = new Set<() => void>();

function notifyAuthInvalidated() {
  for (const listener of authInvalidatedListeners) {
    listener();
  }
}

export function onAuthInvalidated(listener: () => void): () => void {
  authInvalidatedListeners.add(listener);

  return () => {
    authInvalidatedListeners.delete(listener);
  };
}

export async function bootstrapAuthTokens(): Promise<AuthTokens | null> {
  cachedTokens = await getStoredTokens();
  return cachedTokens;
}

export function getCachedAuthTokens(): AuthTokens | null {
  return cachedTokens;
}

export async function setAuthTokens(tokens: AuthTokens | null): Promise<void> {
  cachedTokens = tokens;

  if (!tokens) {
    await clearStoredTokens();
    return;
  }

  await setStoredTokens(tokens);
}

async function refreshAuthTokens(refreshToken: string): Promise<AuthTokens | null> {
  const { data } = await refreshClient.post<RefreshResponse>("/sessions/refresh", {
    refreshToken,
  });

  if (!data.accessToken || !data.refreshToken) {
    return null;
  }

  const nextTokens: AuthTokens = {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
  };

  await setAuthTokens(nextTokens);
  return nextTokens;
}

api.interceptors.request.use(async (config) => {
  if (!cachedTokens) {
    cachedTokens = await getStoredTokens();
  }

  if (cachedTokens?.accessToken) {
    const headers =
      config.headers instanceof AxiosHeaders
        ? config.headers
        : new AxiosHeaders(config.headers);

    headers.set("Authorization", `Bearer ${cachedTokens.accessToken}`);
    config.headers = headers;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const statusCode = error.response?.status;
    const originalRequest = error.config as RetryableRequestConfig | undefined;

    if (!originalRequest || statusCode !== 401) {
      throw error;
    }

    const requestUrl = originalRequest.url ?? "";
    if (requestUrl.includes("/sessions/refresh") || originalRequest._retry) {
      throw error;
    }

    const tokens = cachedTokens ?? (await getStoredTokens());
    if (!tokens?.refreshToken) {
      throw error;
    }

    originalRequest._retry = true;

    try {
      if (!refreshPromise) {
        refreshPromise = refreshAuthTokens(tokens.refreshToken).finally(() => {
          refreshPromise = null;
        });
      }

      const nextTokens = await refreshPromise;
      if (!nextTokens) {
        throw error;
      }

      const headers =
        originalRequest.headers instanceof AxiosHeaders
          ? originalRequest.headers
          : new AxiosHeaders(originalRequest.headers);

      headers.set("Authorization", `Bearer ${nextTokens.accessToken}`);
      originalRequest.headers = headers;

      return api.request(originalRequest);
    } catch (refreshError) {
      await setAuthTokens(null);
      notifyAuthInvalidated();
      throw refreshError;
    }
  },
);
