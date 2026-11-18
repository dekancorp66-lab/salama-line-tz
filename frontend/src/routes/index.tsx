import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  HeartHandshake,
  Lock,
  MapPin,
  Search,
  Shield,
} from "lucide-react";
import { LogoMarquee } from "@/components/logo-marquee.tsx";
import { PublicHeader } from "@/components/public-header.tsx";
import { en } from "@/i18n/en.ts";
import { useI18n, usePageMeta } from "@/i18n/provider.tsx";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: en.meta.homeTitle },
      { name: "description", content: en.meta.homeDescription },
    ],
  }),
  component: Home,
});

const HERO_IMAGES = [
  "/image/home%20/Maasai%20women.jpeg",
  "/image/home%20/_%20%281%29.jpeg",
  "/image/home%20/_%20%282%29.jpeg",
  "/image/home%20/_.jpeg",
  "/image/home%20/black.jpg",
  "/image/home%20/so%20fearfully%20%26%20wonderfully%20made.jpeg",
  "/image/home%20/%F0%9F%92%99%F0%9F%92%99%F0%9F%92%99.jpeg",
] as const;

function HeroSlideshow() {
  const [index, setIndex] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    HERO_IMAGES.forEach((src) => {
      const img = new window.Image();
      img.decoding = "async";
      img.src = src;
    });
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduceMotion(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % HERO_IMAGES.length);
    }, 3000);
    return () => window.clearInterval(id);
  }, [reduceMotion]);

  return (
    <div className="absolute inset-0 -z-20 overflow-hidden" aria-hidden="true">
      {HERO_IMAGES.map((src, i) => (
        <img
          key={src}
          src={src}
          alt=""
          className={`absolute inset-0 h-full w-full object-cover object-[center_30%] transition-opacity duration-1000 ease-in-out motion-reduce:duration-0 ${
            i === (reduceMotion ? 0 : index) ? "opacity-100" : "opacity-0"
          }`}
          loading={i === 0 ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={i === 0 ? "high" : "low"}
          draggable={false}
        />
      ))}
    </div>
  );
}

