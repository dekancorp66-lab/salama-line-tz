/**
 * Public case tracking helpers.
 *
 * The reference is the random case code printed on the receipt (for example
 * SL-CC723587); internal database ids are never used. Display labels come from
 * the centralized dictionaries so status text follows the visitor's language.
 */

import { translate } from "../i18n/core.ts";
import type { Language, TranslationKey } from "../i18n/types.ts";

export type PublicCaseStatus = "RECEIVED" | "UNDER_REVIEW" | "IN_PROGRESS" | "CLOSED";

export interface PublicProgressUpdate {
  label: string;
  at: string;
}

export interface CaseTrackingResult {
  caseCode: string;
  submittedAt: string;
  status: PublicCaseStatus;
  lastUpdatedAt: string;
  progressUpdates: PublicProgressUpdate[];
  needsMoreInformation: boolean;
}

// New references carry 64 bits of entropy; 8-hex references from earlier
// records stay valid so nobody loses access to an existing case.
export const CASE_CODE_PATTERN = /^SL-[0-9A-F]{8}(?:[0-9A-F]{8})?$/;

/** Trim surrounding whitespace and normalise casing without hiding typos. */
export function normalizeCaseCode(value: string): string {
  return value.trim().toUpperCase();
}

/** Same strict format the backend enforces; reject internal ids outright. */
export function isValidCaseCode(value: string): boolean {
  return CASE_CODE_PATTERN.test(normalizeCaseCode(value));
}

export type TrackingLang = Language;

export function statusLabel(lang: TrackingLang, status: PublicCaseStatus): string {
  const key: TranslationKey = `labels.publicStatuses.${status}`;
  return translate(lang, key);
}

/** Stable, readable date without leaking server internals or timezone tricks. */
export function formatTrackingDate(iso: string, lang: TrackingLang): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(lang === "sw" ? "sw-TZ" : "en-TZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
