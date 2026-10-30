import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Simulator } from "@/components/simulator";
import { LogoMarquee } from "@/components/logo-marquee";
import {
  Check,
  Menu,
  X,
  ChevronDown,
  Shield,
  Smartphone,
  MessageCircle,
  HeartPulse,
  Lock,
  Users,
} from "lucide-react";

export const Route = createFileRoute("/")({ component: Home });

const nav = [
  { href: "#top", label: "Home" },
  { href: "#how", label: "How it works" },
  { href: "#features", label: "What it covers" },
  { href: "#safety", label: "Safety" },
  { href: "#faq", label: "FAQs" },
];

const faqs = [
  {
    q: "Who can use SalamaLine?",
    a: "Girls and young people first. Parents, teachers and neighbours can raise an anonymous concern. Trained responders and partner organisations use it to act and to see aggregated trends.",
  },
  {
    q: "Does she need a smartphone or data?",
    a: "No. USSD and SMS work on any basic phone with no internet. WhatsApp is there when she has data. Every service has a text-only path.",
  },
  {
    q: "Is her name stored?",
    a: "No names, ages, message text or raw phone numbers are stored. Numbers are hashed, or encrypted only with consent for an open help request, and wiped when the case closes.",
  },
  {
    q: "Will it call the police or her family?",
    a: "Never by itself. A trained human is always behind a request for help. She gives consent before anyone is contacted. Declining never blocks information or the helpline.",
  },
  {
    q: "Does it give medical or legal advice?",
    a: "No. SalamaLine only shares content professionals have approved — source, reviewer and review date are recorded. It does not invent answers.",
  },
  {
    q: "Where does the pilot run?",
    a: "Selected communities and schools in Mbeya Region, Tanzania, with a smaller partner-led FGM module in a higher-prevalence district. Built by signiAI at Mbeya University of Science and Technology.",
  },
];

