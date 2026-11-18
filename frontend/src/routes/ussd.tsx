import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Check, CircleAlert, MessageCircle, MessagesSquare, Shield, Smartphone } from "lucide-react";
import { PublicHeader } from "@/components/public-header.tsx";
import { Simulator } from "@/components/simulator.tsx";
import { en } from "@/i18n/en.ts";
import { useI18n, usePageMeta } from "@/i18n/provider.tsx";

export const Route = createFileRoute("/ussd")({
  head: () => ({
    meta: [
      { title: en.meta.ussdTitle },
      { name: "description", content: en.meta.ussdDescription },
    ],
  }),
  component: UssdPage,
});

interface ChannelStatus {
  ussd: { configured: boolean; shortCode: string | null };
  sms: { configured: boolean };
  whatsapp: { configured: boolean };
}

const SAFE_SHORT_CODE = /^\*[0-9]{2,8}#$/;

function StatusPill({ configured }: { configured: boolean }) {
  const { t } = useI18n();
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
        configured ? "bg-pink-soft text-pink" : "bg-soft text-muted"
      }`}
    >
      <Check size={13} aria-hidden="true" />
      {configured ? t("ussd.statusConfigured") : t("ussd.statusNotConfigured")}
    </span>
  );
}

function UssdPage() {
  const { t } = useI18n();
  usePageMeta("ussd");
  const [status, setStatus] = useState<ChannelStatus | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/channels-status")
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data: ChannelStatus) => { if (active) setStatus(data); })
      .catch(() => { if (active) setStatus(null); });
    return () => { active = false; };
  }, []);

  const steps = [
    [t("ussd.step1Title"), t("ussd.step1Text")],
    [t("ussd.step2Title"), t("ussd.step2Text")],
    [t("ussd.step3Title"), t("ussd.step3Text")],
  ] as const;

  const channels = [
    { key: "ussd", icon: Smartphone, title: t("common.ussd"), body: t("ussd.ussdText"), configured: status?.ussd.configured },
    { key: "sms", icon: MessagesSquare, title: t("ussd.smsTitle"), body: t("ussd.smsText"), configured: status?.sms.configured },
    { key: "whatsapp", icon: MessageCircle, title: t("ussd.whatsappTitle"), body: t("ussd.whatsappText"), configured: status?.whatsapp.configured },
  ] as const;

  return (
    <div className="min-h-screen bg-paper text-ink">
      <PublicHeader current="/ussd" />
      <main className="mx-auto max-w-6xl px-4 pb-20 pt-32 md:px-6 md:pt-40">
        <p className="inline-flex items-center gap-2 rounded-full border border-pink-line bg-pink-soft px-3.5 py-1.5 text-xs font-semibold text-pink">
          <Smartphone size={15} /> {t("ussd.badge")}
        </p>
        <h1 className="mt-6 max-w-3xl text-3xl font-semibold leading-tight tracking-tight md:text-5xl">
          {t("ussd.title")}
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted">{t("ussd.intro")}</p>

        <section aria-label={t("ussd.howTitle")} className="mt-12">
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">{t("ussd.howTitle")}</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {steps.map(([title, body], index) => (
              <article key={title} className="rounded-[var(--radius-card)] border border-line bg-paper p-6 shadow-sm">
                <p className="grid h-9 w-9 place-items-center rounded-full bg-pink-soft text-sm font-semibold text-pink">
                  {index + 1}
                </p>
                <h3 className="mt-4 text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section aria-label={t("ussd.statusTitle")} className="mt-14">
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">{t("ussd.statusTitle")}</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">{t("ussd.statusIntro")}</p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {channels.map(({ key, icon: Icon, title, body, configured }) => (
              <article key={key} className="flex h-full flex-col rounded-[var(--radius-card)] border border-line bg-paper p-6 shadow-sm">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-pink-soft text-pink">
                  <Icon size={20} />
                </span>
                <h3 className="mt-4 text-lg font-semibold">{title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{body}</p>
                <div className="mt-5">
                  {configured === undefined ? (
                    <span className="text-xs text-muted">{t("common.loading")}</span>
                  ) : (
                    <StatusPill configured={configured} />
                  )}
                </div>
              </article>
            ))}
          </div>
          {status?.ussd.configured && status.ussd.shortCode && SAFE_SHORT_CODE.test(status.ussd.shortCode) && (
            <p className="mt-6 rounded-[var(--radius-card)] border border-pink-line bg-pink-soft p-5 text-center text-lg font-semibold text-pink">
              {status.ussd.shortCode}
            </p>
          )}
          {(!status || !status.ussd.configured) && (
            <p className="mt-6 flex items-start gap-2 rounded-[var(--radius-card)] border border-line bg-soft p-5 text-sm leading-relaxed text-muted">
              <CircleAlert size={17} className="mt-0.5 shrink-0 text-pink" />
              {t("ussd.noCode")}
            </p>
          )}
        </section>

        <section aria-label={t("ussd.simulatorTitle")} className="mt-14">
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">{t("ussd.simulatorTitle")}</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">{t("ussd.simulatorText")}</p>
          <div className="mt-6">
            <Simulator />
          </div>
        </section>

        <section aria-label={t("ussd.privacyTitle")} className="mt-14 grid gap-6 rounded-[var(--radius-panel)] border border-pink-line bg-pink-soft p-6 md:grid-cols-[auto_1fr] md:p-9">
          <Shield size={26} className="shrink-0 text-pink" />
          <div>
            <h2 className="text-xl font-semibold">{t("ussd.privacyTitle")}</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink">{t("ussd.privacyText")}</p>
            <a href="/report" className="brand-fill mt-6 inline-flex min-h-11 items-center rounded-full px-6 py-2.5 text-sm font-semibold text-white">
              {t("ussd.askHelp")}
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}
