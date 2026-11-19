import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { useI18n } from "@/i18n/provider.tsx";

interface Props {
  /** Exact text to place on the clipboard (a case/reference code). */
  value: string;
  /** Visible button label, e.g. t("help.copyCode"). */
  label: string;
  className?: string;
  /** Hide the text on narrow screens, leaving just the icon. */
  compact?: boolean;
}

export function CopyButton({ value, label, className = "", compact = false }: Props) {
  const { t } = useI18n();
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function copy() {
    if (!value) return;
    let ok = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        ok = true;
      } else {
        // Fallback for browsers without the async clipboard API.
        const field = document.createElement("textarea");
        field.value = value;
        field.setAttribute("readonly", "");
        field.style.position = "fixed";
        field.style.opacity = "0";
        document.body.appendChild(field);
        field.select();
        ok = document.execCommand("copy");
        field.remove();
      }
    } catch {
      ok = false;
    }
    setState(ok ? "copied" : "failed");
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState("idle"), 2500);
  }

  const Icon = state === "copied" ? Check : Copy;
  const text = state === "copied" ? t("common.copied") : state === "failed" ? t("common.copyFailed") : label;

  return (
    <button
      type="button"
      onClick={() => void copy()}
      aria-label={`${label}: ${value}`}
      title={`${label}: ${value}`}
      className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full border border-pink-line bg-paper px-3.5 py-2 text-xs font-semibold text-pink transition hover:bg-pink-soft ${className}`}
    >
      <Icon size={14} aria-hidden="true" />
      <span className={compact ? "hidden sm:inline" : ""}>{text}</span>
    </button>
  );
}
