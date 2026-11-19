import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_THEME,
  readStoredTheme,
  resolveTheme,
  systemPrefersDark,
  writeStoredTheme,
  type ResolvedTheme,
  type Theme,
} from "./core.ts";

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  // The bootstrap script has already set data-theme; start from the default and
  // adopt the stored value after hydration to keep server/client markup stable.
  const [theme, setThemeState] = useState<Theme>(DEFAULT_THEME);
  const [systemDark, setSystemDark] = useState(false);

  useEffect(() => {
    setThemeState(readStoredTheme());
    setSystemDark(systemPrefersDark());

    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    query.addEventListener?.("change", onChange);
    return () => query.removeEventListener?.("change", onChange);
  }, []);

  const resolvedTheme = resolveTheme(theme, systemDark);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", resolvedTheme);
    root.style.colorScheme = resolvedTheme;
    writeStoredTheme(theme);

    const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (themeColor) themeColor.content = resolvedTheme === "dark" ? "#2a2431" : "#fffdfb";
  }, [resolvedTheme, theme]);

  const setTheme = useCallback((next: Theme) => setThemeState(next), []);
  const toggleTheme = useCallback(() => {
    setThemeState((current) => {
      const showing = resolveTheme(current, systemDark);
      return showing === "dark" ? "light" : "dark";
    });
  }, [systemDark]);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, resolvedTheme, setTheme, toggleTheme }),
    [resolvedTheme, setTheme, theme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside ThemeProvider");
  return context;
}
