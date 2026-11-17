import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { ArrowLeft, BriefcaseBusiness, CircleAlert, Lock, LogOut, ShieldCheck } from "lucide-react";
import { ApiError } from "@/lib/api-client";
import { loginStaff } from "@/lib/backend-api";
import {
  canManageCases, canManageContent, canManageServices, canReadAudit,
  clearStaffSession, isAdminRole, setStaffSession, useStaffSession,
  type StaffUser,
} from "@/lib/staff-session";
import { CaseWorkspace } from "@/components/officers/case-workspace";
import { AdminConsole } from "@/components/officers/admin-console";

export const Route = createFileRoute("/officers")({
  head: () => ({
    meta: [
      { title: "Officer workspace · SalamaLine" },
      { name: "robots", content: "noindex" },
      { name: "description", content: "Secure case workspace for trained SalamaLine responders and administrators." },
    ],
  }),
  component: Officers,
});

function Officers() {
  const session = useStaffSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"cases" | "admin">("cases");

  async function signIn(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const result = await loginStaff(email.trim(), password);
      setStaffSession({ token: result.accessToken, user: result.user });
      setPassword("");
      setTab(canManageCases(result.user.role) ? "cases" : "admin");
    } catch (cause) {
      setError(cause instanceof ApiError || cause instanceof Error
        ? cause.message
        : "Sign in failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const user: StaffUser | null = session.user;
  const canSeeCases = Boolean(user && canManageCases(user.role));
  const canSeeAdmin = Boolean(user && (isAdminRole(user.role) || canManageServices(user.role) || canManageContent(user.role) || canReadAudit(user.role)));

  return (
    <main className="min-h-screen bg-soft text-ink">
      <header className="sticky top-0 z-20 border-b border-line bg-paper/95 px-4 py-3 backdrop-blur md:px-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <a href="/" className="flex items-center gap-2 text-sm font-medium text-muted hover:text-ink"><ArrowLeft size={17} /><span className="hidden sm:inline">SalamaLine</span></a>
            <span className="hidden h-5 w-px bg-line sm:block" />
            <span className="brand-text text-lg font-semibold tracking-tight">officer workspace</span>
          </div>
          {user ? (
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-semibold">{user.displayName}</p>
                <p className="text-xs text-muted">{user.role.replaceAll("_", " ")}{user.districtCode ? ` · ${user.districtCode}` : ""}</p>
              </div>
              <button type="button" onClick={() => { clearStaffSession(); setTab("cases"); }} className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-line px-3 text-xs font-semibold text-muted transition hover:border-pink-line hover:bg-pink-soft hover:text-pink"><LogOut size={15} />Sign out</button>
            </div>
          ) : (
            <a href="/help" className="inline-flex min-h-10 items-center rounded-full border border-line px-4 text-xs font-semibold text-ink hover:bg-pink-soft">Need help?</a>
          )}
        </div>
      </header>

      {!session.token || !user ? (
        <div className="mx-auto grid max-w-5xl gap-6 px-4 py-8 sm:px-6 md:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] md:py-14">
          <section className="rounded-[var(--radius-panel)] border border-line bg-paper p-6 shadow-[var(--shadow-soft)] sm:p-9">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-pink-soft text-pink"><BriefcaseBusiness size={21} /></span>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight md:text-3xl">Sign in to your officer account</h1>
            <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted">This workspace is for vetted responders and administrators. Every case action is attributed to your account and written to the audit log.</p>
            <form onSubmit={(event) => void signIn(event)} className="mt-7 max-w-md space-y-4">
              {error && <p role="alert" className="flex items-start gap-2 rounded-xl border border-pink-line bg-pink-soft px-3 py-2.5 text-sm leading-relaxed text-pink-hover"><CircleAlert size={16} className="mt-0.5 shrink-0" />{error}</p>}
              <label className="block text-sm font-semibold">Email
                <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" className="mt-2 min-h-12 w-full rounded-xl border border-line bg-paper px-3 text-sm outline-none focus:border-pink" />
              </label>
              <label className="block text-sm font-semibold">Password
                <input type="password" required value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" className="mt-2 min-h-12 w-full rounded-xl border border-line bg-paper px-3 text-sm outline-none focus:border-pink" />
              </label>
              <button type="submit" disabled={busy} className="brand-fill min-h-12 w-full rounded-full px-6 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Signing in…" : "Sign in"}</button>
            </form>
            <p className="mt-5 flex items-center gap-2 text-xs text-muted"><Lock size={14} className="text-pink" />Your session stays in this page’s memory. It ends when you close or refresh the page.</p>
          </section>
          <aside className="space-y-4">
            <div className="rounded-[var(--radius-card)] border border-line bg-paper p-5">
              <p className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck size={17} className="text-pink" />Safeguarding rules</p>
              <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted">
                {[
                  "Only cases in your authorized district are visible.",
                  "Never store names, phone numbers or raw message text in notes.",
                  "Family, police and authorities are never contacted automatically.",
                  "Referrals require specific, active Share with service consent.",
                  "Every status change, note and consent decision is audited.",
                ].map((line) => <li key={line} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-pink" />{line}</li>)}
              </ul>
            </div>
            <a href="/help" className="block rounded-[var(--radius-card)] border border-pink-line bg-pink-soft p-5 text-sm font-semibold text-pink transition hover:bg-pink-line">Looking for help, not an officer account? Open the confidential request form →</a>
          </aside>
        </div>
      ) : (
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 md:py-8">
          <nav aria-label="Workspace sections" className="mb-5 flex flex-wrap gap-2">
            {canSeeCases && <button type="button" onClick={() => setTab("cases")} aria-current={tab === "cases" ? "page" : undefined} className={`min-h-10 rounded-full border px-4 text-sm font-semibold transition ${tab === "cases" ? "border-pink bg-pink text-white" : "border-line bg-paper hover:bg-pink-soft"}`}>Case work</button>}
            {canSeeAdmin && <button type="button" onClick={() => setTab("admin")} aria-current={tab === "admin" ? "page" : undefined} className={`min-h-10 rounded-full border px-4 text-sm font-semibold transition ${tab === "admin" ? "border-pink bg-pink text-white" : "border-line bg-paper hover:bg-pink-soft"}`}>Administration</button>}
          </nav>
          {tab === "cases" && canSeeCases && <CaseWorkspace token={session.token} user={user} />}
          {tab === "admin" && canSeeAdmin && <AdminConsole token={session.token} user={user} />}
        </div>
      )}
    </main>
  );
}
