import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import type { StateStorage } from 'zustand/middleware';
import { LANGUAGE_STORAGE_KEY, createLanguageStore } from './languageStore';

function memoryStorage(seed?: Record<string, string>): StateStorage & {
  data: Map<string, string>;
} {
  const data = new Map<string, string>(Object.entries(seed ?? {}));
  return {
    data,
    getItem: (name) => data.get(name) ?? null,
    setItem: (name, value) => {
      data.set(name, value);
    },
    removeItem: (name) => {
      data.delete(name);
    },
  };
}

describe('languageStore persistence', () => {
  let storage: ReturnType<typeof memoryStorage>;

  beforeEach(() => {
    storage = memoryStorage();
  });

  it('defaults to English when nothing is saved', () => {
    const store = createLanguageStore(storage);
    assert.equal(store.getState().language, 'en');
  });

  it('persists an explicit language change', () => {
    const store = createLanguageStore(storage);
    store.getState().setLanguage('sw');

    assert.equal(store.getState().language, 'sw');
    const saved = JSON.parse(storage.data.get(LANGUAGE_STORAGE_KEY) ?? '{}');
    assert.equal(saved.state.language, 'sw');
    assert.equal(saved.version, 0);
  });

  it('restores the saved preference on a fresh store (simulated restart)', () => {
    const first = createLanguageStore(storage);
    first.getState().setLanguage('sw');

    const second = createLanguageStore(storage);
    assert.equal(second.getState().language, 'sw');
  });

  it('falls back to English when the saved value is invalid', () => {
    storage.data.set(
      LANGUAGE_STORAGE_KEY,
      JSON.stringify({ state: { language: 'fr' }, version: 0 }),
    );
    const store = createLanguageStore(storage);
    assert.equal(store.getState().language, 'en');
  });

  it('ignores an invalid value passed to setLanguage', () => {
    const store = createLanguageStore(storage);
    store.getState().setLanguage('sw');
    // Runtime guard protects against untyped callers (navigation, API, etc.).
    store.getState().setLanguage('fr' as 'en');
    assert.equal(store.getState().language, 'sw');
  });

  it('only persists the language field, never other state', () => {
    const store = createLanguageStore(storage);
    store.getState().setLanguage('sw');
    const saved = JSON.parse(storage.data.get(LANGUAGE_STORAGE_KEY) ?? '{}');
    assert.deepEqual(Object.keys(saved.state).sort(), ['language']);
  });
});
