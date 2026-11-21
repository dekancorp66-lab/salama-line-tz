import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import i18n, { DEFAULT_LANGUAGE, isLanguage, type Language } from '../i18n';

export const LANGUAGE_STORAGE_KEY = 'salamaline.language';

export interface LanguageState {
  language: Language;
  /** Explicit user action only. Nothing else may call this. */
  setLanguage: (language: Language) => void;
}

/**
 * Factory exists so tests can inject an in-memory storage without importing
 * native modules. The exported store uses AsyncStorage, which is appropriate
 * for a non-secret preference such as language.
 */
export function createLanguageStore(storage: StateStorage) {
  return create<LanguageState>()(
    persist(
      (set) => ({
        language: DEFAULT_LANGUAGE,
        setLanguage: (language) => {
          if (!isLanguage(language)) return;
          set({ language });
          void i18n.changeLanguage(language);
        },
      }),
      {
        name: LANGUAGE_STORAGE_KEY,
        storage: createJSONStorage(() => storage),
        partialize: (state) => ({ language: state.language }),
        merge: (persisted, current) => {
          const saved = (persisted as Partial<LanguageState> | undefined)?.language;
          return {
            ...current,
            language: isLanguage(saved) ? saved : DEFAULT_LANGUAGE,
          };
        },
      },
    ),
  );
}

export const useLanguageStore = createLanguageStore(AsyncStorage);
