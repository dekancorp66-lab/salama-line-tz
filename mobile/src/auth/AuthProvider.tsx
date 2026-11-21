import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import {
  authApi,
  type LoginInput,
  type RegisterInput,
} from '../api/auth';
import { setUnauthorizedHandler } from '../api/client';
import { tokenStore } from '../api/tokenStore';
import { useAuthStore } from './authStore';
import { restoreSession, type AuthStatus } from './session';
import type { AuthUser } from './types';

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  signIn: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const status = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);

  const refresh = useCallback(async () => {
    useAuthStore.getState().setUnknown();
    const restored = await restoreSession({
      getToken: () => tokenStore.get(),
      fetchMe: () => authApi.me(),
      clearToken: () => tokenStore.remove(),
    });
    if (restored) {
      useAuthStore.getState().setAuthenticated(restored);
    } else {
      useAuthStore.getState().setAnonymous();
    }
  }, []);

  useEffect(() => {
    // A 401 clears both the stored token and the in-memory identity.
    setUnauthorizedHandler(() => useAuthStore.getState().setAnonymous());
    void refresh();
    return () => setUnauthorizedHandler(null);
  }, [refresh]);

  const signIn = useCallback(async (input: LoginInput) => {
    const result = await authApi.login(input);
    await tokenStore.set(result.token);
    useAuthStore.getState().setAuthenticated(result.user);
  }, []);

  const register = useCallback(
    async (input: RegisterInput) => {
      // Public registration creates an active USER; signing in with the same
      // credentials establishes the session using only verified endpoints.
      await authApi.register(input);
      await signIn({ email: input.email, password: input.password });
    },
    [signIn],
  );

  const signOut = useCallback(async () => {
    // Sign-out must always succeed locally, even if the server is unreachable.
    try {
      await authApi.logout();
    } catch {
      // No credentials or response bodies are logged.
    }
    await tokenStore.remove();
    useAuthStore.getState().setAnonymous();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, signIn, register, signOut, refresh }),
    [status, user, signIn, register, signOut, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
