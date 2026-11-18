import { useI18n } from "@/i18n/provider.tsx";
import type { Language } from "@/i18n/types.ts";

const OPTIONS: Array<{ value: Language; labelKey: "common.englishShort" | "common.kiswahiliShort" }> = [
  { value: "en", labelKey: "common.englishShort" },
  { value: "sw", labelKey: "common.kiswahiliShort" },
];

/** Shared EN | SW control. Language codes stay untranslated by design. */
export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { language, setLanguage, t } = useI18n();

  return (
    <div className={`flex shrink-0 items-center gap-1 ${className}`} role="group" aria-label={t("common.language")}>
      {OPTIONS.map((option, index) => (
        <span key={option.value} className="flex items-center gap-1">
          {index > 0 && <span aria-hidden="true" className="text-muted opacity-60">|</span>}
          <button
            type="button"
            onClick={() => setLanguage(option.value)}
            aria-pressed={language === option.value}
            className={`min-h-10 rounded-full px-3 py-2 text-sm transition ${
              language === option.value
                ? "bg-pink text-white"
                : "text-muted hover:bg-pink-soft hover:text-pink"
            }`}
          >
            {t(option.labelKey)}
          </button>
        </span>
      ))}
    </div>
  );
}
