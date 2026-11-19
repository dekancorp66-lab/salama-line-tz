import { useState } from "react";
import { HeartHandshake, Menu, X } from "lucide-react";
import { GlobalControls } from "@/components/global-controls.tsx";
import { useI18n } from "@/i18n/provider.tsx";
import type { TranslationKey } from "@/i18n/types.ts";

interface PublicNavItem {
  href: string;
  labelKey: TranslationKey;
  primary?: boolean;
}

/**
 * The single public navigation surface. Staff and institutional areas are
 * deliberately absent: they live on their own isolated routes.
 */
export const PUBLIC_NAV: readonly PublicNavItem[] = [
  { href: "/", labelKey: "common.home" },
  { href: "/report", labelKey: "common.getHelp", primary: true },
  { href: "/ai", labelKey: "common.aiAssistance" },
  { href: "/services", labelKey: "common.verifiedServices" },
  { href: "/organizations", labelKey: "common.organizations" },
  { href: "/ussd", labelKey: "common.ussd" },
  { href: "/track", labelKey: "common.trackMyRequest" },
];

export function PublicHeader({ current }: { current: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed inset-x-0 top-3 z-40 px-3 md:top-5 md:px-5">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 rounded-full border border-line bg-paper/95 px-4 py-2.5 shadow-[var(--shadow-soft)] backdrop-blur md:px-5">
        <a href="/" className="brand-text text-lg font-semibold tracking-tight">
          {t("common.salamaLine")}
        </a>
        <nav aria-label={t("nav.main")} className="hidden items-center gap-0.5 xl:flex">
          {PUBLIC_NAV.map((item) =>
            item.primary ? (
              <a
                key={item.href}
                href={item.href}
                aria-current={current === item.href || (item.href === "/report" && current === "/help") ? "page" : undefined}
                className="brand-fill ml-1 inline-flex min-h-10 items-center rounded-full px-4 py-2 text-sm font-semibold text-white"
              >
                {t(item.labelKey)}
              </a>
            ) : (
              <a
                key={item.href}
                href={item.href}
                aria-current={current === item.href ? "page" : undefined}
                className={`inline-flex min-h-10 items-center rounded-full px-2.5 py-2 text-sm font-medium transition-colors hover:bg-pink-soft hover:text-pink ${
                  current === item.href ? "bg-pink-soft font-semibold text-pink" : "text-muted"
                }`}
              >
                {t(item.labelKey)}
              </a>
            ),
          )}
        </nav>
        <div className="flex items-center gap-2">
          <GlobalControls className="hidden sm:flex" />
          <a
            href="/report"
            className="brand-fill inline-flex min-h-10 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-white sm:hidden"
          >
            <HeartHandshake size={16} aria-hidden="true" />
            {t("common.getHelp")}
          </a>
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-full bg-pink-soft text-pink ring-1 ring-pink-line transition hover:bg-brand-fill hover:text-white xl:hidden"
            aria-label={open ? t("nav.closeMenu") : t("nav.openMenu")}
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>
      {open && (
        <div className="mx-auto mt-2 max-w-6xl rounded-3xl border border-line bg-paper p-2 shadow-[var(--shadow-panel)] xl:hidden">
          <div className="flex justify-end px-3 py-2 sm:hidden">
            <GlobalControls />
          </div>
          <nav aria-label={t("nav.mobile")}>
            {PUBLIC_NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                aria-current={current === item.href || (item.href === "/report" && current === "/help") ? "page" : undefined}
                onClick={() => setOpen(false)}
                className={`block rounded-2xl px-5 py-3 text-sm font-medium transition ${
                  item.primary
                    ? "bg-pink-soft font-semibold text-pink"
                    : current === item.href || (item.href === "/report" && current === "/help")
                      ? "bg-pink-soft font-semibold text-pink"
                      : "text-ink hover:bg-pink-soft hover:text-pink"
                }`}
              >
                {t(item.labelKey)}
              </a>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