function Home() {
  const [open, setOpen] = useState(false);
  const [faq, setFaq] = useState<number | null>(0);
  const [active, setActive] = useState("#top");

  useEffect(() => {
    const onScroll = () => {
      let current = "#top";
      for (const l of nav) {
        if (l.href === "#top") continue;
        const el = document.querySelector(l.href);
        if (el && el.getBoundingClientRect().top <= 140) current = l.href;
      }
      setActive(current);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="fixed inset-x-0 top-3 z-40 px-3 md:top-4 md:px-5">
        <div className="mx-auto max-w-6xl">
          <div className="flex h-14 items-center justify-between rounded-full border border-paper/15 bg-invert/45 pl-5 pr-2 text-paper shadow-lg backdrop-blur-xl md:h-16 md:pl-7">
            <a href="#top" className="brand-text text-lg font-semibold tracking-tight">
              salamaline
            </a>
            <nav className="hidden items-center gap-1 md:flex">
              {nav.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  className={
                    "rounded-full px-4 py-2 text-sm transition-colors " +
                    (active === l.href
                      ? "bg-paper font-medium text-ink"
                      : "text-paper/80 hover:text-paper")
                  }
                >
                  {l.label}
                </a>
              ))}
            </nav>
            <div className="flex items-center gap-2">
              <a
                href="#partner"
                className="hidden rounded-full border border-paper/30 px-4 py-2 text-sm text-paper hover:bg-paper/10 lg:inline"
              >
                Partner
              </a>
              <a
                href="#partner"
                className="hidden rounded-full bg-pink px-4 py-2 text-sm font-medium text-paper sm:inline"
              >
                Get involved
              </a>
              <button
                className="grid h-10 w-10 place-items-center rounded-full bg-paper/15 ring-1 ring-paper/25 md:hidden"
                aria-label={open ? "Close menu" : "Open menu"}
                onClick={() => setOpen((v) => !v)}
              >
                {open ? <X size={18} /> : <Menu size={18} />}
              </button>
            </div>
          </div>
          {open && (
            <div className="mt-2 rounded-3xl border border-paper/15 bg-invert/80 px-5 py-3 text-paper shadow-lg backdrop-blur-xl md:hidden">
              {nav.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="block py-3 text-sm"
                >
                  {l.label}
                </a>
              ))}
              <a
                href="#partner"
                onClick={() => setOpen(false)}
                className="mb-2 mt-2 block rounded-full bg-pink px-4 py-3 text-center text-sm font-medium text-paper"
              >
                Get involved
              </a>
            </div>
          )}
        </div>
      </header>

      <main id="top">
        <section className="relative isolate min-h-svh w-full overflow-hidden bg-invert text-paper">
          <video
            src="/hero.mp4"
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            poster="/hero.jpg"
            aria-hidden
            className="absolute inset-0 -z-10 h-full w-full object-cover object-[center_22%]"
          />
          <div className="absolute inset-0 -z-10 bg-gradient-to-t from-invert/90 via-invert/40 to-invert/10 md:bg-gradient-to-r md:from-invert/85 md:via-invert/40 md:to-transparent" />
          <div className="mx-auto flex min-h-svh max-w-6xl flex-col justify-end px-4 pb-40 pt-28 md:justify-center md:px-6 md:pb-40 md:pt-16">
            <div className="max-w-xl">
              <p className="mb-4 flex items-center gap-2 text-sm text-paper/90">
                <Check size={16} /> Free · confidential · any phone
              </p>
              <h1 className="text-4xl font-semibold leading-[1.05] tracking-tight md:text-6xl">
                Your new safety line
              </h1>
              <p className="mt-4 max-w-md text-base text-paper/80 md:text-lg">
                Girls get accurate information, nearby verified services, and a trained person — from a basic phone. Free.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a href="#how" className="rounded-full bg-paper px-5 py-3 text-sm font-medium text-ink">
                  See how it works
                </a>
                <a
                  href="#features"
                  className="rounded-full bg-paper/15 px-5 py-3 text-sm font-medium text-paper ring-1 ring-paper/30 backdrop-blur"
                >
                  What it covers
                </a>
              </div>
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 pb-6 md:pb-8">
            <p className="mb-3 text-center text-[11px] font-medium uppercase tracking-[0.2em] text-paper/60">
              Organisations working to keep girls and women safe in Tanzania
            </p>
            <LogoMarquee />
          </div>
        </section>

        <section aria-label="Who built SalamaLine" className="mx-auto max-w-6xl px-4 py-14 text-center md:px-6 md:py-20">
          <p className="inline-flex items-center justify-center gap-2 text-sm font-medium text-ink md:text-base">
            <Shield size={18} className="text-pink" />
            Built in Mbeya, Tanzania, by signiAI at Mbeya University of Science and Technology
          </p>
        </section>

        <section className="mx-auto grid max-w-6xl grid-cols-2 gap-px overflow-hidden border-b border-line px-4 py-10 md:grid-cols-4 md:px-6">
          {[
            ["Any phone", "USSD, SMS and WhatsApp"],
            ["No names stored", "Consent before any contact"],
            ["Human in the loop", "A trained responder, always"],
            ["Swahili first", "English from day one"],
          ].map(([k, v]) => (
            <div key={k} className="px-2 py-4 md:px-6">
              <p className="text-lg font-semibold tracking-tight">{k}</p>
              <p className="mt-1 text-sm text-muted">{v}</p>
            </div>
          ))}
        </section>

        <section id="how" className="scroll-mt-24 mx-auto max-w-6xl px-4 py-20 md:px-6">
          <p className="text-sm font-medium text-pink">How it works</p>
          <h2 className="mt-2 max-w-xl text-3xl font-semibold tracking-tight md:text-5xl">
            It starts with a short code, then a real person.
          </h2>
          <div className="mt-12 grid gap-4 md:grid-cols-4">
            {[
              ["1", "She reaches out", "Dial a short code, text a command, or message on WhatsApp. No app. No data required."],
              ["2", "Clear information", "Short answers on child marriage, FGM, rights and health — only from an approved content bank."],
              ["3", "Nearby services", "Verified clinics, legal aid and social welfare offices by district, sent by SMS."],
              ["4", "Help, with consent", "A trained responder is alerted. If nobody replies, the alert repeats, then escalates."],
            ].map(([n, t, d]) => (
              <article key={n} className="rounded-3xl bg-wash p-6">
                <p className="text-sm font-medium text-pink">{n}</p>
                <h3 className="mt-6 text-xl font-semibold tracking-tight">{t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{d}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="features" className="scroll-mt-24 bg-soft">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-20 md:grid-cols-2 md:px-6">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight md:text-5xl">
                Reach girls that apps miss
              </h2>
              <p className="mt-4 max-w-md text-muted">
                A 26% mobile internet gender gap leaves 230 million women offline. SalamaLine is USSD and SMS first, with a text-only path for every service.
              </p>
              <ul className="mt-8 space-y-3 text-sm">
                {[
                  ["SALAMA", "open the menu"],
                  ["KLINIKI + district", "find a clinic"],
                  ["MSAADA + district", "ask for help"],
                  ["RIPOTI + district", "raise an anonymous concern"],
                  ["FUTA", "delete my data"],
                ].map(([c, d]) => (
                  <li key={c} className="flex items-baseline gap-3">
                    <span className="rounded-full bg-pink px-3 py-1 font-mono text-xs text-paper">{c}</span>
                    <span className="text-muted">{d}</span>
                  </li>
                ))}
              </ul>
            </div>
            <Simulator />
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-20 md:px-6">
          <h2 className="max-w-2xl text-3xl font-semibold tracking-tight md:text-5xl">
            Information, referral and a person — in one flow
          </h2>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {[
              [Shield, "Child marriage", "Harms, rights, a consent-based help request, and anonymous reports from a teacher or neighbour."],
              [HeartPulse, "FGM care", "Urgent request if she fears cutting. Care and counselling if she was already cut — with no alert unless she asks."],
              [MessageCircle, "Digital safety", "Image abuse, sextortion and harassment: how to report, in plain language."],
              [Users, "Community", "Champions get risk-season notices before school holidays. Partners see only aggregated trends."],
              [Lock, "Privacy controls", "Quick exit, delete-my-data, neutral wording so a phone screen reveals nothing."],
              [Smartphone, "Wellbeing", "A gentle check-in. Tips if she is okay. A counsellor if she agrees. Nothing she answers is stored."],
            ].map(([Icon, t, d]) => (
              <article key={t as string} className="rounded-3xl border border-line p-6">
                <Icon size={20} className="text-pink" />
                <h3 className="mt-8 text-lg font-semibold">{t as string}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{d as string}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="safety" className="scroll-mt-24 bg-invert text-paper">
          <div className="mx-auto max-w-6xl px-4 py-20 md:px-6">
            <p className="text-sm font-medium text-orange">Safety, privacy and ethics</p>
            <h2 className="mt-2 max-w-xl text-3xl font-semibold tracking-tight md:text-5xl">
              Designed so she can trust it
            </h2>
            <div className="mt-12 grid gap-8 md:grid-cols-2">
              {[
                ["Minimal data", "No names, ages or message text. A number is stored only as a one-way hash, or encrypted with consent, and wiped at closure."],
                ["Consent first", "A responder receives a number only when she agrees. Saying no never blocks the helpline or services."],
                ["Human in the loop", "The system routes. It does not decide, diagnose or report on its own. It never contacts police or family by itself."],
                ["Approved content only", "No free-form AI answers. Every answer has a source, a reviewer and a review date."],
                ["Honest about limits", "Anonymous reports are not stored with a number, but a mobile operator may still see traffic. Users are told this plainly."],
                ["Safeguarded responders", "Vetted, trained, and bound by confidentiality and child-protection codes. Independent review before any pilot."],
              ].map(([t, d]) => (
                <div key={t} className="border-t border-paper/15 pt-5">
                  <h3 className="text-lg font-semibold">{t}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-paper/70">{d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-20 md:px-6">
          <p className="text-sm text-muted">What using it feels like</p>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              ["Amina, 15", "She hears her family is planning her marriage. She dials the short code, chooses help, picks her district and agrees to be contacted. A responder helps her reach social welfare."],
              ["A teacher", "She texts RIPOTI and the district. A responder is alerted with no information about who sent it, then verifies the concern through the community protocol."],
              ["A responder", "She replies ACK with the case code, confirms it is safe to talk, and does not contact the family without a safety plan. CLOSE wipes the girl’s details."],
            ].map(([t, d]) => (
              <article key={t} className="rounded-3xl bg-wash p-6">
                <h3 className="text-lg font-semibold">{t}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted">{d}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-y border-line">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 md:grid-cols-3 md:px-6">
            {[
              ["1 in 3", "girls married before 18"],
              ["6 in 7", "new adolescent HIV infections are girls"],
              ["230M", "women left offline by the mobile gender gap"],
            ].map(([n, l]) => (
              <div key={n}>
                <p className="brand-text text-5xl font-semibold tracking-tight">{n}</p>
                <p className="mt-2 text-sm text-muted">{l}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="partner" className="scroll-mt-24 mx-auto max-w-6xl px-4 py-20 md:px-6">
          <div className="grid items-start gap-10 rounded-[28px] bg-wash p-6 md:grid-cols-2 md:p-12">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight md:text-5xl">Free for every girl</h2>
              <p className="mt-4 text-muted">
                Built by signiAI at Mbeya University of Science and Technology, led by Jofrey Nasson. The platform handles USSD, SMS and WhatsApp, referrals, consent-based help requests, FGM, wellbeing, escalation and a partner dashboard. Content and service listings are placeholders until professionals and partners approve them.
              </p>
              <a href="mailto:hello@salamaline.org" className="brand-fill mt-8 inline-flex rounded-full px-5 py-3 text-sm font-medium text-paper">
                Become a partner
              </a>
            </div>
            <ul className="space-y-3 text-sm">
              {[
                "USSD, SMS and WhatsApp",
                "Approved information only",
                "District service directory",
                "Consent-based help requests",
                "Anonymous community reports",
                "Open source, ready to adapt",
                "12-month pilot in Mbeya Region",
                "Independent safeguarding review",
              ].map((item) => (
                <li key={item} className="flex items-center gap-3 border-b border-line pb-3">
                  <Check size={16} className="text-pink" /> {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="faq" className="scroll-mt-24 mx-auto max-w-3xl px-4 pb-20 md:px-6">
          <h2 className="text-3xl font-semibold tracking-tight">Questions</h2>
          <div className="mt-6 divide-y divide-line border-y border-line">
            {faqs.map((item, i) => {
              const on = faq === i;
              return (
                <div key={item.q}>
                  <button
                    className="flex w-full items-center justify-between gap-4 py-5 text-left text-base font-medium"
                    aria-expanded={on}
                    onClick={() => setFaq(on ? null : i)}
                  >
                    {item.q}
                    <ChevronDown size={18} className={on ? "rotate-180" : ""} />
                  </button>
                  {on && <p className="pb-5 text-sm leading-relaxed text-muted">{item.a}</p>}
                </div>
              );
            })}
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 text-sm text-muted md:flex-row md:items-center md:justify-between md:px-6">
          <p className="brand-text font-semibold">salamaline</p>
          <p>Confidential line for girls’ safety and wellbeing · signiAI, MUST, Tanzania</p>
          <div className="flex gap-5">
            <a href="#safety" className="hover:text-ink">Privacy</a>
            <a href="#faq" className="hover:text-ink">FAQs</a>
            <a href="#partner" className="hover:text-ink">Partners</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
