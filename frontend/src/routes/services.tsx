import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Check,
  CircleAlert,
  Heart,
  Loader2,
  Lock,
  Phone,
  Search,
  Shield,
} from "lucide-react";
import { PublicHeader } from "@/components/public-header.tsx";
import { en } from "@/i18n/en.ts";
import { useI18n, usePageMeta } from "@/i18n/provider.tsx";
import type { TranslationKey } from "@/i18n/types.ts";
import { listPublicServices, type PublicServiceEntry } from "@/lib/backend-api";

export const Route = createFileRoute("/services")({
  head: () => ({
    meta: [
      { title: en.meta.servicesTitle },
      { name: "description", content: en.meta.servicesDescription },
    ],
  }),
  component: Services,
});

const SERVICE_TYPE_KEYS: Record<string, TranslationKey> = {
  CLINIC: "labels.serviceTypes.CLINIC",
  LEGAL_AID: "labels.serviceTypes.LEGAL_AID",
  SOCIAL_WELFARE: "labels.serviceTypes.SOCIAL_WELFARE",
  SHELTER: "labels.serviceTypes.SHELTER",
  COUNSELLING: "labels.serviceTypes.COUNSELLING",
  OTHER: "labels.serviceTypes.OTHER",
};

function humanize(value: string): string {
  return value.replaceAll("_", " ").trim();
}

/** Only expose a dialable link for values that actually contain digits. */
function telHref(raw: string): string | null {
  const cleaned = raw.replace(/[^0-9+]/g, "");
  return /\d/.test(cleaned) ? `tel:${cleaned}` : null;
}

