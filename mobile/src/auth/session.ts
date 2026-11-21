import type { AuthUser } from './types';

export type AuthStatus = 'unknown' | 'anonymous' | 'authenticated';

export interface SessionRestoreDeps {
  getToken: () => Promise<string | null>;
  fetchMe: () => Promise<AuthUser>;
  clearToken: () => Promise<void>;
}

export function isUsableUser(
  user: AuthUser | null | undefined,
): user is AuthUser {
  return (
    !!user &&
    typeof user.id === 'string' &&
    user.id.length > 0 &&
    typeof user.email === 'string' &&
    user.email.length > 0
  );
}

/**
 * Restores a session from the SecureStore token by verifying it with the
 * server. A cached user snapshot is never trusted: the server response is the
 * only source of identity and role. Any failure clears the stored token.
 */
export async function restoreSession(
  deps: SessionRestoreDeps,
): Promise<AuthUser | null> {
  let token: string | null;
  try {
    token = await deps.getToken();
  } catch {
    return null;
  }
  if (!token) return null;

  try {
    const user = await deps.fetchMe();
    if (isUsableUser(user)) return user;
    await deps.clearToken().catch(() => undefined);
    return null;
  } catch {
    // Includes 401/403/5xx/offline: fail closed rather than show stale access.
    await deps.clearToken().catch(() => undefined);
    return null;
  }
}

export type ProtectedRouteDecision =
  | { kind: 'allow' }
  | { kind: 'loading' }
  | { kind: 'redirect'; to: 'auth/sign-in' };

/** Public screens stay open; only account-level routes require a session. */
export function resolveProtectedRoute(
  status: AuthStatus,
): ProtectedRouteDecision {
  if (status === 'unknown') return { kind: 'loading' };
  if (status === 'anonymous') return { kind: 'redirect', to: 'auth/sign-in' };
  return { kind: 'allow' };
}