function Home() {
  const { t, dictionary } = useI18n();
  usePageMeta("home");
  const [faq, setFaq] = useState<number | null>(0);

  const faqs = [
    { q: dictionary.home.faq1Q, a: dictionary.home.faq1A },
    { q: dictionary.home.faq2Q, a: dictionary.home.faq2A },
    { q: dictionary.home.faq3Q, a: dictionary.home.faq3A },
    { q: dictionary.home.faq4Q, a: dictionary.home.faq4A },
    { q: dictionary.home.faq5Q, a: dictionary.home.faq5A },
  ];

  const offers = [
    {
      icon: BookOpen,
      title: dictionary.home.learnTitle,
      text: dictionary.home.learnText,
      href: "/ai",
      link: t("common.aiAssistance"),
    },
    {
      icon: MapPin,
      title: dictionary.home.nearbyTitle,
      text: dictionary.home.nearbyText,
      href: "/services",
      link: t("common.verifiedServices"),
    },
    {
      icon: HeartHandshake,
      title: dictionary.home.requestTitle,
      text: dictionary.home.requestText,
      href: "/report",
      link: t("common.getHelp"),
    },
  ];

  const steps = [
    ["1", dictionary.home.step1Title, dictionary.home.step1Text],
    ["2", dictionary.home.step2Title, dictionary.home.step2Text],
    ["3", dictionary.home.step3Title, dictionary.home.step3Text],
  ] as const;

  const safety = [
    t("home.safety1"),
    t("home.safety2"),
    t("home.safety3"),
    t("home.safety4"),
  ];

  return (
    <div className="min-h-screen bg-paper text-ink">
      <PublicHeader current="/" />

      <main id="top">
        <section className="relative isolate flex min-h-[92svh] w-full flex-col justify-end overflow-hidden bg-neutral-950 px-4 pb-14 pt-36 text-white md:px-6 md:pb-16 md:pt-48">
          <HeroSlideshow />
          <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/90 via-black/55 to-black/25 md:bg-gradient-to-r md:from-black/85 md:via-black/40 md:to-transparent" />
          <div className="relative mx-auto w-full max-w-6xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-black/25 px-3.5 py-1.5 text-xs font-semibold text-white backdrop-blur-sm md:text-sm">
              <Check size={15} /> {t("home.badge")}
            </p>
            <h1 className="mt-6 max-w-3xl text-4xl font-semibold leading-tight tracking-tight text-white md:text-6xl">
              {t("home.heroTitle")}
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-white/90 md:text-lg">
              {t("home.heroDescription")}
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <a
                href="/report"
                className="brand-fill inline-flex min-h-12 items-center gap-2 rounded-full px-7 py-3 text-sm font-semibold text-white"
              >
                {t("home.heroPrimary")} <ArrowRight size={17} />
              </a>
              <a
                href="/track"
                className="inline-flex min-h-12 items-center rounded-full border border-white/45 bg-black/20 px-7 py-3 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/15"
              >
                {t("home.heroSecondary")}
              </a>
            </div>
            <p className="mt-6 flex items-start gap-2 text-sm text-white/85">
              <Shield size={17} className="mt-0.5 shrink-0 text-pink-300" />
              {t("home.heroAssurance")}
            </p>
          </div>
          <div className="relative mx-auto mt-14 w-full max-w-6xl">
            <p className="mb-3 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-white/75 sm:text-[11px]">
              {t("home.organizationsCaption")}
            </p>
            <LogoMarquee />
            <div className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-center text-xs font-semibold">
              <a href="/organizations" className="text-white underline-offset-4 hover:underline">
                {t("home.organizationsLink")}
              </a>
              <a href="/ussd" className="text-white underline-offset-4 hover:underline">
                {t("home.ussdLink")}
              </a>
            </div>
          </div>
        </section>

        <section
          aria-label={t("home.offersLabel")}
          className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-24"
        >
          <h2 className="text-2xl font-semibold tracking-tight md:text-4xl">
            {t("home.offersTitle")}
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted md:text-base">
            {t("home.offersIntro")}
          </p>
          <div className="mt-9 grid gap-4 md:grid-cols-3">
            {offers.map(({ icon: Icon, title, text, href, link }) => (
              <article
                key={href}
                className="rounded-[var(--radius-card)] border border-line bg-paper p-6 shadow-sm"
              >
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-pink-soft text-pink">
                  <Icon size={20} />
                </span>
                <h3 className="mt-5 text-xl font-semibold tracking-tight">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{text}</p>
                <a
                  href={href}
                  className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-pink hover:underline"
                >
                  {link} <ArrowRight size={15} />
                </a>
              </article>
            ))}
          </div>
        </section>

        <section className="border-y border-line bg-soft">
          <div className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-24">
            <h2 className="text-2xl font-semibold tracking-tight md:text-4xl">
              {t("home.howTitle")}
            </h2>
            <div className="mt-9 grid gap-6 md:grid-cols-3">
              {steps.map(([n, title, text]) => (
                <div key={n}>
                  <p className="grid h-9 w-9 place-items-center rounded-full bg-pink-soft text-sm font-semibold text-pink">
                    {n}
                  </p>
                  <h3 className="mt-4 text-lg font-semibold">{title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{text}</p>
                </div>
              ))}
            </div>
            <a
              href="/track"
              className="mt-9 inline-flex min-h-11 items-center gap-2 rounded-full border border-pink-line bg-paper px-6 py-2.5 text-sm font-semibold text-pink transition hover:bg-pink-soft"
            >
              <Search size={16} /> {t("home.trackPrompt")}
            </a>
          </div>
        </section>

        <section id="safety" className="scroll-mt-24 px-4 py-16 md:py-24">
          <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-[1fr_1.2fr] md:px-6">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold text-pink">
                <Lock size={17} /> {t("home.safetyTitle")}
              </p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight md:text-4xl">
                {t("home.safetyHeading")}
              </h2>
            </div>
            <div className="rounded-[var(--radius-card)] border border-pink-line bg-pink-soft p-6 text-sm leading-relaxed text-ink md:p-8">
              <ul className="space-y-3">
                {safety.map((line) => (
                  <li key={line} className="flex gap-3">
                    <Check size={16} className="mt-0.5 shrink-0 text-pink" />{" "}
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section id="faq" className="scroll-mt-24 mx-auto max-w-3xl px-4 pb-20 md:px-6">
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
            {t("home.faqTitle")}
          </h2>
          <div className="mt-6 divide-y divide-line border-y border-line">
            {faqs.map((item, i) => {
              const on = faq === i;
              return (
                <div key={i}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-4 py-5 text-left text-base font-medium transition-colors hover:text-pink"
                    aria-expanded={on}
                    onClick={() => setFaq(on ? null : i)}
                  >
                    {item.q}
                    <ChevronDown
                      size={18}
                      className={`shrink-0 transition-transform ${on ? "rotate-180 text-pink" : "text-muted"}`}
                    />
                  </button>
                  {on && <p className="pb-5 text-sm leading-relaxed text-muted">{item.a}</p>}
                </div>
              );
            })}
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-10 text-sm text-muted md:flex-row md:items-center md:justify-between md:px-6">
          <p className="brand-text font-semibold">{t("common.salamaLine")}</p>
          <p>{t("home.footerCredit")}</p>
          <div className="flex flex-wrap gap-5">
            <a href="/report" className="hover:text-ink">
              {t("common.getHelp")}
            </a>
            <a href="/ai" className="hover:text-ink">
              {t("common.aiAssistance")}
            </a>
            <a href="/services" className="hover:text-ink">
              {t("common.services")}
            </a>
            <a href="/organizations" className="hover:text-ink">
              {t("common.organizations")}
            </a>
            <a href="/ussd" className="hover:text-ink">
              {t("common.ussd")}
            </a>
            <a href="/track" className="hover:text-ink">
              {t("common.track")}
            </a>
            <a href="#safety" className="hover:text-ink">
              {t("home.footerPrivacy")}
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
