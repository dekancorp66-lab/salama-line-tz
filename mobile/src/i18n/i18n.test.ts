import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import en from './locales/en.json';
import sw from './locales/sw.json';
import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES, isLanguage } from './index';

function flatten(value: Record<string, unknown>, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
      Object.assign(result, flatten(entry as Record<string, unknown>, path));
    } else {
      result[path] = String(entry);
    }
  }
  return result;
}

function readSource(path: string): string {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

describe('i18n translation resources', () => {
  const enKeys = flatten(en as Record<string, unknown>);
  const swKeys = flatten(sw as Record<string, unknown>);

  it('has exactly the same keys in English and Kiswahili', () => {
    assert.deepEqual(Object.keys(swKeys).sort(), Object.keys(enKeys).sort());
  });

  it('has no empty translations in either language', () => {
    for (const [key, value] of Object.entries(enKeys)) {
      assert.ok(value.trim().length > 0, `en.${key} is empty`);
    }
    for (const [key, value] of Object.entries(swKeys)) {
      assert.ok(value.trim().length > 0, `sw.${key} is empty`);
    }
  });

  it('translates the language and quick-exit labels rather than copying them', () => {
    assert.notEqual(swKeys['language.english'], enKeys['language.english']);
    assert.notEqual(swKeys['quickExit.button'], enKeys['quickExit.button']);
    assert.notEqual(swKeys['nav.home'], enKeys['nav.home']);
  });

  it('defaults to English and supports only en and sw', () => {
    assert.equal(DEFAULT_LANGUAGE, 'en');
    assert.deepEqual([...SUPPORTED_LANGUAGES], ['en', 'sw']);
    assert.equal(isLanguage('en'), true);
    assert.equal(isLanguage('sw'), true);
    assert.equal(isLanguage('fr'), false);
    assert.equal(isLanguage(undefined), false);
  });
});

describe('language source-of-truth', () => {
  it('never reads the device locale in the i18n or language store code', () => {
    const sources = [
      readSource('../i18n/index.ts'),
      readSource('../store/languageStore.ts'),
      readSource('../providers/I18nProvider.tsx'),
    ].join('\n');

    const forbidden = [
      'Localization',
      'getLocales',
      'getLocale',
      'deviceLocale',
      'SettingsManager',
      'currentDeviceLanguage',
    ];

    for (const token of forbidden) {
      assert.equal(
        sources.includes(token),
        false,
        `device locale API "${token}" must not be used`,
      );
    }
  });
});
