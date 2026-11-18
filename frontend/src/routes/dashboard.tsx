import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { GlobalControls } from "@/components/global-controls";
import { en } from "@/i18n/en.ts";
import { useI18n, usePageMeta } from "@/i18n/provider.tsx";
import { ApiError } from "@/lib/api-client";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: en.meta.dashboardTitle }, { name: "robots", content: "noindex" }] }),
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
  const { t, errorMessage } = useI18n();
  usePageMeta("dashboard");
  const [token, setToken] = useState("");
  const [data, setData] = useState<Stats | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function load(e?: React.FormEvent) {
    e?.preventDefault(); setBusy(true); setErr("");
    try {
      const r = await fetch("/api/stats", { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!r.ok) throw new ApiError("", r.status);
      setData(await r.json());
    } catch (x) { setErr(errorMessage(x)); setData(null); }
    finally { setBusy(false); }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 md:px-6 md:py-14">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-pink">{t("dashboard.title")}</p>
        <GlobalControls />
      </div>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-5xl">{t("dashboard.heading")}</h1>
      <p className="mt-2 max-w-2xl text-muted">{t("dashboard.intro")}</p>

      <form onSubmit={load} className="mt-7 flex max-w-md gap-2 rounded-2xl border border-line bg-paper p-2 shadow-sm focus-within:border-pink focus-within:ring-2 focus-within:ring-pink/15">
        <input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder={t("dashboard.token")} autoComplete="off" aria-label={t("dashboard.token")}
          className="min-w-0 flex-1 rounded-xl bg-transparent px-4 py-2 outline-none placeholder:text-muted/70" />
        <button disabled={busy} className="brand-fill min-h-10 rounded-xl px-5 py-2 font-semibold text-white disabled:opacity-50">{busy ? t("common.loading") : t("dashboard.view")}</button>
      </form>
      {err && <p role="alert" className="mt-3 text-sm text-pink">{err}</p>}

      {data && (
        <div className="mt-8 grid gap-8">
          <section aria-label={t("dashboard.responseSpeed")} className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-4">
            {[
              [t("dashboard.cases"), data.response.cases],
              [t("dashboard.answered"), data.response.answered ?? "—"],
              [t("dashboard.answered30"), data.response.within30Min ?? "—"],
              [t("dashboard.medianMinutes"), data.response.medianMinutesToAnswer ?? "—"],
            ].map(([k, v]) => (
              <div key={String(k)} className="bg-paper p-5 md:p-6"><p className="text-3xl font-semibold">{String(v)}</p><p className="mt-1 text-sm text-muted">{String(k)}</p></div>
            ))}
          </section>
          {([
            [t("dashboard.byEvent"), data.byEvent],
            [t("dashboard.byChannel"), data.byChannel],
            [t("dashboard.byDistrict"), data.byDistrict],
          ] as [string, Table][]).map(([title, table]) => (
            <section key={title} aria-label={title}>
              <h2 className="text-xl font-semibold">{title}</h2>
              <div className="mt-3 h-56 w-full">
                <ResponsiveContainer>
                  <BarChart data={table.rows.map((r) => ({ name: r.name, count: typeof r.count === "number" ? r.count : 0 }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" /><XAxis dataKey="name" fontSize={11} interval={0} angle={-20} textAnchor="end" height={60} /><YAxis allowDecimals={false} fontSize={11} /><Tooltip />
                    <Bar dataKey="count" fill="var(--brand-pink)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <table className="mt-2 w-full text-sm"><tbody>
                {table.rows.map((r) => (<tr key={r.name} className="border-t border-line"><td className="py-1.5">{r.name}</td><td className="py-1.5 text-right font-mono">{String(r.count)}</td></tr>))}
                <tr className="border-t border-line font-medium"><td className="py-1.5">{t("dashboard.total")}</td><td className="py-1.5 text-right font-mono">{table.total ?? t("dashboard.hiddenCounts")}</td></tr>
              </tbody></table>
            </section>
          ))}
          <p className="text-xs text-muted">{t("dashboard.generated", { date: new Date(data.generatedAt).toLocaleString() })}</p>
        </div>
      )}
    </main>
  );
}
