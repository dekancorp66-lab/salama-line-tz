import { create } from 'zustand';
import type { AuthStatus } from './session';
import type { AuthUser } from './types';

export interface AuthState {
  /** In-memory only. Tokens live exclusively in SecureStore. */
  user: AuthUser | null;
  status: AuthStatus;
  setAuthenticated: (user: AuthUser) => void;
  setAnonymous: () => void;
  setUnknown: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: 'unknown',
  setAuthenticated: (user) => set({ user, status: 'authenticated' }),
  setAnonymous: () => set({ user: null, status: 'anonymous' }),
  setUnknown: () => set({ user: null, status: 'unknown' }),
}));
