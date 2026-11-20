/**
 * Pure request/response mapping for the two verified AI endpoints. The HTTP
 * client is injected so the contract can be tested without Expo native modules
 * or a live backend. No question or answer text is logged or persisted here.
 */
export interface AiHttpClient {
  get<T>(url: string): Promise<{ data: T }>;
  post<T>(url: string, body?: unknown): Promise<{ data: T }>;
}

export type AiLanguage = 'sw' | 'en';

export interface AiConversationTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface AiSource {
  id: string;
  name: string;
  reference?: string;
  url?: string;
}

export interface AiLegalReference {
  source: string;
  reference: string;
  verified: boolean;
  jurisdiction?: string;
  url?: string;
  note?: string;
}

export interface AiSafetyStatus {
  escalate: boolean;
  reason?: string;
  humanSupportRecommended: boolean;
}

export interface AiAnswer {
  answer: string;
  directAnswer?: string;
  explanation?: string;
  guidance?: string;
  language: AiLanguage;
  sources: AiSource[];
  legalReferences?: AiLegalReference[];
  status?: 'answered' | 'no_reliable_answer' | 'safety_guidance';
  generatedBy?: 'grounded_fallback' | 'configured_llm';
  safety?: AiSafetyStatus;
  disclaimer?: string;
  note?: string;
}

export interface AiHealth {
  status: 'ok' | 'unavailable';
  service?: string;
  knowledgeBase?: { loaded: boolean; records: number };
  answerGeneration?: { mode: string };
}

export interface AskAiInput {
  question: string;
  language: AiLanguage;
  context?: AiConversationTurn[];
}

/** Matches the documented follow-up window used by the web implementation. */
export const AI_CONTEXT_LIMIT = 6;

/** Backend `ConversationTurnDto` rejects longer individual turns. */
export const AI_TURN_LIMIT = 2000;

export function createAiRequests(client: AiHttpClient) {
  return {
    /** GET /ai/health — knowledge-base readiness, not a physical-device claim. */
    async health(): Promise<AiHealth> {
      const response = await client.get<AiHealth>('/ai/health');
      return response.data;
    },

    /** POST /ai/ask — sends only DTO fields and the last few conversation turns. */
    async ask(input: AskAiInput): Promise<AiAnswer> {
      const response = await client.post<AiAnswer>('/ai/ask', {
        question: input.question.trim(),
        language: input.language,
        context: (input.context ?? []).slice(-AI_CONTEXT_LIMIT).map((turn) => ({
          role: turn.role,
          content: turn.content.slice(0, AI_TURN_LIMIT),
        })),
      });
      return response.data;
    },
  };
}

export type AiRequests = ReturnType<typeof createAiRequests>;
