import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { ArrowLeft, Check, CircleAlert, Heart, Lock, Send, Shield, Users } from "lucide-react";
import { ApiError } from "@/lib/api-client";
import { submitHelpRequest, type HelpRequestReceipt } from "@/lib/backend-api";

export const Route = createFileRoute("/help")({
  head: () => ({
    meta: [
      { title: "Ask for help · SalamaLine" },
      { name: "robots", content: "noindex" },
      { name: "description", content: "Privately ask SalamaLine for help. A trained responder reviews every request." },
    ],
  }),
  component: GetHelp,
});

type Lang = "sw" | "en";

const topics = [
  { value: "CHILD_MARRIAGE", sw: "Ndoa ya mtoto", en: "Child marriage" },
  { value: "FGM", sw: "Kuukatwa", en: "FGM" },
  { value: "DIGITAL_SAFETY", sw: "Usalama mtandaoni", en: "Digital safety" },
  { value: "WELLBEING", sw: "Afya ya akili", en: "Wellbeing" },
  { value: "OTHER", sw: "Kitu kingine", en: "Something else" },
] as const;

const districts = ["MBEYA", "KYELA", "MWANZA", "RUNGWE", "BUSOKELO", "MAKETE", "ISANGA", "MPANGA"];

const copy = {
  sw: {
    back: "Rudi SalamaLine",
    title: "Omba msaada",
    intro: "Tuma ujumbe mfupi. Mtu aliyefunzwa atakagua ombi lako — hakuna ujumbe otomatiki kwa polisi au familia.",
    form: "Ombi lako",
    topic: "Unahitaji msaada gani?",
    topicHint: "Chagua kategoria inayokaribia sana.",
    district: "Wilaya yako",
    districtOther: "Wilaya nyingine",
    districtHint: "Huongezwi kwenye ujumbe unaotumwa kwa mtu yeyote.",
    concern: "Muhtasari mfupi (si lazima)",
    concernHint: "Usiandike jina, namba ya simu, anwani au majina ya watu. Taarifa zinazotambulisha zitafutwa kabla ya kuhifadhiwa.",
    concernPlaceholder: "Kwa mfano: Niko salama kwa sasa lakini naogopa kwamba…",
    anonymous: "Ripoti bila kujitambulisha",
    anonymousHint: "Hakutakuwa na namba wala taarifa za mawasiliano zilizohifadhiwa.",
    consent: "Nakubali mtu aliyefunzwa aniwasiliane kuhusu ombi hili",
    consentHint: "Kukataa hakuzuii msaada wala taarifa. Kibali hiki ni maalum, kina toleo na kinaweza kutenguliwa.",
    contact: "Namba au barua pepe (kwa mawasiliano tu)",
    contactHint: "Inahifadhiwa kama alama (hash) pekee; haitumwi kutuma ujumbe otomatiki.",
    priority: "Kipaumbele",
    normal: "Kawaida",
    urgent: "Haraka",
    urgencyNote: "Haraka inamaanisha mtu atakagua mapema. System haiwasiliani na huduma za dharura yenyewe.",
    submit: "Tuma ombi",
    sending: "Inatuma…",
    privacyTitle: "Faragha yako",
    privacy1: "Hakuna majina au maandishi yako ghafi yanayohifadhiwa.",
    privacy2: "Mtu yeyote anayekusaidia ni mwanadamu aliyefunzwa, si robot.",
    privacy3: "Hakuna mawasiliano ya moja kwa moja na familia, polisi au mamlaka.",
    privacy4: "Kibali ni chaguo, kimeainishwa na kinaweza kutenguliwa wakati wowote.",
    safetyTitle: "Ikiwa uko kwenye hatari ya sasa",
    safety: "Tafuta sehemu salama ikiwezekana na wasiliana na huduma za dharura za eneo lako au mtu mzima unayemwamini. SalamaLine haiwezi kuziwasiliana kwa niaba yako.",
    received: "Ombi limepokelewa",
    code: "Namba ya ombi lako",
    codeHint: "Hifadhi namba hii. Mtu aliyefunzwa ataitumia kukusaidia bila kufichua utambulisho wako.",
    saved: "Ombi lako limehifadhiwa kwa njia ndogo tu. Hakuna mtu aliyejaribiwa kuwasiliana bila kibali chako.",
    another: "Tuma ombi jingine",
    backHome: "Rudi nyumbani",
    errors: {
      topic: "Chagua aina ya msaada.",
      district: "Andika wilaya halali (herufi 2–20).",
      contact: "Andika namba au barua pepe unayokubali kutumiwa.",
      both: "Huwezi kutuma ripoti isiyojitambulisha pamoja na maelezo ya mawasiliano.",
    },
  },
  en: {
    back: "Back to SalamaLine",
    title: "Ask for help",
    intro: "Send a short request. A trained person reviews it — nothing is sent automatically to police or family.",
    form: "Your request",
    topic: "What kind of help do you need?",
    topicHint: "Choose the closest category.",
    district: "Your district",
    districtOther: "Other district",
    districtHint: "This is never shared in a message to anyone.",
    concern: "Short summary (optional)",
    concernHint: "Do not include your name, phone number, address or anyone's identifying details. Identifying details are removed before storage.",
    concernPlaceholder: "For example: I am safe right now but I am worried that…",
    anonymous: "Report without identifying myself",
    anonymousHint: "No phone number or contact details will be stored.",
    consent: "I agree that a trained responder may contact me about this request",
    consentHint: "Declining never blocks help or information. This consent is specific, versioned and can be withdrawn.",
    contact: "Phone or email (for contact only)",
    contactHint: "Stored only as a one-way hash; no automated messages are sent.",
    priority: "Priority",
    normal: "Normal",
    urgent: "Urgent",
    urgencyNote: "Urgent means a person reviews it sooner. The system does not contact emergency services itself.",
    submit: "Send request",
    sending: "Sending…",
    privacyTitle: "Your privacy",
    privacy1: "No names or raw message text are stored.",
    privacy2: "A trained human, not a robot, is behind every response.",
    privacy3: "No automatic contact with family, police or authorities.",
    privacy4: "Consent is optional, specific, versioned and revocable.",
    safetyTitle: "If you are in immediate danger",
    safety: "Move somewhere safer if you can, and contact local emergency services or a trusted adult. SalamaLine cannot contact them for you.",
    received: "Request received",
    code: "Your case code",
    codeHint: "Keep this code. A trained responder uses it to help you without exposing your identity.",
    saved: "Only the minimum details were saved. Nobody is contacted unless you explicitly agree.",
    another: "Send another request",
    backHome: "Back to home",
    errors: {
      topic: "Choose the kind of help you need.",
      district: "Enter a valid district (2–20 characters).",
      contact: "Enter a phone number or email you agree to be used.",
      both: "An anonymous report cannot include contact details.",
    },
  },
} as const;

