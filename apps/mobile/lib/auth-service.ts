import { api } from "@/lib/api";
import type { AuthTokens, SessionResponse } from "@/types/auth";

export type SignInWithPasswordInput = {
  email: string;
  password: string;
};

export type SignInWithOtpInput = {
  email: string;
  code: string;
};

export type RequestPasswordRecoverInput = {
  email: string;
};

export type ResetPasswordInput = {
  code: string;
  password: string;
};

export async function signInWithPassword(
  payload: SignInWithPasswordInput,
): Promise<AuthTokens> {
  const { data } = await api.post<AuthTokens>("/sessions/password", payload);
  return data;
}

export async function signInWithOtp(
  payload: SignInWithOtpInput,
): Promise<AuthTokens> {
  const { data } = await api.post<AuthTokens>("/auth/verify-otp", payload);
  return data;
}

export async function getSession(): Promise<SessionResponse> {
  const { data } = await api.get<SessionResponse>("/me");
  return data;
}

export async function sendEmailOtp(email: string): Promise<void> {
  await api.post("/auth/send-email-otp", { email });
}

export async function requestPasswordRecover(
  payload: RequestPasswordRecoverInput,
): Promise<void> {
  await api.post("/password/recover", payload);
}

export async function resetPassword(payload: ResetPasswordInput): Promise<void> {
  await api.post("/password/reset", payload);
}
