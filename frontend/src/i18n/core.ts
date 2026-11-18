import { en } from "./en.ts";
import { sw } from "./sw.ts";
import type {
  Dictionary,
  InterpolationValues,
  Language,
  TranslationKey,
} from "./types.ts";

export const LANGUAGES = ["en", "sw"] as const;
export const DEFAULT_LANGUAGE: Language = "en";
export const LANGUAGE_STORAGE_KEY = "salama-line.language";

export const dictionaries: Record<Language, Dictionary> = { en, sw };

export function isLanguage(value: unknown): value is Language {
  return value === "en" || value === "sw";
}

/** Browser-safe persistence; private browsing or SSR simply falls back to English. */
export function readStoredLanguage(): Language {
  if (typeof window === "undefined") return DEFAULT_LANGUAGE;
  try {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return isLanguage(stored) ? stored : DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

export function writeStoredLanguage(language: Language): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // Language preference is a convenience, never a reason to break the app.
  }
}

export function documentLanguage(language: Language): string {
  return language === "sw" ? "sw-TZ" : "en";
}

function getPath(dictionary: Dictionary, key: string): unknown {
  let node: unknown = dictionary;
  for (const part of key.split(".")) {
    if (typeof node !== "object" || node === null || !(part in node)) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return node;
}

export function interpolate(template: string, values: InterpolationValues): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : match,
  );
}

const warned = new Set<string>();

function warnMissing(language: Language, key: string): void {
  const id = `${language}:${key}`;
  if (warned.has(id)) return;
  warned.add(id);
  if (typeof console !== "undefined") {
    console.warn(`[i18n] Missing ${language} translation for "${key}". Falling back to English.`);
  }
}

/**
 * Translate one key with safe nested fallback to English. An entirely unknown
 * key returns the key itself rather than an empty or misleading message.
 */
export function translate(
  language: Language,
  key: TranslationKey,
  values: InterpolationValues = {},
): string {
  const target = getPath(dictionaries[language], key);
  if (typeof target === "string") return interpolate(target, values);

  warnMissing(language, key);
  const fallback = getPath(dictionaries.en, key);
  if (typeof fallback === "string") return interpolate(fallback, values);

  if (!warned.has(`en:${key}`)) {
    warned.add(`en:${key}`);
    if (typeof console !== "undefined") {
      console.warn(`[i18n] Unknown translation key "${key}".`);
    }
  }
  return key;
}

export function flattenStringKeys(value: unknown, prefix = ""): string[] {
  if (typeof value === "string") return prefix ? [prefix] : [];
  if (typeof value !== "object" || value === null) return [];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    flattenStringKeys(child, prefix ? `${prefix}.${key}` : key),
  );
}

/** Keys that are absent, non-string, or blank in the target dictionary. */
export function findMissingKeys(language: Language): string[] {
  const englishKeys = flattenStringKeys(en).sort();
  const target = dictionaries[language];
  return englishKeys.filter((key) => {
    const value = getPath(target, key);
    return typeof value !== "string" || value.trim().length === 0;
  });
}

/** Keys present in a locale but no longer present in English (drift check). */
export function findExtraKeys(language: Language): string[] {
  const english = new Set(flattenStringKeys(en));
  return flattenStringKeys(dictionaries[language])
    .filter((key) => !english.has(key))
    .sort();
}
