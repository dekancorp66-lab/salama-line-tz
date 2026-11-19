import { Moon, Sun } from "lucide-react";
import { useI18n } from "@/i18n/provider.tsx";
import { useTheme } from "@/theme/provider.tsx";

/**
 * Familiar light/dark switch: a moon means "click to go dark" and a sun means
 * "click to go light". The icon describes the destination, matching the
 * convention used by most sites.
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const { resolvedTheme, toggleTheme } = useTheme();
  const { t } = useI18n();
  const goingDark = resolvedTheme !== "dark";
  const Icon = goingDark ? Moon : Sun;
  const label = goingDark ? t("theme.switchToDark") : t("theme.switchToLight");

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      aria-pressed={resolvedTheme === "dark"}
      className={`grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line bg-paper text-muted transition hover:border-pink-line hover:bg-pink-soft hover:text-pink ${className}`}
    >
      <Icon size={18} aria-hidden="true" />
    </button>
  );
}
