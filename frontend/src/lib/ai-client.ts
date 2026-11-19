import { resolveApiBase } from "./api-base";

export type AiLanguage = "sw" | "en";

export interface AiConversationTurn {
  role: "user" | "assistant";
  content: string;
}

export interface AiSource {
  id: string;
  name: string;
  reference?: string;
  url?: string;
}

export interface AiAnswer {
  answer: string;
  directAnswer?: string;
  explanation?: string;
  guidance?: string;
  language: AiLanguage;
  sources: AiSource[];
  legalReferences?: Array<{
    source: string;
    reference: string;
    verified: boolean;
    jurisdiction?: string;
    url?: string;
    note?: string;
  }>;
  status?: "answered" | "no_reliable_answer" | "safety_guidance";
  generatedBy?: "grounded_fallback" | "configured_llm";
  safety?: { escalate?: boolean; humanSupportRecommended?: boolean };
  disclaimer?: string;
  note?: string;
}

export interface AiHealth {
  status: string;
  service?: string;
  knowledgeBase?: { loaded: boolean; records: number };
}

// Use the same production-safe resolver as the rest of the Nest-backed screens:
// a developer localhost must never be baked into a deployed bundle, where it
// would point at the visitor's own machine.
const API_BASE = resolveApiBase(
  import.meta.env.VITE_API_BASE_URL as string | undefined,
  import.meta.env.DEV,
);
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

export function askAi(
  question: string,
  language: AiLanguage,
  context: AiConversationTurn[] = [],
) {
  return apiRequest<AiAnswer>("/ai/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // Only the last few turns are needed to resolve a follow-up, and the
    // backend redacts names/contacts before retrieval or provider use.
    body: JSON.stringify({ question, language, context: context.slice(-6) }),
  });
}
