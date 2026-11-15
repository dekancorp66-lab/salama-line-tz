export type AiLanguage = "sw" | "en";

export interface AiSource {
  id: string;
  name: string;
}

export interface AiAnswer {
  answer: string;
  language: AiLanguage;
  sources: AiSource[];
  safety?: { escalate?: boolean; humanSupportRecommended?: boolean };
  disclaimer?: string;
  note?: string;
}

export interface AiHealth {
  status: string;
  service?: string;
  knowledgeBase?: { loaded: boolean; records: number };
}

const configuredBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
// Local development uses the Nest server; production defaults to same-origin so
// browsers never try to reach their own localhost. Deployments can override it.
const defaultBase = import.meta.env.DEV ? "http://localhost:3000/api/v1" : "/api/v1";
const API_BASE = (configuredBase || defaultBase).replace(/\/+$/, "");
const REQUEST_TIMEOUT_MS = 15_000;

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { Accept: "application/json", ...init?.headers },
    });
    if (!response.ok) {
      throw new Error(response.status === 503
        ? "The assistant is temporarily unavailable. Please try again shortly."
        : `The assistant could not process that request (HTTP ${response.status}). Please try again.`);
    }
    return await response.json() as T;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("The request took too long. Please check your connection and try again.");
    }
    if (error instanceof TypeError) {
      throw new Error("We can’t reach SalamaLine AI right now. Please check your connection and try again.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

export function checkAiHealth() {
  return apiRequest<AiHealth>("/ai/health");
}

export function askAi(question: string, language: AiLanguage) {
  return apiRequest<AiAnswer>("/ai/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, language }),
  });
}
