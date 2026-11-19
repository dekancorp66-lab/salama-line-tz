import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { en } from "./en.ts";
import { sw } from "./sw.ts";
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  documentLanguage,
  findExtraKeys,
  findMissingKeys,
  interpolate,
  readStoredLanguage,
  translate,
  writeStoredLanguage,
} from "./core.ts";
import { apiErrorDescriptor } from "./error-mapper.ts";
import type { TranslationKey } from "./types.ts";

const FRONTEND_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

class MemoryStorage {
  private readonly data = new Map<string, string>();

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }

  clear(): void {
    this.data.clear();
  }

  key(index: number): string | null {
    return [...this.data.keys()][index] ?? null;
  }

  get length(): number {
    return this.data.size;
  }
}

function installFakeWindow(storage: MemoryStorage | null): void {
  const global = globalThis as unknown as { window?: unknown };
  if (storage) global.window = { localStorage: storage };
  else delete global.window;
}

function flattenValues(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") {
    out.push(value);
    return out;
  }
  if (typeof value === "object" && value !== null) {
    for (const child of Object.values(value as Record<string, unknown>)) {
      flattenValues(child, out);
    }
  }
  return out;
}

test("English and Tanzanian Kiswahili dictionaries have exact key parity", () => {
  assert.deepEqual(findMissingKeys("en"), []);
  assert.deepEqual(findMissingKeys("sw"), []);
  assert.deepEqual(findExtraKeys("en"), []);
  assert.deepEqual(findExtraKeys("sw"), []);

  for (const value of flattenValues(en)) {
    assert.notEqual(value.trim(), "", "English dictionary contains a blank value");
  }
  for (const value of flattenValues(sw)) {
    assert.notEqual(value.trim(), "", "Kiswahili dictionary contains a blank value");
  }
});

test("required bilingual terms and the exact AI Assistance name are preserved", () => {
  assert.equal(en.common.getHelp, "Get Help");
  assert.equal(sw.common.getHelp, "Pata Msaada");
  assert.equal(en.common.trackMyRequest, "Track My Request");
  assert.equal(sw.common.trackMyRequest, "Fuatilia Ombi Langu");
  assert.equal(en.common.verifiedServices, "Verified Services");
  assert.equal(sw.common.verifiedServices, "Huduma Zilizothibitishwa");
  assert.equal(en.help.submit, "Submit Request");
  assert.equal(sw.help.submit, "Tuma Ombi");
  assert.equal(en.help.received, "Your request was received");
  assert.equal(sw.help.received, "Ombi lako limepokelewa");
  assert.equal(en.track.results, "Case Status");
  assert.equal(sw.track.results, "Hali ya Kesi");
  assert.equal(en.ai.title, "AI Assistance");
  assert.equal(sw.ai.title, "AI Assistance");
});

test("translate uses the selected language, interpolates values, and falls back safely", () => {
  assert.equal(translate("en", "common.getHelp"), "Get Help");
  assert.equal(translate("sw", "common.getHelp"), "Pata Msaada");
  assert.equal(translate("en", "common.generatedAt", { date: "18 Nov" }), "Generated 18 Nov.");
  assert.equal(interpolate("{a} and {b}", { a: "one", b: 2 }), "one and 2");
  assert.equal(interpolate("{missing}", {}), "{missing}");

  const warn = console.warn;
  console.warn = () => undefined;
  try {
    assert.equal(
      translate("sw", "does.not.exist" as TranslationKey),
      "does.not.exist",
      "unknown keys must not render as blank or misleading messages",
    );
  } finally {
    console.warn = warn;
  }
});

test("language persistence defaults to English, survives reload, and sets the document locale", () => {
  const storage = new MemoryStorage();
  installFakeWindow(storage);
  try {
    assert.equal(readStoredLanguage(), DEFAULT_LANGUAGE);
    assert.equal(documentLanguage("en"), "en");
    assert.equal(documentLanguage("sw"), "sw-TZ");

    writeStoredLanguage("sw");
    assert.equal(storage.getItem(LANGUAGE_STORAGE_KEY), "sw");
    assert.equal(readStoredLanguage(), "sw", "a reload must restore the selected language");

    storage.setItem(LANGUAGE_STORAGE_KEY, "french");
    assert.equal(readStoredLanguage(), DEFAULT_LANGUAGE);
  } finally {
    installFakeWindow(null);
  }
});

