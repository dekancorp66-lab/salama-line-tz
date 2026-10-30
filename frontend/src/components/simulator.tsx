import { useEffect, useRef, useState } from "react";

/**
 * Live simulator. Every key press goes to /api/simulate, which runs the REAL
 * SalamaLine engine in an isolated sandbox (fake numbers, nothing is sent).
 * Four views: the girl on USSD, the girl on SMS, a responder, a focal person.
 */
type Role = "girl" | "responder" | "focal";
type Msg = { me: boolean; text: string };
const TABS = [
  { id: "ussd", label: "USSD" },
  { id: "girl", label: "Girl SMS" },
  { id: "responder", label: "Responder" },
  { id: "focal", label: "Focal" },
] as const;
type Tab = (typeof TABS)[number]["id"];

const CHIPS: Record<Exclude<Tab, "ussd">, string[]> = {
  girl: ["SALAMA", "MSAADA Mbeya", "NDIO", "RIPOTI Mbeya", "HABARI NDOA", "USTAWI 4", "FUTA"],
  responder: ["ACK", "CLOSE"],
  focal: ["ACK", "CLOSE"],
};

export function Simulator() {
  const simId = useRef("");
  const [tab, setTab] = useState<Tab>("ussd");
  const [screen, setScreen] = useState<string | null>(null);
  const [path, setPath] = useState<string[]>([]);
  const [ended, setEnded] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [box, setBox] = useState<Record<Role, Msg[]>>({ girl: [], responder: [], focal: [] });
  const [err, setErr] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { simId.current = `s${Math.random().toString(36).slice(2, 10)}`; }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "nearest" }); }, [box, screen, tab]);

  async function call(body: Record<string, string>) {
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/simulate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ simId: simId.current, sessionId: simId.current, ...body }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "failed");
      setBox((b) => ({
        girl: [...b.girl, ...j.delivered.girl.map((text: string) => ({ me: false, text }))],
        responder: [...b.responder, ...j.delivered.responder.map((text: string) => ({ me: false, text }))],
        focal: [...b.focal, ...j.delivered.focal.map((text: string) => ({ me: false, text }))],
      }));
      return j.screen as string | null;
    } catch (e) { setErr((e as Error).message); return null; }
    finally { setBusy(false); }
  }

  async function ussd(next: string[]) {
    const s = await call({ action: "ussd", text: next.join("*") });
    if (s == null) return;
    setPath(next); setScreen(s.replace(/^(CON|END) /, "")); setEnded(s.startsWith("END"));
  }
  async function send(role: Role, text: string) {
    const t = text.trim();
    if (!t) return;
    setBox((b) => ({ ...b, [role]: [...b[role], { me: true, text: t }] }));
    setInput("");
    await call({ action: "text", as: role, text: t });
  }
  const lastCode = (role: Role) => {
    const m = [...box[role]].reverse().find((x) => !x.me && /\b(ACK|Code|Msimbo)\b/.test(x.text));
    return /(?:ACK|Code|Msimbo|case)\s+([A-Z2-9]{4})\b/.exec(m?.text ?? "")?.[1] ?? "";
  };
  const reset = async () => {
    await call({ action: "reset" });
    setBox({ girl: [], responder: [], focal: [] }); setScreen(null); setPath([]); setEnded(false);
  };

  const role: Role = tab === "responder" ? "responder" : tab === "focal" ? "focal" : "girl";
  return (
    <div className="mx-auto w-full max-w-sm rounded-[36px] border border-line bg-paper p-3 shadow-sm">
      <div className="rounded-[28px] bg-invert p-4 text-paper">
        <div role="tablist" className="flex gap-1 rounded-full bg-paper/10 p-1 text-xs">
          {TABS.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
              className={`flex-1 rounded-full px-2 py-1.5 font-medium ${tab === t.id ? "bg-paper text-ink" : "text-paper/70"}`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-3 h-72 overflow-y-auto rounded-2xl bg-paper/5 p-3 font-mono text-sm leading-6 text-paper/90" aria-live="polite">
          {tab === "ussd" ? (
            screen == null ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center font-sans">
                <p className="text-paper/60">Try it live. Nothing is sent; numbers are fake.</p>
                <button onClick={() => ussd([])} disabled={busy} className="brand-fill rounded-full px-5 py-2 text-sm font-semibold text-paper">Dial *150#</button>
              </div>
            ) : (<><p className="whitespace-pre-wrap">{screen}</p>{ended && <p className="mt-2 text-paper/50">Session ended.</p>}</>)
          ) : (
            <>
              {tab === "responder" && box.responder.length === 0 && <p className="font-sans text-paper/50">Alerts for Mbeya Jiji appear here. Ask for help as the girl first.</p>}
              {tab === "focal" && box.focal.length === 0 && <p className="font-sans text-paper/50">Escalations appear here after the responder stays silent. Use the time buttons.</p>}
              {tab === "girl" && box.girl.length === 0 && <p className="font-sans text-paper/50">Send SALAMA to see the menu.</p>}
              {box[role].map((m, i) => (
                <p key={i} className={`my-1 whitespace-pre-wrap rounded-xl px-3 py-1.5 ${m.me ? "ml-8 bg-pink/80 text-paper" : "mr-8 bg-paper/10"}`}>{m.text}</p>
              ))}
            </>
          )}
          <div ref={endRef} />
        </div>

        {tab === "ussd" ? (
          <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (ended || screen == null) return; const v = input.trim(); if (v) { setInput(""); ussd([...path, v]); } }}>
            <input value={input} onChange={(e) => setInput(e.target.value)} inputMode="numeric" aria-label="USSD reply" placeholder={ended ? "Session ended" : "Reply, e.g. 1"} disabled={ended || screen == null || busy}
              className="min-w-0 flex-1 rounded-full bg-paper/10 px-4 py-2 text-sm text-paper placeholder:text-paper/40" />
            <button disabled={ended || screen == null || busy} className="rounded-full bg-paper px-4 py-2 text-sm font-semibold text-ink disabled:opacity-40">Send</button>
          </form>
        ) : (
          <>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {CHIPS[tab].map((c) => (
                <button key={c} onClick={() => send(role, (c === "ACK" || c === "CLOSE") ? `${c} ${lastCode(role)}`.trim() : c)} disabled={busy}
                  className="rounded-full border border-paper/20 px-2.5 py-1 font-mono text-[11px] text-paper/80">{c}</button>
              ))}
            </div>
            <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); send(role, input); }}>
              <input value={input} onChange={(e) => setInput(e.target.value)} aria-label="SMS text" placeholder="Type an SMS…" disabled={busy}
                className="min-w-0 flex-1 rounded-full bg-paper/10 px-4 py-2 text-sm text-paper placeholder:text-paper/40" />
              <button disabled={busy} className="rounded-full bg-paper px-4 py-2 text-sm font-semibold text-ink">Send</button>
            </form>
          </>
        )}

        <div className="mt-3 flex items-center justify-between text-[11px] text-paper/60">
          <span>Skip time:
            {[10, 30].map((m) => (<button key={m} onClick={() => call({ action: "advance", minutes: String(m) })} className="ml-1.5 rounded-full border border-paper/20 px-2 py-0.5">+{m} min</button>))}
          </span>
          <button onClick={reset} className="underline">Reset</button>
        </div>
        {err && <p role="alert" className="mt-2 text-xs text-orange">{err}</p>}
      </div>
    </div>
  );
}
