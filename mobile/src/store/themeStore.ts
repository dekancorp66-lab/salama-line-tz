import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

export const THEME_STORAGE_KEY = 'salamaline.theme';

export type ThemeMode = 'light' | 'dark' | 'system';

export const THEME_MODES: readonly ThemeMode[] = ['light', 'dark', 'system'];

export function isThemeMode(value: unknown): value is ThemeMode {
  return typeof value === 'string' && THEME_MODES.includes(value as ThemeMode);
}

export interface ThemeState {
  /** Explicit user choice. `system` follows the OS appearance setting. */
  mode: ThemeMode;
  /** Explicit user action only. Nothing else may change this preference. */
  setMode: (mode: ThemeMode) => void;
}

/**
 * Factory exists so tests can inject in-memory storage without importing
 * native modules. Theme preference is not secret, so AsyncStorage is fine.
 */
export function createThemeStore(storage: StateStorage) {
  return create<ThemeState>()(
    persist(
      (set) => ({
        mode: 'system',
        setMode: (mode) => {
          if (!isThemeMode(mode)) return;
          set({ mode });
        },
      }),
      {
        name: THEME_STORAGE_KEY,
        storage: createJSONStorage(() => storage),
        partialize: (state) => ({ mode: state.mode }),
        merge: (persisted, current) => {
          const saved = (persisted as Partial<ThemeState> | undefined)?.mode;
          return {
            ...current,
            mode: isThemeMode(saved) ? saved : 'system',
          };
        },
      },
    ),
  );
}

export const useThemeStore = createThemeStore(AsyncStorage);