test("API errors map to stable translated keys", () => {
  const cases: Array<[unknown, string]> = [
    [{ status: 401, message: "Unauthorized" }, "errors.sessionExpired"],
    [{ status: 429 }, "errors.rateLimited"],
    [{ message: "Invalid credentials or account not activated" }, "apiErrors.invalidCredentials"],
    [{ message: "Case reference not found" }, "apiErrors.caseNotFound"],
    [{ message: "Too many requests" }, "errors.rateLimited"],
    [{ status: 503 }, "errors.unavailable"],
    [{ name: "AbortError" }, "errors.timeout"],
  ];
  for (const [error, expectedKey] of cases) {
    const descriptor = apiErrorDescriptor(error);
    assert.equal(descriptor.key, expectedKey);
    assert.ok(translate("sw", descriptor.key, descriptor.values ?? {}).length > 0);
  }
});

const USER_FACING_SOURCES = [
  "src/routes/index.tsx",
  "src/routes/help.tsx",
  "src/routes/ai.tsx",
  "src/routes/services.tsx",
  "src/routes/organizations.tsx",
  "src/routes/ussd.tsx",
  "src/routes/track.tsx",
  "src/routes/institutions.tsx",
  "src/routes/officers.tsx",
  "src/routes/dashboard.tsx",
  "src/components/officers/case-workspace.tsx",
  "src/components/officers/admin-console.tsx",
  "src/components/simulator.tsx",
  "src/components/public-header.tsx",
  "src/components/global-controls.tsx",
  "src/components/language-switcher.tsx",
  "src/components/theme-toggle.tsx",
  "src/components/logo-marquee.tsx",
  "src/lib/error-component.tsx",
];

const LEGACY_COPY = [
  "get help",
  "track my request",
  "verified services",
  "case status",
  "submit request",
  "your request was received",
  "sign in to the institutional portal",
  "accounts are provisioned by an administrator",
  "something went wrong",
  "your privacy",
  "confidential - authorised staff only",
];

const ALLOWED_LITERALS = new Set([
  "SalamaLine",
  "AI Assistance",
  "AI",
  "USSD",
  "SMS",
  "WhatsApp",
  "SL-CC723587",
  "*150#",
  "ACK",
  "CLOSE",
  "SALAMA",
  "NDIO",
  "FUTA",
]);

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

function suspiciousCopy(source: string): string[] {
  const clean = stripComments(source);
  const found: string[] = [];

  for (const match of clean.matchAll(/>\s*([A-Za-z][\w'’&.,!?:/()+\-]*(?:\s+[\w'’&.,!?:/()+\-]+){1,})\s*</g)) {
    found.push(match[1].trim());
  }
  for (const match of clean.matchAll(/\b(?:placeholder|aria-label|alt|title)="([^"]+)"/g)) {
    found.push(match[1].trim());
  }

  return found.filter((text) => {
    if (ALLOWED_LITERALS.has(text)) return false;
    if (/[{}$()]/.test(text)) return false;
    if (/^[A-Z0-9\s#*-]+$/.test(text)) return false;
    return text.split(/\s+/).length >= 2;
  });
}

test("user-facing surfaces do not retain legacy hardcoded copy", () => {
  for (const relative of USER_FACING_SOURCES) {
    const source = readFileSync(join(FRONTEND_ROOT, relative), "utf8");
    for (const phrase of LEGACY_COPY) {
      assert.equal(
        source.toLowerCase().includes(phrase),
        false,
        `${relative} still contains hardcoded UI copy: "${phrase}"`,
      );
    }
    assert.deepEqual(
      suspiciousCopy(source),
      [],
      `${relative} contains untranslated JSX text or user-facing attributes`,
    );
  }
});
