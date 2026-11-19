import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ExternalLink, HeartHandshake, ShieldCheck } from "lucide-react";
import { PublicHeader } from "@/components/public-header.tsx";
import { en } from "@/i18n/en.ts";
import { useI18n, usePageMeta } from "@/i18n/provider.tsx";
import type { TranslationKey } from "@/i18n/types.ts";

export const Route = createFileRoute("/organizations")({
  head: () => ({
    meta: [
      { title: en.meta.organizationsTitle },
      { name: "description", content: en.meta.organizationsDescription },
    ],
  }),
  component: OrganizationsPage,
});

/** Real partner data recovered from the original implementation and assets. */
const PARTNERS: readonly {
  name: string;
  file: string;
  url: string;
  descriptionKey: TranslationKey;
}[] = [
  {
    name: "signiAI",
    file: "signiai",
    url: "",
    descriptionKey: "organizations.partners.signiai",
  },
  {
    name: "Tanzania Women Lawyers Association",
    file: "tawla",
    url: "https://www.tawla.or.tz/",
    descriptionKey: "organizations.partners.tawla",
  },
  {
    name: "Tanzania Media Women's Association",
    file: "tamwa",
    url: "https://tamwa.org/",
    descriptionKey: "organizations.partners.tamwa",
  },
  {
    name: "Women's Legal Aid Centre",
    file: "wlac",
    url: "https://wlac.or.tz/",
    descriptionKey: "organizations.partners.wlac",
  },
  {
    name: "Msichana Initiative",
    file: "msichana",
    url: "https://msichana.or.tz/",
    descriptionKey: "organizations.partners.msichana",
  },
  {
    name: "Kivulini Women's Rights Organization",
    file: "kivulini",
    url: "https://kivulini.or.tz/",
    descriptionKey: "organizations.partners.kivulini",
  },
];

function PartnerCard({
  name,
  file,
  url,
  descriptionKey,
}: (typeof PARTNERS)[number]) {
  const { t } = useI18n();
  const [logoFailed, setLogoFailed] = useState(false);

  return (
    <article className="flex h-full flex-col rounded-[var(--radius-card)] border border-line bg-paper p-6 shadow-sm">
      <div className="flex h-16 items-center">
        {logoFailed ? (
          <span className="brand-text text-lg font-semibold">{name}</span>
        ) : (
          <img
            src={`/partners/${file}.png`}
            alt={t("organizations.logoAlt", { name })}
            loading="lazy"
            onError={() => setLogoFailed(true)}
            className="max-h-14 max-w-[11rem] object-contain"
          />
        )}
      </div>
      <h2 className="mt-5 text-lg font-semibold leading-snug tracking-tight">{name}</h2>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{t(descriptionKey)}</p>
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-pink hover:underline"
        >
          {t("organizations.learnMore")} <ExternalLink size={14} aria-hidden="true" />
        </a>
      )}
    </article>
  );
}

function OrganizationsPage() {
  const { t } = useI18n();
  usePageMeta("organizations");

  return (
    <div className="min-h-screen bg-paper text-ink">
      <PublicHeader current="/organizations" />
      <main className="mx-auto max-w-6xl px-4 pb-20 pt-32 md:px-6 md:pt-40">
        <p className="inline-flex items-center gap-2 rounded-full border border-pink-line bg-pink-soft px-3.5 py-1.5 text-xs font-semibold text-pink">
          <HeartHandshake size={15} /> {t("organizations.badge")}
        </p>
        <h1 className="mt-6 max-w-3xl text-3xl font-semibold leading-tight tracking-tight md:text-5xl">
          {t("organizations.title")}
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted">{t("organizations.intro")}</p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PARTNERS.map((partner) => (
            <PartnerCard key={partner.file} {...partner} />
          ))}
        </div>

        <p className="mt-10 flex items-start gap-2 rounded-[var(--radius-card)] border border-line bg-soft p-5 text-sm leading-relaxed text-muted">
          <ShieldCheck size={18} className="mt-0.5 shrink-0 text-pink" />
          {t("organizations.partnerNote")}
        </p>
      </main>
    </div>
  );
}
