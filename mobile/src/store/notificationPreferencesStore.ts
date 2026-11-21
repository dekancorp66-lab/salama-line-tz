import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

export const NOTIFICATION_PREFERENCES_KEY = 'salamaline.notificationPreferences';

export type NotificationCategory = 'general' | 'requestUpdates' | 'safetyTips';

export const NOTIFICATION_CATEGORIES: readonly NotificationCategory[] = [
  'general',
  'requestUpdates',
  'safetyTips',
];

export interface NotificationPreferences {
  /** In-app reminders master switch. Off by default. */
  enabled: boolean;
  categories: Record<NotificationCategory, boolean>;
  /** Explicit consent before any device notification permission is requested. */
  deviceConsent: boolean;
}

export interface NotificationPreferencesState extends NotificationPreferences {
  setEnabled: (enabled: boolean) => void;
  toggleCategory: (category: NotificationCategory) => void;
  setDeviceConsent: (consent: boolean) => void;
}

function isCategory(value: unknown): value is NotificationCategory {
  return (
    typeof value === 'string' &&
    (NOTIFICATION_CATEGORIES as readonly string[]).includes(value)
  );
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

/** Privacy-first defaults: nothing is enabled until the user opts in. */
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  enabled: false,
  categories: { general: false, requestUpdates: false, safetyTips: false },
  deviceConsent: false,
};

function sanitize(saved?: Partial<NotificationPreferences>): NotificationPreferences {
  const categories = { ...DEFAULT_NOTIFICATION_PREFERENCES.categories };
  const savedCategories = saved?.categories as
    | Partial<Record<NotificationCategory, unknown>>
    | undefined;
  if (savedCategories) {
    for (const category of NOTIFICATION_CATEGORIES) {
      if (isBoolean(savedCategories[category])) {
        categories[category] = savedCategories[category] as boolean;
      }
    }
  }
  return {
    enabled: isBoolean(saved?.enabled)
      ? saved.enabled
      : DEFAULT_NOTIFICATION_PREFERENCES.enabled,
    categories,
    deviceConsent: isBoolean(saved?.deviceConsent)
      ? saved.deviceConsent
      : DEFAULT_NOTIFICATION_PREFERENCES.deviceConsent,
  };
}

/**
 * Factory exists so tests can inject in-memory storage without native modules.
 * Preferences are non-secret, so AsyncStorage is appropriate here; tokens are
 * never stored here.
 */
export function createNotificationPreferencesStore(storage: StateStorage) {
  return create<NotificationPreferencesState>()(
    persist(
      (set) => ({
        ...DEFAULT_NOTIFICATION_PREFERENCES,
        categories: { ...DEFAULT_NOTIFICATION_PREFERENCES.categories },
        setEnabled: (enabled) => set({ enabled: !!enabled }),
        toggleCategory: (category) => {
          if (!isCategory(category)) return;
          set((state) => ({
            categories: {
              ...state.categories,
              [category]: !state.categories[category],
            },
          }));
        },
        setDeviceConsent: (consent) => set({ deviceConsent: !!consent }),
      }),
      {
        name: NOTIFICATION_PREFERENCES_KEY,
        storage: createJSONStorage(() => storage),
        partialize: (state) => ({
          enabled: state.enabled,
          categories: state.categories,
          deviceConsent: state.deviceConsent,
        }),
        merge: (persisted, current) => ({
          ...current,
          ...sanitize(persisted as Partial<NotificationPreferences> | undefined),
        }),
      },
    ),
  );
}

export const useNotificationPreferencesStore =
  createNotificationPreferencesStore(AsyncStorage);
