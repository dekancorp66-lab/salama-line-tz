import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  Check,
  CircleAlert,
  Clock,
  Heart,
  Loader2,
  Lock,
  Search,
  Shield,
} from "lucide-react";
import { CopyButton } from "@/components/copy-button.tsx";
import { PublicHeader } from "@/components/public-header.tsx";
import { en } from "@/i18n/en.ts";
import { useI18n, usePageMeta } from "@/i18n/provider.tsx";
import type { TranslationKey } from "@/i18n/types.ts";
import { ApiError } from "@/lib/api-client";
import {
  isValidCaseCode,
  normalizeCaseCode,
  trackCase,
  type CaseTrackingResult,
} from "@/lib/backend-api";
import {
  formatTrackingDate,
  statusLabel,
} from "@/lib/case-tracking";

export const Route = createFileRoute("/track")({
  validateSearch: (search: Record<string, unknown>): { code?: string } => ({
    code: typeof search.code === "string" ? search.code : undefined,
  }),
  head: () => ({
    meta: [
      { title: en.meta.trackTitle },
      { name: "robots", content: "noindex" },
      { name: "description", content: en.meta.trackDescription },
    ],
  }),
  component: TrackCasePage,
});

type TrackingError = "invalid" | "notFound" | "rateLimited" | "network";

const ERROR_KEYS: Record<TrackingError, TranslationKey> = {
  invalid: "track.errorInvalid",
  notFound: "track.errorNotFound",
  rateLimited: "track.errorRateLimited",
  network: "track.errorNetwork",
};

/** Backend progress phrases map to the shared public status labels. */
const PROGRESS_KEYS: Record<string, TranslationKey> = {
  "Help request received": "labels.publicStatuses.RECEIVED",
  "Case is being reviewed": "labels.publicStatuses.UNDER_REVIEW",
  "Case closed": "labels.publicStatuses.CLOSED",
};

