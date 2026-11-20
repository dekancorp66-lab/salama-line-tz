import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import sw from './locales/sw.json';

export type Language = 'en' | 'sw';

export const DEFAULT_LANGUAGE: Language = 'en';
export const SUPPORTED_LANGUAGES: readonly Language[] = ['en', 'sw'];

export const LANGUAGE_NAMES: Record<Language, string> = {
  en: 'English',
  sw: 'Kiswahili',
};

export function isLanguage(value: unknown): value is Language {
  return value === 'en' || value === 'sw';
}

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources: {
      en: { translation: en },
      sw: { translation: sw },
    },
    // Start from the documented default. The saved preference is applied by
    // I18nProvider after storage rehydration; the device locale is never read.
    lng: DEFAULT_LANGUAGE,
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: [...SUPPORTED_LANGUAGES],
    interpolation: { escapeValue: false },
    returnNull: false,
    returnEmptyString: false,
  });
}

export default i18n;
