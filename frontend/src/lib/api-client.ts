import { resolveApiBase } from "./api-base";

const API_BASE = resolveApiBase(
  import.meta.env.VITE_API_BASE_URL as string | undefined,
  import.meta.env.DEV,
);
const REQUEST_TIMEOUT_MS = 15_000;

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ApiRequestOptions {
  method?: "GET" | "POST" | "PATCH";
  body?: unknown;
  token?: string | null;
}

function errorMessage(payload: unknown, status: number): string {
  if (payload && typeof payload === "object") {
    const message = (payload as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
    if (Array.isArray(message)) {
      const first = message.find((item) => typeof item === "string" && item.trim());
      if (typeof first === "string") return first;
    }
  }
  if (status === 401) return "Your session has expired. Please sign in again.";
  if (status === 403) return "You are not authorized to perform this action.";
  if (status === 503) return "SalamaLine is temporarily unavailable. Please try again shortly.";
  return `SalamaLine could not complete that request (HTTP ${status}). Please try again.`;
}

/** Shared fetch wrapper for every NestJS-backed screen in the app. */
export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new ApiError(errorMessage(payload, response.status), response.status);
    return payload as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiError("The request took too long. Check your connection and try again.", 408);
    }
    if (error instanceof TypeError) {
      throw new ApiError("We cannot reach SalamaLine right now. Check your connection and try again.", 0);
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}