function Services() {
  const { t, language, errorMessage } = useI18n();
  usePageMeta("services");
  const [entries, setEntries] = useState<PublicServiceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [reload, setReload] = useState(0);
  const [district, setDistrict] = useState("");
  const [type, setType] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    listPublicServices()
      .then((data) => {
        if (!active) return;
        setEntries(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(cause);
        setEntries([]);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reload]);

  const districts = useMemo(
    () =>
      Array.from(
        new Set(
          entries
            .map((entry) => entry.districtCode)
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort(),
    [entries],
  );
  const types = useMemo(
    () =>
      Array.from(
        new Set(
          entries
            .map((entry) => entry.type)
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort(),
    [entries],
  );
  const visible = useMemo(
    () =>
      entries.filter(
        (entry) =>
          (!district || entry.districtCode === district) &&
          (!type || entry.type === type),
      ),
    [district, entries, type],
  );

  function serviceTypeLabel(value: string): string {
    const key = SERVICE_TYPE_KEYS[value];
    return key ? t(key) : humanize(value);
  }

  function formatDate(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? value
      : date.toLocaleDateString(language === "sw" ? "sw-TZ" : "en-TZ");
  }

  const countLabel =
    visible.length === 1
      ? t("services.countOne")
      : t("services.countOther", { count: visible.length });

  return (
    <main className="min-h-screen bg-paper text-ink">
      <PublicHeader current="/services" />

      <div className="mx-auto grid max-w-6xl gap-6 px-4 pb-10 pt-32 sm:px-6 md:grid-cols-[280px_minmax(0,1fr)] md:pt-40">
        <aside className="space-y-4">
          <div className="rounded-[var(--radius-panel)] border border-line bg-paper p-5 shadow-[var(--shadow-soft)] md:p-6">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-pink-soft text-pink">
              <Shield size={21} />
            </span>
            <h1 className="mt-4 text-2xl font-semibold leading-tight tracking-tight md:text-3xl">
              {t("services.title")}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted">{t("services.intro")}</p>
          </div>

          <div
            role="note"
            className="rounded-[var(--radius-card)] border border-pink-line bg-pink-soft p-5 text-sm leading-relaxed"
          >
            <p className="mb-2 flex items-center gap-2 font-semibold text-pink">
              <Lock size={16} className="shrink-0" /> {t("services.confidentialityTitle")}
            </p>
            <p className="text-ink">{t("services.confidentiality")}</p>
          </div>

          <div className="rounded-[var(--radius-card)] border border-line bg-paper p-5 text-sm">
            <p className="flex items-center gap-2 font-semibold text-ink">
              <Heart size={16} className="shrink-0 text-pink" /> {t("services.needHelp")}
            </p>
            <a href="/report" className="mt-2 inline-flex items-center gap-2 font-semibold text-pink hover:underline">
              {t("services.needHelpLink")} <span aria-hidden>→</span>
            </a>
          </div>
          <a
            href="/track"
            className="flex items-center justify-between gap-3 rounded-[var(--radius-card)] border border-pink-line bg-pink-soft px-5 py-4 text-sm transition hover:bg-pink-line"
          >
            <span className="flex min-w-0 items-center gap-3">
              <Search size={18} className="shrink-0 text-pink" />
              <span className="min-w-0">
                <span className="block font-semibold text-pink">{t("services.track")}</span>
                <span className="mt-0.5 block text-xs text-ink">{t("services.trackHint")}</span>
              </span>
            </span>
            <span aria-hidden className="text-pink">→</span>
          </a>
        </aside>

        <section
          aria-label={t("services.directory")}
          className="min-w-0 rounded-[var(--radius-panel)] border border-line bg-paper p-5 shadow-[var(--shadow-soft)] sm:p-7 md:p-9"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold tracking-tight md:text-2xl">{t("services.directory")}</h2>
            <p role="status" aria-live="polite" className="text-xs font-medium text-muted">
              {loading ? t("services.loading") : countLabel}
            </p>
          </div>

          <fieldset className="mt-5 rounded-[var(--radius-card)] border border-line bg-soft p-4">
            <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted">
              {t("services.filterLabel")}
            </legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <label htmlFor="service-district" className="block text-sm font-semibold">
                {t("services.district")}
                <select
                  id="service-district"
                  value={district}
                  onChange={(event) => setDistrict(event.target.value)}
                  disabled={loading}
                  className="mt-2 min-h-12 w-full rounded-xl border border-line bg-paper px-3 text-sm font-normal outline-none focus:border-pink disabled:opacity-60"
                >
                  <option value="">{t("services.allDistricts")}</option>
                  {districts.map((value) => (
                    <option key={value} value={value}>{value}</option>
                  ))}
                </select>
              </label>
              <label htmlFor="service-type" className="block text-sm font-semibold">
                {t("services.type")}
                <select
                  id="service-type"
                  value={type}
                  onChange={(event) => setType(event.target.value)}
                  disabled={loading}
                  className="mt-2 min-h-12 w-full rounded-xl border border-line bg-paper px-3 text-sm font-normal outline-none focus:border-pink disabled:opacity-60"
                >
                  <option value="">{t("services.allTypes")}</option>
                  {types.map((value) => (
                    <option key={value} value={value}>{serviceTypeLabel(value)}</option>
                  ))}
                </select>
              </label>
            </div>
          </fieldset>

          {loading ? (
            <p role="status" className="mt-6 flex items-center gap-2 text-sm text-muted">
              <Loader2 size={17} className="animate-spin text-pink" /> {t("services.loading")}
            </p>
          ) : error ? (
            <div role="alert" className="mt-6 rounded-[var(--radius-card)] border border-pink-line bg-pink-soft p-5 text-sm leading-relaxed">
              <p className="flex items-start gap-2 font-semibold text-pink">
                <CircleAlert size={17} className="mt-0.5 shrink-0" /> {errorMessage(error)}
              </p>
              <button
                type="button"
                onClick={() => setReload((value) => value + 1)}
                className="brand-fill mt-4 inline-flex min-h-11 items-center rounded-full px-6 py-2.5 text-sm font-semibold text-white"
              >
                {t("services.retry")}
              </button>
            </div>
          ) : visible.length === 0 ? (
            <div className="mt-6 rounded-[var(--radius-card)] border border-line bg-soft p-6 text-sm">
              <p className="flex items-center gap-2 font-semibold text-ink">
                <Search size={17} className="shrink-0 text-pink" /> {t("services.empty")}
              </p>
              <p className="mt-2 text-muted">{t("services.emptyHint")}</p>
              <button
                type="button"
                onClick={() => { setDistrict(""); setType(""); }}
                className="mt-4 inline-flex min-h-11 items-center rounded-full border border-pink-line bg-paper px-6 py-2.5 text-sm font-semibold text-pink transition hover:bg-pink-soft"
              >
                {t("services.allDistricts")} · {t("services.allTypes")}
              </button>
            </div>
          ) : (
            <ul className="mt-6 grid gap-4 md:grid-cols-2">
              {visible.map((entry) => {
                const phone = entry.phonePublic ? telHref(entry.phonePublic) : null;
                return (
                  <li
                    key={entry.id}
                    className="flex min-w-0 flex-col rounded-[var(--radius-card)] border border-line bg-paper p-5 shadow-sm"
                  >
                    <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
                      <h3 className="min-w-0 break-words text-lg font-semibold leading-snug tracking-tight">
                        {entry.name}
                      </h3>
                      <span className="shrink-0 rounded-full bg-pink-soft px-3 py-1 text-xs font-semibold text-pink">
                        {serviceTypeLabel(entry.type)}
                      </span>
                    </div>
                    <dl className="mt-4 space-y-2.5 text-sm">
                      <div className="flex min-w-0 gap-2">
                        <dt className="w-20 shrink-0 text-muted sm:w-24">{t("services.district")}</dt>
                        <dd className="min-w-0 break-words">
                          {entry.districtCode}
                          {entry.region ? ` · ${entry.region}` : ""}
                        </dd>
                      </div>
                      {entry.address && (
                        <div className="flex min-w-0 gap-2">
                          <dt className="w-20 shrink-0 text-muted sm:w-24">{t("services.address")}</dt>
                          <dd className="min-w-0 break-words">{entry.address}</dd>
                        </div>
                      )}
                      {entry.openingHours && (
                        <div className="flex min-w-0 gap-2">
                          <dt className="w-20 shrink-0 text-muted sm:w-24">{t("services.hours")}</dt>
                          <dd className="min-w-0 break-words">{entry.openingHours}</dd>
                        </div>
                      )}
                      {entry.languages && entry.languages.length > 0 && (
                        <div className="flex min-w-0 gap-2">
                          <dt className="w-20 shrink-0 text-muted sm:w-24">{t("services.languages")}</dt>
                          <dd className="min-w-0 break-words">{entry.languages.join(", ")}</dd>
                        </div>
                      )}
                      {entry.phonePublic && phone && (
                        <div className="flex min-w-0 gap-2">
                          <dt className="w-20 shrink-0 text-muted sm:w-24">{t("services.phone")}</dt>
                          <dd className="min-w-0">
                            <a href={phone} className="inline-flex items-center gap-1.5 break-all font-semibold text-pink hover:underline">
                              <Phone size={14} className="shrink-0" /> {entry.phonePublic}
                            </a>
                          </dd>
                        </div>
                      )}
                      <div className="flex min-w-0 gap-2">
                        <dt className="w-20 shrink-0 text-muted sm:w-24">{t("services.verifiedBy")}</dt>
                        <dd className="min-w-0 break-words">{entry.verificationOrg}</dd>
                      </div>
                      <div className="flex min-w-0 gap-2">
                        <dt className="w-20 shrink-0 text-muted sm:w-24">{t("services.verifiedOn")}</dt>
                        <dd className="min-w-0 break-words">{formatDate(entry.verifiedAt)}</dd>
                      </div>
                    </dl>
                    <p className="mt-auto flex items-center gap-1.5 pt-4 text-xs font-medium text-pink">
                      <Check size={14} className="shrink-0" /> {t("services.verifiedBadge")}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
