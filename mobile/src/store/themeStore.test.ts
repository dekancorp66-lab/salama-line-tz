import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import type { StateStorage } from 'zustand/middleware';
import { createThemeStore, THEME_STORAGE_KEY } from './themeStore';

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

describe('themeStore persistence', () => {
  let storage: ReturnType<typeof memoryStorage>;

  beforeEach(() => {
    storage = memoryStorage();
  });

  it('defaults to system when nothing is saved', () => {
    const store = createThemeStore(storage);
    assert.equal(store.getState().mode, 'system');
  });

  it('persists an explicit appearance choice', () => {
    const store = createThemeStore(storage);
    store.getState().setMode('dark');

    assert.equal(store.getState().mode, 'dark');
    const saved = JSON.parse(storage.data.get(THEME_STORAGE_KEY) ?? '{}');
    assert.equal(saved.state.mode, 'dark');
    assert.equal(saved.version, 0);
  });

  it('restores the saved choice on a fresh store (simulated restart)', () => {
    const first = createThemeStore(storage);
    first.getState().setMode('light');

    const second = createThemeStore(storage);
    assert.equal(second.getState().mode, 'light');
  });

  it('falls back to system when the saved value is invalid', () => {
    storage.data.set(
      THEME_STORAGE_KEY,
      JSON.stringify({ state: { mode: 'sepia' }, version: 0 }),
    );
    const store = createThemeStore(storage);
    assert.equal(store.getState().mode, 'system');
  });

  it('ignores an invalid value passed to setMode', () => {
    const store = createThemeStore(storage);
    store.getState().setMode('dark');
    store.getState().setMode('sepia' as 'light');
    assert.equal(store.getState().mode, 'dark');
  });

  it('only persists the mode field, never other state', () => {
    const store = createThemeStore(storage);
    store.getState().setMode('system');
    const saved = JSON.parse(storage.data.get(THEME_STORAGE_KEY) ?? '{}');
    assert.deepEqual(Object.keys(saved.state).sort(), ['mode']);
  });
});
