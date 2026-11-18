import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { BriefcaseBusiness, CircleAlert, Lock, ShieldCheck } from "lucide-react";
import { GlobalControls } from "@/components/global-controls";
import { useI18n, usePageMeta } from "@/i18n/provider.tsx";
import { loginStaff } from "@/lib/backend-api";
import { setStaffSession, useStaffSession } from "@/lib/staff-session";

export const Route = createFileRoute("/officers/login")({
  component: OfficersLogin,
});

function OfficersLogin() {
  const { t, errorMessage } = useI18n();
  usePageMeta("officers");
  const session = useStaffSession();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (session.token && session.user) {
    return <Navigate to="/officers/dashboard" />;
  }

  async function signIn(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await loginStaff(email.trim(), password);
      setStaffSession({ token: result.accessToken, user: result.user });
      setPassword("");
      await navigate({ to: "/officers/dashboard" });
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-soft text-ink">
      <header className="sticky top-0 z-20 border-b border-line bg-paper/95 px-4 py-3 backdrop-blur md:px-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="brand-text text-lg font-semibold tracking-tight">{t("officers.workspaceName")}</span>
            <span className="hidden h-5 w-px bg-line sm:block" />
            <span className="text-sm font-medium text-muted">{t("common.officersPortal")}</span>
          </div>
          <div className="flex items-center gap-3">
            <GlobalControls />
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-5xl gap-6 px-4 py-8 sm:px-6 md:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] md:py-14">
        <section className="rounded-[var(--radius-panel)] border border-line bg-paper p-6 shadow-[var(--shadow-soft)] sm:p-9">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-pink-soft text-pink"><BriefcaseBusiness size={21} /></span>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight md:text-3xl">{t("officers.signInTitle")}</h1>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted">{t("officers.signInIntro")}</p>
          <form onSubmit={(event) => void signIn(event)} className="mt-7 max-w-md space-y-4">
            {error ? <p role="alert" className="flex items-start gap-2 rounded-xl border border-pink-line bg-pink-soft px-3 py-2.5 text-sm leading-relaxed text-pink-hover"><CircleAlert size={16} className="mt-0.5 shrink-0" />{error}</p> : null}
            <label className="block text-sm font-semibold">{t("common.email")}
              <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" className="mt-2 min-h-12 w-full rounded-xl border border-line bg-paper px-3 text-sm outline-none focus:border-pink" />
            </label>
            <label className="block text-sm font-semibold">{t("common.password")}
              <input type="password" required value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" className="mt-2 min-h-12 w-full rounded-xl border border-line bg-paper px-3 text-sm outline-none focus:border-pink" />
            </label>
            <button type="submit" disabled={busy} className="brand-fill min-h-12 w-full rounded-full px-6 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{busy ? t("common.signingIn") : t("common.signIn")}</button>
          </form>
          <p className="mt-5 flex items-center gap-2 text-xs text-muted"><Lock size={14} className="text-pink" />{t("officers.sessionNote")}</p>
        </section>

        <aside className="space-y-4">
          <div className="rounded-[var(--radius-card)] border border-line bg-paper p-5">
            <p className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck size={17} className="text-pink" />{t("officers.safeguardingTitle")}</p>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted">
              {[t("officers.rule1"), t("officers.rule2"), t("officers.rule3"), t("officers.rule4"), t("officers.rule5")].map((line) => (
                <li key={line} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-pink" />{line}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-[var(--radius-card)] border border-pink-line bg-pink-soft p-5 text-sm leading-relaxed text-ink">
            <p className="font-semibold text-pink">{t("institutions.authorizedOnly")}</p>
            <p className="mt-2 text-xs text-muted">{t("institutions.confidentialBody")}</p>
          </div>
        </aside>
      </div>
    </main>
  );
}
