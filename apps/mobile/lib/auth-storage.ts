import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AuthTokens } from "@/types/auth";

const AUTH_STORAGE_KEY = "@finax:auth-tokens";

export async function getStoredTokens(): Promise<AuthTokens | null> {
  const rawValue = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
  if (!rawValue) {
    return null;
  }

  try {
    const parsedValue = JSON.parse(rawValue) as Partial<AuthTokens>;

    if (
      typeof parsedValue.accessToken !== "string" ||
      typeof parsedValue.refreshToken !== "string"
    ) {
      return null;
    }

    return {
      accessToken: parsedValue.accessToken,
      refreshToken: parsedValue.refreshToken,
    };
  } catch {
    return null;
  }
}

export async function setStoredTokens(tokens: AuthTokens): Promise<void> {
  await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(tokens));
}

export async function clearStoredTokens(): Promise<void> {
  await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
}
