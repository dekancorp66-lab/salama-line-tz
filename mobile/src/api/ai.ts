import { api } from './client';
import { createAiRequests } from './aiRequests';

/** Bound to the existing API client. The pure factory lives in aiRequests.ts. */
export const aiApi = createAiRequests(api);

export type {
  AiAnswer,
  AiConversationTurn,
  AiHealth,
  AiLanguage,
  AiLegalReference,
  AiSafetyStatus,
  AiSource,
  AskAiInput,
} from './aiRequests';
