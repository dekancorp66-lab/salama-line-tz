import { useEffect, useMemo, useState } from 'react';
import { Appearance, StyleSheet } from 'react-native';
import {
  darkColors,
  lightColors,
  radius,
  spacing,
  touchTarget,
  typography,
  type AppColors,
} from '../constants/theme';
import { useThemeStore, type ThemeMode } from '../store/themeStore';

export type ResolvedTheme = 'light' | 'dark';

export interface AppTheme {
  colors: AppColors;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
  touchTarget: typeof touchTarget;
  mode: ThemeMode;
  resolved: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
}

/**
 * Single source of live theme tokens. `system` follows the OS appearance
 * setting; explicit choices are persisted by `themeStore`.
 */
export function useTheme(): AppTheme {
  const mode = useThemeStore((state) => state.mode);
  const setMode = useThemeStore((state) => state.setMode);
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() =>
    Appearance.getColorScheme() === 'dark' ? 'dark' : 'light',
  );

  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemTheme(colorScheme === 'dark' ? 'dark' : 'light');
    });
    return () => subscription.remove();
  }, []);

  const resolved: ResolvedTheme = mode === 'system' ? systemTheme : mode;

  return useMemo(
    () => ({
      colors: resolved === 'dark' ? darkColors : lightColors,
      spacing,
      radius,
      typography,
      touchTarget,
      mode,
      resolved,
      setMode,
    }),
    [mode, resolved, setMode],
  );
}

/**
 * Creates styles from live tokens. Pass a module-level factory so the memo
 * dependency stays stable across renders.
 */
export function useStyles<T extends Record<string, object>>(
  factory: (theme: AppTheme) => T,
): T {
  const theme = useTheme();
  // The factory is module-level in every caller; `theme` changes only when the
  // user switches appearance or the OS setting changes under `system`.
  return useMemo(
    () =>
      StyleSheet.create(
        factory(theme) as unknown as Parameters<typeof StyleSheet.create>[0],
      ) as T,
    [factory, theme],
  );
}