function GetHelp() {
  const [lang, setLang] = useState<Lang>("sw");
  const [topic, setTopic] = useState<string>("");
  const [district, setDistrict] = useState("MBEYA");
  const [otherDistrict, setOtherDistrict] = useState("");
  const [concern, setConcern] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [consent, setConsent] = useState(false);
  const [contact, setContact] = useState("");
  const [priority, setPriority] = useState<"NORMAL" | "URGENT">("NORMAL");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<HelpRequestReceipt | null>(null);
  const t = copy[lang];

  function resetForm() {
    setTopic(""); setDistrict("MBEYA"); setOtherDistrict(""); setConcern("");
    setAnonymous(false); setConsent(false); setContact(""); setPriority("NORMAL");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!topic) return setError(t.errors.topic);
    const districtCode = (district === "OTHER" ? otherDistrict : district).trim().toUpperCase();
    if (districtCode.length < 2 || districtCode.length > 20) return setError(t.errors.district);
    if (anonymous && contact.trim()) return setError(t.errors.both);
    if (consent && !anonymous && !contact.trim()) return setError(t.errors.contact);

    setBusy(true);
    try {
      const result = await submitHelpRequest({
        topic,
        districtCode,
        channel: "WEB",
        concernSummary: concern.trim() || undefined,
        anonymousReport: anonymous,
        consentToContact: consent && !anonymous,
        contact: consent && !anonymous ? contact.trim() : undefined,
        priority,
      });
      setReceipt(result);
      resetForm();
    } catch (cause) {
      setError(cause instanceof ApiError || cause instanceof Error ? cause.message : "Could not send your request. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-soft text-ink">
      <header className="sticky top-0 z-20 border-b border-line bg-paper/95 px-4 py-3 backdrop-blur md:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <a href="/" className="flex items-center gap-2 text-sm font-medium text-muted hover:text-ink">
            <ArrowLeft size={17} /> <span className="hidden sm:inline">{t.back}</span><span className="sm:hidden">SalamaLine</span>
          </a>
          <a href="/" className="brand-text text-lg font-semibold tracking-tight md:text-xl">salamaline</a>
          <div className="flex items-center gap-2" aria-label="Language">
            <button type="button" onClick={() => setLang("sw")} aria-pressed={lang === "sw"} className={`min-h-10 rounded-full px-3.5 py-2 text-sm transition ${lang === "sw" ? "bg-pink text-white" : "text-muted hover:bg-pink-soft hover:text-pink"}`}>SW</button>
            <button type="button" onClick={() => setLang("en")} aria-pressed={lang === "en"} className={`min-h-10 rounded-full px-3.5 py-2 text-sm transition ${lang === "en" ? "bg-pink text-white" : "text-muted hover:bg-pink-soft hover:text-pink"}`}>EN</button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 md:grid-cols-[320px_minmax(0,1fr)] md:py-10">
        <aside className="space-y-4">
          <div className="rounded-[var(--radius-panel)] border border-line bg-paper p-5 shadow-sm md:p-6">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-pink-soft text-pink"><Heart size={21} /></span>
            <h1 className="mt-4 text-2xl font-semibold leading-tight md:text-3xl">{t.title}</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted">{t.intro}</p>
          </div>
          <div className="rounded-[var(--radius-card)] border border-line bg-paper p-5 text-sm">
            <p className="mb-3 flex items-center gap-2 font-semibold text-ink"><Shield size={17} className="text-pink" />{t.privacyTitle}</p>
            <ul className="space-y-2.5 text-muted">
              {[t.privacy1, t.privacy2, t.privacy3, t.privacy4].map((line) => (
                <li key={line} className="flex gap-2"><Check size={15} className="mt-0.5 shrink-0 text-pink" /><span>{line}</span></li>
              ))}
            </ul>
          </div>
          <div role="note" className="rounded-[var(--radius-card)] border border-pink-line bg-pink-soft p-5 text-sm leading-relaxed">
            <p className="mb-2 flex items-center gap-2 font-semibold text-pink"><CircleAlert size={17} />{t.safetyTitle}</p>
            <p className="text-ink">{t.safety}</p>
          </div>
          <a href="/ai" className="flex items-center justify-between rounded-[var(--radius-card)] border border-line bg-paper px-5 py-4 text-sm font-medium text-ink transition hover:border-pink-line hover:bg-pink-soft">
            <span>{lang === "sw" ? "Pata taarifa za kuaminika" : "Read trusted information"}</span><span className="text-pink">→</span>
          </a>
        </aside>

        <section aria-label={t.form} className="min-w-0 rounded-[var(--radius-panel)] border border-line bg-paper p-5 shadow-[var(--shadow-soft)] sm:p-7 md:p-9">
          {receipt ? (
            <div className="mx-auto max-w-lg py-4 text-center">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-pink-soft text-pink"><Check size={27} /></span>
              <h2 className="mt-5 text-2xl font-semibold tracking-tight">{t.received}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{receipt.message}</p>
              <div className="mt-7 rounded-[var(--radius-card)] border border-pink-line bg-pink-soft p-6">
                <p className="text-xs font-semibold uppercase tracking-wide text-pink">{t.code}</p>
                <p className="mt-2 break-all font-mono text-3xl font-semibold tracking-wider text-ink">{receipt.caseCode}</p>
                <p className="mt-3 text-sm leading-relaxed text-muted">{t.codeHint}</p>
              </div>
              <p className="mt-5 flex items-start justify-center gap-2 text-sm text-muted"><Lock size={16} className="mt-0.5 shrink-0 text-pink" />{t.saved}</p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <button type="button" onClick={() => setReceipt(null)} className="brand-fill min-h-11 rounded-full px-6 py-2.5 text-sm font-semibold text-white">{t.another}</button>
                <a href="/" className="inline-flex min-h-11 items-center rounded-full border border-line px-6 py-2.5 text-sm font-semibold text-ink transition hover:border-pink-line hover:bg-pink-soft">{t.backHome}</a>
              </div>
            </div>
          ) : (
            <form onSubmit={(event) => void submit(event)} className="space-y-6" noValidate>
              <h2 className="text-xl font-semibold tracking-tight">{t.form}</h2>
              {error && <p role="alert" className="flex items-start gap-2 rounded-xl border border-pink-line bg-pink-soft px-3 py-2.5 text-sm leading-relaxed text-pink-hover"><CircleAlert size={16} className="mt-0.5 shrink-0" />{error}</p>}

              <label className="block">
                <span className="text-sm font-semibold">{t.topic}</span>
                <select value={topic} onChange={(event) => setTopic(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-line bg-paper px-3 text-sm outline-none focus:border-pink">
                  <option value="">—</option>
                  {topics.map((item) => <option key={item.value} value={item.value}>{lang === "sw" ? item.sw : item.en}</option>)}
                </select>
                <span className="mt-1.5 block text-xs text-muted">{t.topicHint}</span>
              </label>

              <div>
                <label htmlFor="help-district" className="text-sm font-semibold">{t.district}</label>
                <select id="help-district" value={district} onChange={(event) => setDistrict(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-line bg-paper px-3 text-sm outline-none focus:border-pink">
                  {districts.map((item) => <option key={item} value={item}>{item}</option>)}
                  <option value="OTHER">{t.districtOther}</option>
                </select>
                {district === "OTHER" && (
                  <input value={otherDistrict} onChange={(event) => setOtherDistrict(event.target.value)} maxLength={20} placeholder="e.g. MBEYA" className="mt-2 min-h-12 w-full rounded-xl border border-line bg-paper px-3 text-sm outline-none focus:border-pink" />
                )}
                <p className="mt-1.5 text-xs text-muted">{t.districtHint}</p>
              </div>

              <label className="block">
                <span className="text-sm font-semibold">{t.concern}</span>
                <textarea value={concern} onChange={(event) => setConcern(event.target.value)} maxLength={2000} rows={4} placeholder={t.concernPlaceholder} className="mt-2 w-full resize-y rounded-xl border border-line bg-paper px-3 py-3 text-sm leading-relaxed outline-none placeholder:text-muted/70 focus:border-pink" />
                <span className="mt-1.5 block text-xs leading-relaxed text-muted">{t.concernHint}</span>
              </label>

              <div className="space-y-3 rounded-[var(--radius-card)] border border-line bg-soft p-4">
                <label className="flex items-start gap-3 text-sm">
                  <input type="checkbox" checked={anonymous} onChange={(event) => { const next = event.target.checked; setAnonymous(next); if (next) { setConsent(false); setContact(""); } }} className="mt-1 h-4 w-4 accent-[var(--brand-pink)]" />
                  <span><span className="font-semibold">{t.anonymous}</span><span className="mt-0.5 block text-xs text-muted">{t.anonymousHint}</span></span>
                </label>
                <label className={`flex items-start gap-3 text-sm ${anonymous ? "opacity-45" : ""}`}>
                  <input type="checkbox" disabled={anonymous} checked={consent && !anonymous} onChange={(event) => setConsent(event.target.checked)} className="mt-1 h-4 w-4 accent-[var(--brand-pink)]" />
                  <span><span className="font-semibold">{t.consent}</span><span className="mt-0.5 block text-xs leading-relaxed text-muted">{t.consentHint}</span></span>
                </label>
                {consent && !anonymous && (
                  <label className="block">
                    <span className="text-sm font-semibold">{t.contact}</span>
                    <input value={contact} onChange={(event) => setContact(event.target.value)} maxLength={100} autoComplete="off" className="mt-2 min-h-12 w-full rounded-xl border border-line bg-paper px-3 text-sm outline-none focus:border-pink" />
                    <span className="mt-1.5 block text-xs text-muted">{t.contactHint}</span>
                  </label>
                )}
              </div>

              <fieldset>
                <legend className="text-sm font-semibold">{t.priority}</legend>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {(["NORMAL", "URGENT"] as const).map((value) => (
                    <label key={value} className={`flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border px-4 py-2 text-sm transition ${priority === value ? "border-pink bg-pink-soft font-semibold text-pink" : "border-line bg-paper hover:border-pink-line"}`}>
                      <input type="radio" name="priority" value={value} checked={priority === value} onChange={() => setPriority(value)} className="accent-[var(--brand-pink)]" />
                      {value === "NORMAL" ? t.normal : t.urgent}
                    </label>
                  ))}
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted">{t.urgencyNote}</p>
              </fieldset>

              <button type="submit" disabled={busy} className="brand-fill inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
                {busy ? t.sending : <><Send size={17} />{t.submit}</>}
              </button>
              <p className="flex items-center justify-center gap-2 text-xs text-muted"><Users size={14} className="text-pink" />{lang === "sw" ? "Mtu aliyefunzwa atakagua kila ombi." : "A trained person reviews every request."}</p>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
