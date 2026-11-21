import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import type { StateStorage } from 'zustand/middleware';
import {
  NOTIFICATION_PREFERENCES_KEY,
  createNotificationPreferencesStore,
  DEFAULT_NOTIFICATION_PREFERENCES,
} from './notificationPreferencesStore';

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

describe('notification preferences', () => {
  let storage: ReturnType<typeof memoryStorage>;

  beforeEach(() => {
    storage = memoryStorage();
  });

  it('starts private: everything off until the user opts in', () => {
    const store = createNotificationPreferencesStore(storage);
    const state = store.getState();

    assert.equal(state.enabled, false);
    assert.equal(state.deviceConsent, false);
    assert.deepEqual(state.categories, DEFAULT_NOTIFICATION_PREFERENCES.categories);
  });

  it('persists in-app enablement across a simulated restart', () => {
    const first = createNotificationPreferencesStore(storage);
    first.getState().setEnabled(true);

    const second = createNotificationPreferencesStore(storage);
    assert.equal(second.getState().enabled, true);
  });

  it('persists individual category choices independently', () => {
    const first = createNotificationPreferencesStore(storage);
    first.getState().toggleCategory('requestUpdates');

    const second = createNotificationPreferencesStore(storage);
    assert.equal(second.getState().categories.requestUpdates, true);
    assert.equal(second.getState().categories.general, false);
    assert.equal(second.getState().categories.safetyTips, false);
  });

  it('persists explicit device consent and ignores invalid calls', () => {
    const first = createNotificationPreferencesStore(storage);
    first.getState().setDeviceConsent(true);
    // Runtime guards protect against untyped callers.
    first.getState().toggleCategory('unknown' as 'general');
    first.getState().setEnabled('yes' as unknown as boolean);

    const second = createNotificationPreferencesStore(storage);
    assert.equal(second.getState().deviceConsent, true);
    assert.equal(second.getState().enabled, true);
    assert.deepEqual(second.getState().categories, {
      general: false,
      requestUpdates: false,
      safetyTips: false,
    });
  });

  it('discards unknown persisted fields and invalid values', () => {
    storage.data.set(
      NOTIFICATION_PREFERENCES_KEY,
      JSON.stringify({
        state: {
          enabled: 'yes',
          deviceConsent: true,
          categories: { general: true, malicious: true, safetyTips: 'no' },
          accessToken: 'must-never-be-stored-here',
        },
        version: 0,
      }),
    );

    const state = createNotificationPreferencesStore(storage).getState();

    assert.equal(state.enabled, false);
    assert.equal(state.deviceConsent, true);
    assert.deepEqual(state.categories, {
      general: true,
      requestUpdates: false,
      safetyTips: false,
    });
    assert.equal((state as unknown as Record<string, unknown>).accessToken, undefined);
  });

  it('only persists preference fields, never credentials', () => {
    const store = createNotificationPreferencesStore(storage);
    store.getState().setDeviceConsent(true);
    const saved = JSON.parse(storage.data.get(NOTIFICATION_PREFERENCES_KEY) ?? '{}');

    assert.deepEqual(Object.keys(saved.state).sort(), [
      'categories',
      'deviceConsent',
      'enabled',
    ]);
    assert.equal(JSON.stringify(saved).includes('token'), false);
  });
});
