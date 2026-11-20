export type ToggleTarget = 'light' | 'dark';

/**
 * The header toggle shows the action, not the current state: light mode offers
 * dark mode, and dark mode offers light mode. An explicit press always replaces
 * `system` with that target through the single persisted theme store.
 */
export function getThemeToggleTarget(resolved: 'light' | 'dark'): ToggleTarget {
  return resolved === 'dark' ? 'light' : 'dark';
}
