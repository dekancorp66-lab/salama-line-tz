import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowUp, BookOpen, Bot, Check, CircleAlert, Heart, LoaderCircle, Plus, Shield, Wifi, WifiOff } from "lucide-react";
import { askAi, checkAiHealth, type AiAnswer, type AiHealth, type AiLanguage, type AiSource } from "@/lib/ai-client";

export const Route = createFileRoute("/ai")({
  head: () => ({ meta: [{ title: "SalamaLine AI Assistant" }, { name: "description", content: "Find trusted wellbeing and safety information in Kiswahili or English." }] }),
  component: AiAssistant,
});

type Message = { id: number; role: "user" | "assistant"; text: string; directAnswer?: string; explanation?: string; guidance?: string; sources?: AiSource[]; note?: string; noAnswer?: boolean };

const copy = {
  sw: {
    back: "Rudi SalamaLine", title: "Msaidizi wa SalamaLine", greeting: "Habari, niko hapa kukusaidia kupata taarifa za kuaminika.", intro: "Uliza kuhusu usalama, afya, haki na huduma za msaada. Taarifa hutoka kwenye vyanzo vilivyopakiwa.",
    input: "Andika swali lako hapa…", send: "Tuma swali", new: "Mazungumzo mapya", suggestions: "Unaweza kuuliza", sources: "Vyanzo", noAnswer: "Hakuna jibu la kuaminika lililopatikana kwenye msingi wa maarifa.",
    disclaimer: "Msaidizi wa AI si mbadala wa mtaalamu aliyefunzwa. Si lazima utoe jina, namba ya simu, anwani au maelezo binafsi.", emergency: "Ikiwa uko kwenye hatari ya sasa, tafuta sehemu salama ikiwezekana na wasiliana na huduma za dharura za eneo lako au mtu mzima unayemwamini. AI haiwezi kuwasiliana na huduma za dharura kwa niaba yako.",
    ready: "Msingi wa maarifa uko tayari", unavailable: "Msaidizi hapatikani kwa sasa", checking: "Inakagua huduma…", retry: "Jaribu tena", prompt: "SalamaLine AI", waiting: "Inatafuta taarifa…", tooShort: "Andika angalau herufi 3.",
  },
  en: {
    back: "Back to SalamaLine", title: "SalamaLine AI Assistant", greeting: "Hello, I’m here to help you find trusted information.", intro: "Ask about safety, health, rights, and support services. Answers come from loaded knowledge records.",
    input: "Type your question here…", send: "Send question", new: "New conversation", suggestions: "You could ask", sources: "Sources", noAnswer: "No reliable answer was found in the knowledge base.",
    disclaimer: "AI is not a substitute for a trained professional. You do not need to share your name, phone number, address, or personal details.", emergency: "If you are in immediate danger, move to a safer place if possible and contact local emergency services or a trusted adult. AI cannot contact emergency services for you.",
    ready: "Knowledge service is ready", unavailable: "Assistant is unavailable right now", checking: "Checking service…", retry: "Try again", prompt: "SalamaLine AI", waiting: "Finding information…", tooShort: "Please enter at least 3 characters.",
  },
} as const;

const questions: Record<AiLanguage, string[]> = {
  sw: ["Huduma za msaada zipi zinapatikana?", "Nifanye nini nikihisi siko salama?", "Ninawezaje kupata msaada wa afya?", "Haki zangu chini ya sheria za ulinzi wa mtoto Tanzania ni zipi?", "Ninawezaje kupata huduma za msaada zilizothibitishwa?"],
  en: ["What support services are available?", "What can I do if I feel unsafe?", "How can I access health support?", "What are my rights under Tanzanian child protection law?", "How can I find verified support services?"],
};