function TrackCasePage() {
  const { code } = Route.useSearch();
  const { t, language } = useI18n();
  usePageMeta("track");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<TrackingError | null>(null);
  const [result, setResult] = useState<CaseTrackingResult | null>(null);
  const autoSubmitted = useRef(false);

  const lookup = useCallback(async (raw: string) => {
    setError(null);
    setResult(null);
    const normalized = normalizeCaseCode(raw);
    if (!isValidCaseCode(normalized)) {
      setError("invalid");
      return;
    }
    setBusy(true);
    try {
      setResult(await trackCase(normalized));
    } catch (cause) {
      if (cause instanceof ApiError) {
        if (cause.status === 400) setError("invalid");
        else if (cause.status === 404) setError("notFound");
        else if (cause.status === 429) setError("rateLimited");
        else setError("network");
      } else {
        setError("network");
      }
    } finally {
      setBusy(false);
    }
  }, []);

  // The receipt links here with ?code=... — fill it in and run one lookup.
  useEffect(() => {
    const initial = typeof code === "string" ? normalizeCaseCode(code) : "";
    if (initial && isValidCaseCode(initial) && !autoSubmitted.current) {
      autoSubmitted.current = true;
      setReference(initial);
      void lookup(initial);
    }
  }, [code, lookup]);

  function submit(event: FormEvent) {
    event.preventDefault();
    void lookup(reference);
  }

  function reset() {
    setReference("");
    setResult(null);
    setError(null);
    autoSubmitted.current = false;
  }

  function progressLabel(label: string): string {
    const key = PROGRESS_KEYS[label];
    return key ? t(key) : label;
  }

  return (
    <main className="min-h-screen bg-paper text-ink">
      <PublicHeader current="/track" />

      <div className="mx-auto grid max-w-6xl gap-6 px-4 pb-10 pt-32 sm:px-6 md:grid-cols-[320px_minmax(0,1fr)] md:pt-40">
        <aside className="space-y-4">
          <div className="rounded-[var(--radius-panel)] border border-line bg-paper p-5 shadow-sm md:p-6">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-pink-soft text-pink">
              <Search size={21} />
            </span>
            <h1 className="mt-4 text-2xl font-semibold leading-tight md:text-3xl">{t("track.title")}</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted">{t("track.intro")}</p>
          </div>
          <div className="rounded-[var(--radius-card)] border border-line bg-paper p-5 text-sm">
            <p className="mb-3 flex items-center gap-2 font-semibold text-ink">
              <Shield size={17} className="text-pink" /> {t("track.privacyTitle")}
            </p>
            <ul className="space-y-2.5 text-muted">
              {[t("track.privacy1"), t("track.privacy2"), t("track.privacy3")].map((line) => (
                <li key={line} className="flex gap-2">
                  <Check size={15} className="mt-0.5 shrink-0 text-pink" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
          <div role="note" className="rounded-[var(--radius-card)] border border-pink-line bg-pink-soft p-5 text-sm leading-relaxed">
            <p className="mb-2 flex items-center gap-2 font-semibold text-pink">
              <CircleAlert size={17} /> {t("track.safetyTitle")}
            </p>
            <p className="text-ink">{t("track.safety")}</p>
          </div>
          <div className="rounded-[var(--radius-card)] border border-line bg-paper p-5 text-sm">
            <p className="font-semibold text-ink">{t("track.needHelp")}</p>
            <a href="/report" className="mt-2 inline-flex items-center gap-2 font-semibold text-pink hover:underline">
              <Heart size={15} /> {t("track.needHelpLink")}
            </a>
          </div>
        </aside>

        <section aria-label={t("track.form")} className="min-w-0 rounded-[var(--radius-panel)] border border-line bg-paper p-5 shadow-[var(--shadow-soft)] sm:p-7 md:p-9">
          <form onSubmit={submit} className="space-y-5" noValidate>
            <label htmlFor="case-reference" className="block text-sm font-semibold">
              {t("track.label")}
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id="case-reference"
                value={reference}
                onChange={(event) => setReference(event.target.value.toUpperCase())}
                placeholder={t("track.placeholder")}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                maxLength={11}
                aria-invalid={error === "invalid"}
                aria-describedby="case-reference-hint"
                className="min-h-12 min-w-0 flex-1 rounded-xl border border-line bg-paper px-3 font-mono text-base tracking-wider outline-none placeholder:font-sans placeholder:tracking-normal placeholder:text-muted/70 focus:border-pink"
              />
              <button
                type="submit"
                disabled={busy}
                className="brand-fill inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? <Loader2 size={17} className="animate-spin" /> : <Search size={17} />}
                {busy ? t("track.searching") : t("track.submit")}
              </button>
            </div>
            <p id="case-reference-hint" className="text-xs leading-relaxed text-muted">
              {t("track.hint")}
            </p>
          </form>

          {error && (
            <div role="alert" className="mt-6 flex items-start gap-3 rounded-[var(--radius-card)] border border-pink-line bg-pink-soft p-4 text-sm leading-relaxed text-pink-hover">
              <CircleAlert size={18} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">{t("track.form")}</p>
                <p className="mt-1">{t(ERROR_KEYS[error])}</p>
              </div>
            </div>
          )}

          {busy && !result && (
            <div role="status" aria-live="polite" className="mt-8 space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted">
                <Loader2 size={16} className="animate-spin text-pink" /> {t("track.searching")}
              </div>
              <div className="h-20 animate-pulse rounded-[var(--radius-card)] bg-soft" />
              <div className="h-28 animate-pulse rounded-[var(--radius-card)] bg-soft" />
            </div>
          )}

          {result && !busy && (
            <div className="mt-8 space-y-6" aria-live="polite">
              <div className="rounded-[var(--radius-card)] border border-line bg-soft p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-pink">
                      {t("track.results")}
                    </p>
                    <p className="mt-1 break-all font-mono text-2xl font-semibold tracking-wider text-ink sm:text-3xl">
                      {result.caseCode}
                    </p>
                    <div className="mt-3">
                      <CopyButton value={result.caseCode} label={t("track.copyCode")} compact />
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-2 rounded-full border border-pink-line bg-paper px-4 py-2 text-sm font-semibold text-pink">
                    <Check size={15} /> {statusLabel(language, result.status)}
                  </span>
                </div>
                <dl className="mt-5 grid gap-4 border-t border-line pt-5 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-medium text-muted">{t("track.submitted")}</dt>
                    <dd className="mt-1 flex items-center gap-2 text-sm font-medium text-ink">
                      <Clock size={15} className="text-pink" />
                      {formatTrackingDate(result.submittedAt, language)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-muted">{t("track.updated")}</dt>
                    <dd className="mt-1 flex items-center gap-2 text-sm font-medium text-ink">
                      <Clock size={15} className="text-pink" />
                      {formatTrackingDate(result.lastUpdatedAt, language)}
                    </dd>
                  </div>
                </dl>
              </div>

              {result.needsMoreInformation && (
                <div role="status" className="rounded-[var(--radius-card)] border border-pink-line bg-pink-soft p-5 text-sm leading-relaxed">
                  <p className="flex items-center gap-2 font-semibold text-pink">
                    <CircleAlert size={17} /> {t("track.moreInfoTitle")}
                  </p>
                  <p className="mt-2 text-ink">{t("track.moreInfo")}</p>
                </div>
              )}

              <div>
                <h2 className="text-lg font-semibold tracking-tight">{t("track.progressTitle")}</h2>
                <ol className="mt-4 space-y-0">
                  {result.progressUpdates.map((update, index) => (
                    <li key={`${update.label}-${update.at}`} className="relative flex gap-4 pb-6 last:pb-0">
                      {index < result.progressUpdates.length - 1 && (
                        <span aria-hidden className="absolute left-[11px] top-6 h-full w-px bg-line" />
                      )}
                      <span className="relative z-10 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-pink-soft text-pink">
                        <Check size={14} />
                      </span>
                      <div className="pt-0.5">
                        <p className="text-sm font-semibold text-ink">{progressLabel(update.label)}</p>
                        <p className="mt-0.5 text-xs text-muted">
                          {formatTrackingDate(update.at, language)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>

              <p className="flex items-start gap-2 border-t border-line pt-5 text-xs leading-relaxed text-muted">
                <Lock size={15} className="mt-0.5 shrink-0 text-pink" /> {t("track.safety")}
              </p>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={reset}
                  className="inline-flex min-h-11 items-center rounded-full border border-line px-6 py-2.5 text-sm font-semibold text-ink transition hover:border-pink-line hover:bg-pink-soft"
                >
                  {t("track.another")}
                </button>
                <a href="/report" className="brand-fill inline-flex min-h-11 items-center rounded-full px-6 py-2.5 text-sm font-semibold text-white">
                  {t("track.askHelp")}
                </a>
                <a href="/" className="inline-flex min-h-11 items-center rounded-full border border-line px-6 py-2.5 text-sm font-semibold text-muted transition hover:border-pink-line hover:bg-pink-soft">
                  {t("common.backHome")}
                </a>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
