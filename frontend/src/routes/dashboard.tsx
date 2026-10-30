import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Partner dashboard · SalamaLine" }, { name: "robots", content: "noindex" }] }),
  component: Dashboard,
});

type Cell = number | string;
type Table = { rows: { name: string; count: Cell }[]; total: number | null };
interface Stats {
  generatedAt: string; minCell: number;
  byEvent: Table; byChannel: Table; byDistrict: Table;
  response: { cases: Cell; answered: number | null; within30Min: number | null; medianMinutesToAnswer: number | null };
}

/** Partner view: anonymous aggregates only. The token lives in memory, never in storage. */
function Dashboard() {
  const [token, setToken] = useState("");
  const [data, setData] = useState<Stats | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function load(e?: React.FormEvent) {
    e?.preventDefault(); setBusy(true); setErr("");
    try {
      const r = await fetch("/api/stats", { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!r.ok) throw new Error(r.status === 401 ? "Wrong or missing access token." : "Could not load statistics.");
      setData(await r.json());
    } catch (x) { setErr((x as Error).message); setData(null); }
    finally { setBusy(false); }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 md:px-6">
      <p className="text-sm font-medium text-pink">Partner dashboard</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight md:text-4xl">Anonymous, aggregated trends</h1>
      <p className="mt-2 max-w-2xl text-muted">No names, numbers or messages appear here. Any count under 5 is hidden so no individual can be identified.</p>

      <form onSubmit={load} className="mt-6 flex max-w-md gap-2">
        <input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Access token" autoComplete="off" aria-label="Access token"
          className="min-w-0 flex-1 rounded-full border border-line px-4 py-2" />
        <button disabled={busy} className="brand-fill rounded-full px-5 py-2 font-semibold text-paper">{busy ? "Loading…" : "View"}</button>
      </form>
      {err && <p role="alert" className="mt-3 text-sm text-pink">{err}</p>}

      {data && (
        <div className="mt-8 grid gap-8">
          <section aria-label="Response speed" className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-4">
            {[
              ["Cases", data.response.cases],
              ["Answered", data.response.answered ?? "—"],
              ["Answered in 30 min", data.response.within30Min ?? "—"],
              ["Median minutes to answer", data.response.medianMinutesToAnswer ?? "—"],
            ].map(([k, v]) => (
              <div key={String(k)} className="bg-paper p-5"><p className="text-3xl font-semibold">{String(v)}</p><p className="mt-1 text-sm text-muted">{String(k)}</p></div>
            ))}
          </section>
          {([["By topic and action", data.byEvent], ["By channel", data.byChannel], ["By district", data.byDistrict]] as [string, Table][]).map(([title, t]) => (
            <section key={title} aria-label={title}>
              <h2 className="text-xl font-semibold">{title}</h2>
              <div className="mt-3 h-56 w-full">
                <ResponsiveContainer>
                  <BarChart data={t.rows.map((r) => ({ name: r.name, count: typeof r.count === "number" ? r.count : 0 }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#efe6ea" /><XAxis dataKey="name" fontSize={11} interval={0} angle={-20} textAnchor="end" height={60} /><YAxis allowDecimals={false} fontSize={11} /><Tooltip />
                    <Bar dataKey="count" fill="#f03486" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <table className="mt-2 w-full text-sm"><tbody>
                {t.rows.map((r) => (<tr key={r.name} className="border-t border-line"><td className="py-1.5">{r.name}</td><td className="py-1.5 text-right font-mono">{String(r.count)}</td></tr>))}
                <tr className="border-t border-line font-medium"><td className="py-1.5">Total</td><td className="py-1.5 text-right font-mono">{t.total ?? "hidden (small counts)"}</td></tr>
              </tbody></table>
            </section>
          ))}
          <p className="text-xs text-muted">Generated {new Date(data.generatedAt).toLocaleString()}. Bars show hidden cells as zero; read the table for the exact figure.</p>
        </div>
      )}
    </main>
  );
}
