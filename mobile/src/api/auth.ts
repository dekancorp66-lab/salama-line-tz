import { api } from './client';
import { createAuthRequests } from './authRequests';

/** Bound to the real API client. The pure factory lives in authRequests.ts. */
export const authApi = createAuthRequests(api);

export type {
  RegisterInput,
  LoginInput,
  LoginResult,
} from './authRequests';
