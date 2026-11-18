import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowUp, BookOpen, Bot, Check, CircleAlert, Heart, LoaderCircle, Plus, Shield, Wifi, WifiOff } from "lucide-react";
import { PublicHeader } from "@/components/public-header.tsx";
import { en } from "@/i18n/en.ts";
import { useI18n, usePageMeta } from "@/i18n/provider.tsx";
import type { TranslationKey } from "@/i18n/types.ts";
import { askAi, checkAiHealth, type AiAnswer, type AiHealth, type AiSource } from "@/lib/ai-client";

export const Route = createFileRoute("/ai")({
  head: () => ({
    meta: [
      { title: en.meta.aiTitle },
      { name: "description", content: en.meta.aiDescription },
    ],
  }),
  component: AiAssistant,
});

type Message = { id: number; role: "user" | "assistant"; text: string; directAnswer?: string; explanation?: string; guidance?: string; sources?: AiSource[]; note?: string; noAnswer?: boolean };
type AiError = { kind: "key"; key: TranslationKey } | { kind: "api"; cause: unknown };

function AiAssistant() {
  const { t, language, dictionary, errorMessage } = useI18n();
  usePageMeta("ai");
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<AiError | null>(null);
  const [health, setHealth] = useState<"checking" | "ready" | "unavailable">("checking");
  const [healthInfo, setHealthInfo] = useState<AiHealth | null>(null);
  const nextId = useRef(0);
  const transcript = useRef<HTMLElement>(null);

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
    if (pending) return;
    if (text.length < 3) {
      setError({ kind: "key", key: "ai.tooShort" });
      return;
    }
    const id = ++nextId.current;
    setError(null);
    setQuestion("");
    setMessages((previous) => [...previous, { id, role: "user", text }]);
    setPending(true);
    try {
      const result: AiAnswer = await askAi(text, language);
      const answerText = typeof result.answer === "string" ? result.answer : "";
      if (!answerText) {
        setError({ kind: "key", key: "ai.emptyAnswer" });
        return;
      }
      const noAnswer = result.status === "no_reliable_answer" || (result.sources.length === 0 && /not have enough (verified )?information|not have enough evidence|sina (taarifa zilizothibitishwa|ushahidi wa kutosha)/i.test(answerText));
      setMessages((previous) => [...previous, {
        id: ++nextId.current, role: "assistant", text: answerText,
        directAnswer: result.directAnswer, explanation: result.explanation, guidance: result.guidance,
        sources: result.sources, note: result.note, noAnswer,
      }]);
    } catch (cause) {
      setError({ kind: "api", cause });
    } finally {
      setPending(false);
    }
  }

  function clearConversation() {
    setMessages([]); setQuestion(""); setError(null);
  }

  const suggestions = [
    dictionary.ai.suggestion1,
    dictionary.ai.suggestion2,
    dictionary.ai.suggestion3,
    dictionary.ai.suggestion4,
    dictionary.ai.suggestion5,
  ];

  return (
    <main className="min-h-screen overflow-x-hidden bg-paper text-ink">
      <PublicHeader current="/ai" />

      <div className="mx-auto grid min-h-[100svh] max-w-7xl gap-5 px-3 pb-8 pt-32 sm:px-5 md:grid-cols-[280px_minmax(0,1fr)] md:gap-7 md:px-8 md:pt-40">
        <aside className="space-y-4 md:pt-2">
          <div className="rounded-[var(--radius-panel)] border border-line bg-paper p-5 shadow-sm md:p-6">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-pink-soft text-pink"><Heart size={21} /></div>
            <h1 className="mt-4 text-2xl font-semibold leading-tight md:text-3xl">{t("ai.title")}</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted">{t("ai.intro")}</p>
          </div>
          <div className="rounded-[var(--radius-card)] border border-pink-line bg-paper p-4 text-sm leading-relaxed text-muted">
            <div className="mb-2 flex items-center gap-2 font-semibold text-ink"><Shield size={17} className="text-pink" />{t("ai.safetyTitle")}</div>
            {t("ai.disclaimer")}
          </div>
          <div role="note" className="rounded-[var(--radius-card)] border border-pink-line bg-pink-soft p-4 text-sm leading-relaxed text-ink">
            <div className="mb-2 flex items-center gap-2 font-semibold text-pink"><CircleAlert size={17} />{t("ai.emergencyTitle")}</div>
            {t("ai.emergency")}
          </div>
          <a href="/report" className="block rounded-[var(--radius-card)] border border-pink-line bg-pink-soft p-4 text-sm font-semibold text-pink transition hover:bg-pink-line">{t("ai.talkToPerson")}</a>
          <div className="flex items-center gap-2 px-1 text-xs text-muted" aria-live="polite">
            {health === "ready" ? <Wifi size={15} className="text-pink" /> : health === "checking" ? <LoaderCircle size={15} className="animate-spin text-pink" /> : <WifiOff size={15} className="text-pink" />}
            <span>{health === "ready" ? t("ai.ready") : health === "checking" ? t("ai.checking") : t("ai.unavailable")}</span>
            {healthInfo?.knowledgeBase?.records !== undefined && health === "ready" && <span className="ml-auto">{t("ai.records", { count: healthInfo.knowledgeBase.records })}</span>}
            {health === "unavailable" && <button type="button" onClick={() => void refreshHealth()} className="ml-auto font-semibold text-pink underline underline-offset-2">{t("ai.retry")}</button>}
          </div>
        </aside>

        <section aria-label={t("ai.title")} className="flex min-h-[65svh] min-w-0 flex-col overflow-hidden rounded-[var(--radius-panel)] border border-line bg-paper shadow-[var(--shadow-soft)] md:min-h-[calc(100svh-120px)]">
          <div className="flex items-center justify-between border-b border-line px-4 py-3 sm:px-6">
            <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-pink-soft text-pink"><Bot size={19} /></span><div><p className="text-sm font-semibold">{t("ai.prompt")}</p><p className="text-xs text-muted">{health === "ready" ? t("ai.verifiedInformation") : t("ai.checking")}</p></div></div>
            <button onClick={clearConversation} disabled={!messages.length && !error || pending} className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-line px-3 py-2 text-xs font-medium text-muted transition hover:border-pink-line hover:bg-pink-soft hover:text-pink disabled:opacity-40"><Plus size={15} /> <span className="hidden sm:inline">{t("ai.newConversation")}</span></button>
          </div>

          <section ref={transcript} aria-live="polite" aria-label={t("ai.history")} className="flex-1 space-y-6 overflow-y-auto p-4 sm:p-6 md:p-8">
            {!messages.length ? <div className="mx-auto max-w-xl py-3 sm:py-8">
              <div className="flex gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-pink-soft text-pink"><Bot size={18} /></span><div className="max-w-[calc(100%-3rem)] rounded-2xl rounded-tl-sm border border-line bg-soft px-4 py-3 text-sm leading-relaxed text-ink">{t("ai.greeting")}</div></div>
              <div className="mt-7"><p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">{t("ai.suggestions")}</p><div className="grid gap-2 sm:grid-cols-2">{suggestions.map((item) => <button key={item} disabled={pending} onClick={() => void send(item)} className="min-h-12 rounded-2xl border border-line bg-paper px-4 py-3 text-left text-sm leading-snug text-ink transition hover:border-pink/50 hover:bg-pink-soft disabled:opacity-50">{item}</button>)}</div></div>
            </div> : messages.map((message) => <article key={message.id} className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
              {message.role === "assistant" && <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-pink-soft text-pink"><Bot size={18} /></span>}
              <div className={`min-w-0 max-w-[calc(100%-3rem)] break-words sm:max-w-[78%] ${message.role === "user" ? "rounded-2xl rounded-tr-sm bg-pink px-4 py-3 text-white" : "rounded-2xl rounded-tl-sm border border-line bg-soft px-4 py-3 text-ink"}`}>
                {message.noAnswer && <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-pink"><CircleAlert size={14} />{t("ai.noAnswer")}</p>}
                {message.role === "assistant" && message.directAnswer ? <>
                  <p className="whitespace-pre-wrap text-[15px] font-semibold leading-relaxed">{message.directAnswer}</p>
                  {message.explanation && <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{message.explanation}</p>}
                  {message.guidance && <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{message.guidance}</p>}
                </> : <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.text}</p>}
                {!!message.sources?.length && <div className="mt-4 border-t border-line pt-3"><p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted"><BookOpen size={14} className="text-pink" />{t("ai.sourcesLabel")}</p><ul className="space-y-1.5">{message.sources.map((source) => <li key={source.id} className="flex gap-1.5 text-xs leading-relaxed text-muted"><Check size={13} className="mt-0.5 shrink-0 text-pink" /><span>{source.url ? <a href={source.url} target="_blank" rel="noreferrer" className="font-medium text-pink underline underline-offset-2 hover:text-pink-hover">{source.name}</a> : source.name}</span></li>)}</ul></div>}
                {message.note && <p className="mt-3 text-xs leading-relaxed text-muted">{message.note}</p>}
              </div>
              {message.role === "user" && <span aria-hidden="true" className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-pink-soft text-xs font-semibold text-pink">{t("ai.you")}</span>}
            </article>)}
            {pending && <div className="flex items-center gap-3" role="status"><span className="grid h-9 w-9 place-items-center rounded-2xl bg-pink-soft text-pink"><Bot size={18} /></span><div className="flex items-center gap-2 rounded-2xl border border-line bg-soft px-4 py-3 text-sm text-muted"><LoaderCircle size={16} className="animate-spin text-pink" />{t("ai.waiting")}</div></div>}
          </section>

          <div className="border-t border-line p-3 sm:p-5">
            {error && <p role="alert" className="mb-3 flex items-start gap-2 rounded-xl border border-pink-line bg-pink-soft px-3 py-2 text-sm leading-relaxed text-pink-hover"><CircleAlert size={16} className="mt-0.5 shrink-0" />{error.kind === "key" ? t(error.key) : errorMessage(error.cause)}</p>}
            <form onSubmit={(event) => { event.preventDefault(); void send(); }} className="flex items-end gap-2 rounded-2xl border border-line bg-paper p-2 shadow-sm transition focus-within:border-pink focus-within:ring-2 focus-within:ring-pink/15">
              <label className="sr-only" htmlFor="ai-question">{t("ai.input")}</label>
              <textarea id="ai-question" value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} disabled={pending} maxLength={1200} rows={2} placeholder={t("ai.input")} className="max-h-32 min-h-12 min-w-0 flex-1 resize-y bg-transparent px-2 py-2 text-sm leading-relaxed outline-none placeholder:text-muted/70 disabled:opacity-60" />
              <button type="submit" disabled={pending || question.trim().length < 3} aria-label={t("ai.send")} title={t("ai.send")} className="brand-fill grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white disabled:cursor-not-allowed disabled:opacity-40"><ArrowUp size={20} /></button>
            </form>
            <p className="mt-2 text-center text-[11px] leading-relaxed text-muted">{t("ai.sessionNote")}</p>
          </div>
        </section>
      </div>
    </main>
  );
}
