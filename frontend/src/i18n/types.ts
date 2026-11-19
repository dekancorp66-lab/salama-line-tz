import type { en } from "./en.ts";

/** Recursively widens literal string values while preserving the key shape. */
type WidenStrings<T> = T extends string
  ? string
  : { [K in keyof T]: WidenStrings<T[K]> };

/** The exact key shape both dictionaries must satisfy. */
export type Dictionary = WidenStrings<typeof en>;

export type Language = "en" | "sw";
export interface InterpolationValues {
  [key: string]: string | number;
}

type TranslationPaths<T, Prefix extends string = ""> = {
  [K in keyof T & string]: T[K] extends string
    ? `${Prefix}${K}`
    : TranslationPaths<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

/** Every valid dotted translation key, derived from the English dictionary. */
export type TranslationKey = TranslationPaths<Dictionary>;
