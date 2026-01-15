import axios, { type AxiosError } from "axios";
import Cookies from "js-cookie";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true, // pode manter, não atrapalha
});

api.interceptors.request.use((config) => {
  const token = Cookies.get("token");

  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export function isAxiosError(error: unknown): error is AxiosError<{ message?: string }> {
  return typeof error === 'object' && error !== null && 'response' in error;
}
