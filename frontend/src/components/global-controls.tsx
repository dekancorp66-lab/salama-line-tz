import { LanguageSwitcher } from "@/components/language-switcher.tsx";
import { ThemeToggle } from "@/components/theme-toggle.tsx";

/** Shared header controls: language and theme, present across the whole app. */
export function GlobalControls({ className = "" }: { className?: string }) {
  return (
    <div className={`flex shrink-0 items-center gap-1.5 ${className}`}>
      <LanguageSwitcher />
      <ThemeToggle />
    </div>
  );
}
