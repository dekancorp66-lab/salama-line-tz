import type { AuthUser } from '../auth/types';

/**
 * Pure request/response mapping for the verified auth endpoints. The HTTP
 * client is injected so these contracts can be tested without importing
 * Expo native modules or a live backend.
 */
export interface AuthHttpClient {
  post<T>(url: string, body?: unknown): Promise<{ data: T }>;
  get<T>(url: string): Promise<{ data: T }>;
}

export interface RegisterInput {
  email: string;
  password: string;
  displayName: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface LoginResult {
  token: string;
  tokenType: string;
  expiresIn: string;
  user: AuthUser;
}

interface RegisterResponse {
  message: string;
  user: AuthUser;
}

interface LoginResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: string;
  user: AuthUser;
}

interface MeResponse {
  user: AuthUser;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function createAuthRequests(client: AuthHttpClient) {
  return {
    /** POST /auth/register/public — only ever sends the three DTO fields. */
    async register(input: RegisterInput): Promise<AuthUser> {
      const response = await client.post<RegisterResponse>('/auth/register/public', {
        email: normalizeEmail(input.email),
        password: input.password,
        displayName: input.displayName.trim(),
      });
      return response.data.user;
    },

    /** POST /auth/login — returns the token for the caller to store securely. */
    async login(input: LoginInput): Promise<LoginResult> {
      const response = await client.post<LoginResponse>('/auth/login', {
        email: normalizeEmail(input.email),
        password: input.password,
      });
      return {
        token: response.data.accessToken,
        tokenType: response.data.tokenType,
        expiresIn: response.data.expiresIn,
        user: response.data.user,
      };
    },

    /** POST /auth/logout — revokes the token version on the backend. */
    async logout(): Promise<void> {
      await client.post('/auth/logout');
    },

    /** GET /auth/me — used to restore a session from a stored access token. */
    async me(): Promise<AuthUser> {
      const response = await client.get<MeResponse>('/auth/me');
      return response.data.user;
    },
  };
}

export type AuthRequests = ReturnType<typeof createAuthRequests>;
