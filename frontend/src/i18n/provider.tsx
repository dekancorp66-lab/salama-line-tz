import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { en as enDictionary } from "./en.ts";
import { sw as swDictionary } from "./sw.ts";
import {
  DEFAULT_LANGUAGE,
  documentLanguage,
  readStoredLanguage,
  translate,
  writeStoredLanguage,
} from "./core.ts";
import { apiErrorDescriptor } from "./error-mapper.ts";
import type {
  Dictionary,
  InterpolationValues,
  Language,
  TranslationKey,
} from "./types.ts";

interface I18nContextValue {
  language: Language;
  setLanguage: Dispatch<SetStateAction<Language>>;
  dictionary: Dictionary;
  t: (key: TranslationKey, values?: InterpolationValues) => string;
  errorMessage: (error: unknown) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  // Start with the documented default on both server and client, then adopt the
  // stored preference after hydration so language switching never causes a
  // hydration mismatch.
  const [language, setLanguage] = useState<Language>(DEFAULT_LANGUAGE);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    const stored = readStoredLanguage();
    if (stored !== DEFAULT_LANGUAGE) setLanguage(stored);
    setRestored(true);
  }, []);

  useEffect(() => {
    // Never persist the temporary English default before the stored preference
    // has been restored, otherwise a reload would overwrite the visitor's
    // language with English before it can be read.
    if (!restored) return;
    document.documentElement.lang = documentLanguage(language);
    writeStoredLanguage(language);
  }, [language, restored]);

  const t = useCallback(
    (key: TranslationKey, values: InterpolationValues = {}) => translate(language, key, values),
    [language],
  );

  const errorMessage = useCallback(
    (error: unknown) => {
      const descriptor = apiErrorDescriptor(error);
      return translate(language, descriptor.key, descriptor.values ?? {});
    },
    [language],
  );

  const value = useMemo<I18nContextValue>(
    () => ({ language, setLanguage, dictionary: language === "en" ? enDictionary : swDictionary, t, errorMessage }),
    [errorMessage, language, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n must be used inside I18nProvider");
  return context;
}

export type PageMetaKey =
  | "home"
  | "help"
  | "ai"
  | "services"
  | "organizations"
  | "ussd"
  | "track"
  | "institutions"
  | "officers"
  | "dashboard";

const PAGE_META: Record<PageMetaKey, { title: TranslationKey; description?: TranslationKey }> = {
  home: { title: "meta.homeTitle", description: "meta.homeDescription" },
  help: { title: "meta.helpTitle", description: "meta.helpDescription" },
  ai: { title: "meta.aiTitle", description: "meta.aiDescription" },
  services: { title: "meta.servicesTitle", description: "meta.servicesDescription" },
  organizations: { title: "meta.organizationsTitle", description: "meta.organizationsDescription" },
  ussd: { title: "meta.ussdTitle", description: "meta.ussdDescription" },
  track: { title: "meta.trackTitle", description: "meta.trackDescription" },
  institutions: { title: "meta.institutionsTitle", description: "meta.institutionsDescription" },
  officers: { title: "meta.officersTitle", description: "meta.officersDescription" },
  dashboard: { title: "meta.dashboardTitle" },
};

/** Keeps document.title and description in the visitor's selected language. */
export function usePageMeta(page: PageMetaKey): void {
  const { t } = useI18n();
  const meta = PAGE_META[page];

  useEffect(() => {
    document.title = t(meta.title);
    if (!meta.description) return;
    const element = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (element) element.content = t(meta.description);
  }, [meta.description, meta.title, t]);
}
