import { type ReactNode } from 'react';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '../theme';

/**
 * Keeps the system status bar readable in both appearances. The rest of the
 * app reads tokens directly through `useTheme`, no context needed. The visible
 * theme transition is the short icon crossfade in `ThemeToggle`; the navigator
 * tree is intentionally left untouched.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const { resolved } = useTheme();
  return (
    <>
      <StatusBar style={resolved === 'dark' ? 'light' : 'dark'} />
      {children}
    </>
  );
}
