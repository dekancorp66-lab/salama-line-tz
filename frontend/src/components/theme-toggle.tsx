import { Monitor, Moon, Sun } from "lucide-react";
import { useI18n } from "@/i18n/provider.tsx";
import type { TranslationKey } from "@/i18n/types.ts";
import { useTheme } from "@/theme/provider.tsx";

const LABELS: Record<string, TranslationKey> = {
  light: "theme.light",
  dark: "theme.dark",
  system: "theme.system",
};

/** Light → dark → system cycle, available in every page header. */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const { t } = useI18n();
  const Icon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`${t("theme.toggle")}: ${t(LABELS[theme]!)}`}
      title={`${t("theme.toggle")}: ${t(LABELS[theme]!)}`}
      className={`grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line bg-paper text-muted transition hover:border-pink-line hover:bg-pink-soft hover:text-pink ${className}`}
    >
      <Icon size={18} aria-hidden="true" />
    </button>
  );
}