function AiAssistant() {
  const [language, setLanguage] = useState<AiLanguage>("sw");
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [health, setHealth] = useState<"checking" | "ready" | "unavailable">("checking");
  const [healthInfo, setHealthInfo] = useState<AiHealth | null>(null);
  const nextId = useRef(0);
  const transcript = useRef<HTMLElement>(null);
  const t = copy[language];

  async function refreshHealth() {
    setHealth("checking");
    try {
      const result = await checkAiHealth();
      setHealthInfo(result);
      setHealth(result.status === "ok" && result.knowledgeBase?.loaded ? "ready" : "unavailable");
    } catch {
      setHealth("unavailable");
    }
  }

  useEffect(() => {
    let active = true;
    checkAiHealth().then((result) => {
      if (!active) return;
      setHealthInfo(result);
      setHealth(result.status === "ok" && result.knowledgeBase?.loaded ? "ready" : "unavailable");
    }).catch(() => { if (active) setHealth("unavailable"); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    transcript.current?.scrollTo({ top: transcript.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  async function send(value = question) {
    const text = value.trim();
    if (pending || text.length < 3) {
      if (text.length < 3) setError(t.tooShort);
      return;
    }
    const id = ++nextId.current;
    setError("");
    setQuestion("");
    setMessages((previous) => [...previous, { id, role: "user", text }]);
    setPending(true);
    try {
      const result: AiAnswer = await askAi(text, language);
      const answerText = typeof result.answer === "string" ? result.answer : "";
      if (!answerText) throw new Error("SalamaLine AI returned an empty answer. Please try again.");
      const noAnswer = result.status === "no_reliable_answer" || (result.sources.length === 0 && /not have enough (verified )?information|not have enough evidence|sina (taarifa zilizothibitishwa|ushahidi wa kutosha)/i.test(answerText));
      setMessages((previous) => [...previous, {
        id: ++nextId.current, role: "assistant", text: answerText,
        directAnswer: result.directAnswer, explanation: result.explanation, guidance: result.guidance,
        sources: result.sources, note: result.note, noAnswer,
      }]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We couldn’t get an answer. Please try again.");
    } finally { setPending(false); }
  }

  function clearConversation() {
    setMessages([]); setQuestion(""); setError("");
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-soft text-ink">
      <header className="sticky top-0 z-20 border-b border-line bg-paper/95 px-4 py-3 backdrop-blur md:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <a href="/" className="flex items-center gap-2 text-sm font-medium text-muted hover:text-ink"><ArrowLeft size={17} /> <span className="hidden sm:inline">{t.back}</span><span className="sm:hidden">SalamaLine</span></a>
          <a href="/" className="brand-text text-lg font-semibold tracking-tight md:text-xl">salamaline</a>
          <div className="flex items-center gap-2" aria-label="Language">
            <button onClick={() => setLanguage("sw")} aria-pressed={language === "sw"} className={`min-h-10 rounded-full px-3.5 py-2 text-sm transition ${language === "sw" ? "bg-pink text-white" : "text-muted hover:bg-pink-soft hover:text-pink"}`}>SW</button>
            <button onClick={() => setLanguage("en")} aria-pressed={language === "en"} className={`min-h-10 rounded-full px-3.5 py-2 text-sm transition ${language === "en" ? "bg-pink text-white" : "text-muted hover:bg-pink-soft hover:text-pink"}`}>EN</button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid min-h-[calc(100svh-57px)] max-w-7xl gap-5 px-3 py-5 sm:px-5 md:grid-cols-[280px_minmax(0,1fr)] md:gap-7 md:px-8 md:py-8">
        <aside className="space-y-4 md:pt-2">
          <div className="rounded-[var(--radius-panel)] border border-line bg-paper p-5 shadow-sm md:p-6">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-pink-soft text-pink"><Heart size={21} /></div>
            <h1 className="mt-4 text-2xl font-semibold leading-tight md:text-3xl">{t.title}</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted">{t.intro}</p>
          </div>
          <div className="rounded-[var(--radius-card)] border border-pink-line bg-paper p-4 text-sm leading-relaxed text-muted">
            <div className="mb-2 flex items-center gap-2 font-semibold text-ink"><Shield size={17} className="text-pink" />{language === "sw" ? "Usalama wako ni muhimu" : "Your safety matters"}</div>
            {t.disclaimer}
          </div>
          <div role="note" className="rounded-[var(--radius-card)] border border-pink-line bg-pink-soft p-4 text-sm leading-relaxed text-ink">
            <div className="mb-2 flex items-center gap-2 font-semibold text-pink"><CircleAlert size={17} />{language === "sw" ? "Msaada wa dharura" : "Emergency guidance"}</div>
            {t.emergency}
          </div>
          <div className="flex items-center gap-2 px-1 text-xs text-muted" aria-live="polite">
            {health === "ready" ? <Wifi size={15} className="text-pink" /> : health === "checking" ? <LoaderCircle size={15} className="animate-spin text-pink" /> : <WifiOff size={15} className="text-pink" />}
            <span>{health === "ready" ? t.ready : health === "checking" ? t.checking : t.unavailable}</span>
            {healthInfo?.knowledgeBase?.records !== undefined && health === "ready" && <span className="ml-auto">{healthInfo.knowledgeBase.records} {language === "sw" ? "rekodi" : "records"}</span>}
            {health === "unavailable" && <button type="button" onClick={() => void refreshHealth()} className="ml-auto font-semibold text-pink underline underline-offset-2">{t.retry}</button>}
          </div>
        </aside>

        <section aria-label={t.title} className="flex min-h-[65svh] min-w-0 flex-col overflow-hidden rounded-[var(--radius-panel)] border border-line bg-paper shadow-[var(--shadow-soft)] md:min-h-[calc(100svh-120px)]">
          <div className="flex items-center justify-between border-b border-line px-4 py-3 sm:px-6">
            <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-pink-soft text-pink"><Bot size={19} /></span><div><p className="text-sm font-semibold">{t.prompt}</p><p className="text-xs text-muted">{health === "ready" ? (language === "sw" ? "Taarifa zilizothibitishwa" : "Verified information") : t.checking}</p></div></div>
            <button onClick={clearConversation} disabled={!messages.length && !error || pending} className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-line px-3 py-2 text-xs font-medium text-muted transition hover:border-pink-line hover:bg-pink-soft hover:text-pink disabled:opacity-40"><Plus size={15} /> <span className="hidden sm:inline">{t.new}</span></button>
          </div>

          <section ref={transcript} aria-live="polite" aria-label={language === "sw" ? "Historia ya mazungumzo" : "Conversation history"} className="flex-1 space-y-6 overflow-y-auto p-4 sm:p-6 md:p-8">
            {!messages.length ? <div className="mx-auto max-w-xl py-3 sm:py-8">
              <div className="flex gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-pink-soft text-pink"><Bot size={18} /></span><div className="max-w-[calc(100%-3rem)] rounded-2xl rounded-tl-sm border border-line bg-soft px-4 py-3 text-sm leading-relaxed text-ink">{t.greeting}</div></div>
              <div className="mt-7"><p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">{t.suggestions}</p><div className="grid gap-2 sm:grid-cols-2">{questions[language].map((item) => <button key={item} disabled={pending} onClick={() => void send(item)} className="min-h-12 rounded-2xl border border-line bg-paper px-4 py-3 text-left text-sm leading-snug text-ink transition hover:border-pink/50 hover:bg-pink-soft disabled:opacity-50">{item}</button>)}</div></div>
            </div> : messages.map((message) => <article key={message.id} className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
              {message.role === "assistant" && <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-pink-soft text-pink"><Bot size={18} /></span>}
              <div className={`min-w-0 max-w-[calc(100%-3rem)] break-words sm:max-w-[78%] ${message.role === "user" ? "rounded-2xl rounded-tr-sm bg-pink px-4 py-3 text-white" : "rounded-2xl rounded-tl-sm border border-line bg-soft px-4 py-3 text-ink"}`}>
                {message.noAnswer && <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-pink"><CircleAlert size={14} />{t.noAnswer}</p>}
                {message.role === "assistant" && message.directAnswer ? <>
                  <p className="whitespace-pre-wrap text-[15px] font-semibold leading-relaxed">{message.directAnswer}</p>
                  {message.explanation && <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{message.explanation}</p>}
                  {message.guidance && <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{message.guidance}</p>}
                </> : <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.text}</p>}
                {!!message.sources?.length && <div className="mt-4 border-t border-line pt-3"><p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted"><BookOpen size={14} className="text-pink" />{language === "sw" ? "Vyanzo vya taarifa" : "Sources"}</p><ul className="space-y-1.5">{message.sources.map((source) => <li key={source.id} className="flex gap-1.5 text-xs leading-relaxed text-muted"><Check size={13} className="mt-0.5 shrink-0 text-pink" /><span>{source.url ? <a href={source.url} target="_blank" rel="noreferrer" className="font-medium text-pink underline underline-offset-2 hover:text-pink-hover">{source.name}</a> : source.name}</span></li>)}</ul></div>}
                {message.note && <p className="mt-3 text-xs leading-relaxed text-muted">{message.note}</p>}
              </div>
              {message.role === "user" && <span aria-hidden="true" className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-pink-soft text-xs font-semibold text-pink">{language === "sw" ? "WE" : "YOU"}</span>}
            </article>)}
            {pending && <div className="flex items-center gap-3" role="status"><span className="grid h-9 w-9 place-items-center rounded-2xl bg-pink-soft text-pink"><Bot size={18} /></span><div className="flex items-center gap-2 rounded-2xl border border-line bg-soft px-4 py-3 text-sm text-muted"><LoaderCircle size={16} className="animate-spin text-pink" />{t.waiting}</div></div>}
          </section>

          <div className="border-t border-line p-3 sm:p-5">
            {error && <p role="alert" className="mb-3 flex items-start gap-2 rounded-xl border border-pink-line bg-pink-soft px-3 py-2 text-sm leading-relaxed text-pink-hover"><CircleAlert size={16} className="mt-0.5 shrink-0" />{error}</p>}
            <form onSubmit={(event) => { event.preventDefault(); void send(); }} className="flex items-end gap-2 rounded-2xl border border-line bg-paper p-2 shadow-sm transition focus-within:border-pink focus-within:ring-2 focus-within:ring-pink/15">
              <label className="sr-only" htmlFor="ai-question">{t.input}</label>
              <textarea id="ai-question" value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} disabled={pending} maxLength={1200} rows={2} placeholder={t.input} className="max-h-32 min-h-12 min-w-0 flex-1 resize-y bg-transparent px-2 py-2 text-sm leading-relaxed outline-none placeholder:text-muted/70 disabled:opacity-60" />
              <button type="submit" disabled={pending || question.trim().length < 3} aria-label={t.send} title={t.send} className="brand-fill grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white disabled:cursor-not-allowed disabled:opacity-40"><ArrowUp size={20} /></button>
            </form>
            <p className="mt-2 text-center text-[11px] leading-relaxed text-muted">{language === "sw" ? "Usishiriki taarifa zinazokutambulisha. Ujumbe huhifadhiwa kwenye kumbukumbu ya muda ya ukurasa huu pekee." : "Avoid identifying details. Messages stay in this page’s temporary session memory only."}</p>
          </div>
        </section>
      </div>
    </main>
  );
}
