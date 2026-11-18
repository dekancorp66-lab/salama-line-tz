import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import {
  ArrowLeft,
  BriefcaseBusiness,
  CircleAlert,
  ClipboardList,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { GlobalControls } from "@/components/global-controls";
import { en } from "@/i18n/en.ts";
import { useI18n, usePageMeta } from "@/i18n/provider.tsx";
import type { Dictionary } from "@/i18n/types.ts";
import { loginStaff } from "@/lib/backend-api";
import {
  canManageCases,
  canManageContent,
  canManageServices,
  canReadAudit,
  clearStaffSession,
  isAdminRole,
  setStaffSession,
  useStaffSession,
} from "@/lib/staff-session";
import { CaseWorkspace } from "@/components/officers/case-workspace";
import { AdminConsole } from "@/components/officers/admin-console";

export const Route = createFileRoute("/institutions")({
  head: () => ({
    meta: [
      { title: en.meta.institutionsTitle },
      { name: "robots", content: "noindex, nofollow" },
      { name: "description", content: en.meta.institutionsDescription },
    ],
  }),
  component: InstitutionsPortal,
});

type WorkspaceSection = "cases" | "admin";

/** Dynamic label lookup with a safe fallback for values the backend may add. */
function label(dictionary: Dictionary, group: keyof Dictionary["labels"], value: string): string {
  const table = dictionary.labels[group] as Record<string, string>;
  return table[value] ?? table[value.toLowerCase()] ?? value.replaceAll("_", " ");
}

interface SectionNavProps {
  canSeeCases: boolean;
  canSeeAdmin: boolean;
  active: WorkspaceSection | null;
  onSelect: (section: WorkspaceSection) => void;
}

function SectionNav({ canSeeCases, canSeeAdmin, active, onSelect }: SectionNavProps) {
  const { t } = useI18n();
  return (
    <div className="space-y-5">
      <div>
        <p className="px-3 text-xs font-semibold uppercase tracking-wide text-muted">
          {t("nav.caseWorkspace")}
        </p>
        {canSeeCases ? (
          <button
            type="button"
            onClick={() => onSelect("cases")}
            aria-current={active === "cases" ? "page" : undefined}
            className={`mt-2 flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 text-sm font-medium transition ${active === "cases" ? "bg-pink-soft font-semibold text-pink ring-1 ring-pink-line" : "text-muted hover:bg-soft hover:text-ink"}`}
          >
            <ClipboardList size={17} className="shrink-0" /> {t("nav.caseQueue")}
          </button>
        ) : (
          <p className="mt-2 px-3 text-xs text-muted">{t("common.notAvailable")}</p>
        )}
      </div>

      <div className="border-t border-line pt-5">
        <p className="px-3 text-xs font-semibold uppercase tracking-wide text-muted">
          {t("admin.title")}
        </p>
        {canSeeAdmin ? (
          <button
            type="button"
            onClick={() => onSelect("admin")}
            aria-current={active === "admin" ? "page" : undefined}
            className={`mt-2 flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 text-sm font-medium transition ${active === "admin" ? "bg-pink-soft font-semibold text-pink ring-1 ring-pink-line" : "text-muted hover:bg-soft hover:text-ink"}`}
          >
            <LayoutDashboard size={17} className="shrink-0" /> {t("nav.adminConsole")}
          </button>
        ) : (
          <p className="mt-2 px-3 text-xs text-muted">{t("common.notAvailable")}</p>
        )}
      </div>
    </div>
  );
}

function ConfidentialNotice() {
  const { t } = useI18n();
  return (
    <div
      role="note"
      className="rounded-[var(--radius-card)] border border-pink-line bg-pink-soft p-4 text-xs leading-relaxed"
    >
      <p className="flex items-center gap-2 font-semibold text-pink">
        <ShieldCheck size={16} className="shrink-0" />
        {t("institutions.confidentialTitle")}
      </p>
      <p className="mt-2 text-ink">
        {t("institutions.confidentialBody")}
      </p>
    </div>
  );
}

function InstitutionsPortal() {
  const { t, dictionary, errorMessage } = useI18n();
  usePageMeta("institutions");
  const session = useStaffSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [section, setSection] = useState<WorkspaceSection>("cases");
  const [navOpen, setNavOpen] = useState(false);

  const user = session.user;
  const signedIn = Boolean(session.token && user);
  const canSeeCases = Boolean(signedIn && user && canManageCases(user.role));
  const canSeeAdmin = Boolean(
    signedIn &&
      user &&
      (isAdminRole(user.role) ||
        canManageContent(user.role) ||
        canManageServices(user.role) ||
        canReadAudit(user.role)),
  );
  // Always land on a section this role can actually open.
  const active: WorkspaceSection | null =
    section === "cases" && canSeeCases
      ? "cases"
      : section === "admin" && canSeeAdmin
        ? "admin"
        : canSeeCases
          ? "cases"
          : canSeeAdmin
            ? "admin"
            : null;

  async function signIn(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await loginStaff(email.trim(), password);
      setStaffSession({ token: result.accessToken, user: result.user });
      setPassword("");
      setSection(canManageCases(result.user.role) ? "cases" : "admin");
      setNavOpen(false);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  function signOut() {
    clearStaffSession();
    setSection("cases");
    setNavOpen(false);
    setError("");
  }

  const activeLabel =
    active === "cases"
      ? t("nav.caseQueue")
      : active === "admin"
        ? t("admin.title")
        : t("nav.noAccess");
  const roleLine = (role: string, districtCode?: string | null) =>
    `${label(dictionary, "roles", role)}${districtCode ? ` · ${districtCode}` : ""}`;

  return (
    <div className="min-h-screen bg-soft text-ink">
      <header className="sticky top-0 z-20 border-b border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 md:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <a
              href="/"
              className="flex shrink-0 items-center gap-2 text-sm font-medium text-muted transition hover:text-ink"
            >
              <ArrowLeft size={17} /> <span className="hidden sm:inline">{t("common.salamaLine")}</span>
            </a>
            <span className="hidden h-5 w-px bg-line sm:block" />
            <span className="brand-text truncate text-lg font-semibold tracking-tight">
              {t("institutions.portalName")}
            </span>
          </div>
          {signedIn && user ? (
            <div className="flex shrink-0 items-center gap-2">
              <GlobalControls />
              <div className="hidden text-right sm:block">
                <p className="text-sm font-semibold">{user.displayName}</p>
                <p className="text-xs text-muted">{roleLine(user.role, user.districtCode)}</p>
              </div>
              <button
                type="button"
                onClick={signOut}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-line bg-paper px-3 text-xs font-semibold text-muted transition hover:border-pink-line hover:bg-pink-soft hover:text-pink"
              >
                <LogOut size={15} /> <span className="hidden sm:inline">{t("common.signOut")}</span>
              </button>
              <button
                type="button"
                onClick={() => setNavOpen((open) => !open)}
                aria-label={navOpen ? t("nav.closeSectionNavigation") : t("nav.openSectionNavigation")}
                aria-expanded={navOpen}
                aria-controls="institutions-section-nav"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-pink-soft text-pink ring-1 ring-pink-line lg:hidden"
              >
                {navOpen ? <X size={18} /> : <Menu size={18} />}
              </button>
            </div>
          ) : (
            <div className="flex shrink-0 items-center gap-2">
              <GlobalControls />
              <span className="inline-flex min-h-10 items-center gap-2 rounded-full border border-line bg-paper px-4 text-xs font-semibold text-muted">
                <Lock size={14} className="text-pink" /> {t("institutions.restrictedAccess")}
              </span>
            </div>
          )}
        </div>

        {signedIn && navOpen && (
          <nav
            id="institutions-section-nav"
            aria-label={t("nav.workspaceSections")}
            className="border-t border-line bg-paper px-4 py-4 sm:px-6 lg:hidden"
          >
            <SectionNav
              canSeeCases={canSeeCases}
              canSeeAdmin={canSeeAdmin}
              active={active}
              onSelect={(next) => {
                setSection(next);
                setNavOpen(false);
              }}
            />
            <div className="mt-5">
              <ConfidentialNotice />
            </div>
          </nav>
        )}
      </header>

      {signedIn && user && session.token ? (
        <main className="mx-auto flex max-w-7xl">
          <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-64 shrink-0 flex-col border-r border-line bg-paper px-4 py-6 lg:flex">
            <div className="flex-1 space-y-5">
              <p className="px-3 text-xs font-semibold uppercase tracking-wide text-muted">
                {t("nav.portalSections")}
              </p>
              <SectionNav
                canSeeCases={canSeeCases}
                canSeeAdmin={canSeeAdmin}
                active={active}
                onSelect={setSection}
              />
              <ConfidentialNotice />
            </div>
            <div className="mt-5 border-t border-line pt-4">
              <p className="truncate text-sm font-semibold">{user.displayName}</p>
              <p className="mt-0.5 truncate text-xs text-muted">{roleLine(user.role, user.districtCode)}</p>
              <button
                type="button"
                onClick={signOut}
                className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-full border border-line px-3 text-xs font-semibold text-muted transition hover:border-pink-line hover:bg-pink-soft hover:text-pink"
              >
                <LogOut size={15} /> {t("common.signOut")}
              </button>
            </div>
          </aside>

          <div className="min-w-0 flex-1 px-4 py-6 sm:px-6 md:py-8">
            <nav aria-label={t("nav.breadcrumb")} className="text-xs text-muted">
              <span className="capitalize">{t("institutions.portalName")}</span> <span aria-hidden> / </span>
              <span className="font-semibold text-ink">{activeLabel}</span>
            </nav>
            <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
                  {activeLabel}
                </h1>
                <p className="mt-1 text-sm text-muted">
                  {active === "cases"
                    ? t("institutions.casesDescription")
                    : t("institutions.adminDescription")}
                </p>
              </div>
              {active === "cases" && canSeeCases && (
                <span className="inline-flex min-h-9 items-center gap-2 rounded-full border border-line bg-paper px-3 text-xs font-medium text-muted">
                  <Users size={14} className="text-pink" /> {t("nav.caseWorkspace")}
                </span>
              )}
            </div>

            {active === "cases" && canSeeCases && session.token && (
              <div className="mt-6 min-w-0">
                <CaseWorkspace token={session.token} user={user} />
              </div>
            )}
            {active === "admin" && canSeeAdmin && session.token && (
              <div className="mt-6 min-w-0">
                <AdminConsole token={session.token} user={user} />
              </div>
            )}
            {!active && (
              <div
                role="alert"
                className="mt-6 flex items-start gap-2 rounded-[var(--radius-card)] border border-pink-line bg-pink-soft p-5 text-sm leading-relaxed"
              >
                <CircleAlert size={17} className="mt-0.5 shrink-0 text-pink" />
                <span>{t("institutions.noAccessBody")}</span>
              </div>
            )}
          </div>
        </main>
      ) : (
        <main className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:px-6 md:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] md:py-14">
          <section className="min-w-0 rounded-[var(--radius-panel)] border border-line bg-paper p-6 shadow-[var(--shadow-soft)] sm:p-9">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-pink-soft text-pink">
              <BriefcaseBusiness size={21} />
            </span>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight md:text-3xl">
              {t("institutions.signInTitle")}
            </h1>
            <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted">
              {t("institutions.signInIntro")}
            </p>
            <form onSubmit={(event) => void signIn(event)} className="mt-7 max-w-md space-y-4">
              {error && (
                <p
                  role="alert"
                  className="flex items-start gap-2 rounded-xl border border-pink-line bg-pink-soft px-3 py-2.5 text-sm leading-relaxed text-pink-hover"
                >
                  <CircleAlert size={16} className="mt-0.5 shrink-0" /> {error}
                </p>
              )}
              <label className="block text-sm font-semibold">
                {t("common.email")}
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="username"
                  className="mt-2 min-h-12 w-full rounded-xl border border-line bg-paper px-3 text-sm outline-none focus:border-pink"
                />
              </label>
              <label className="block text-sm font-semibold">
                {t("common.password")}
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  className="mt-2 min-h-12 w-full rounded-xl border border-line bg-paper px-3 text-sm outline-none focus:border-pink"
                />
              </label>
              <button
                type="submit"
                disabled={busy}
                className="brand-fill min-h-12 w-full rounded-full px-6 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? t("common.signingIn") : t("common.signIn")}
              </button>
            </form>
            <p className="mt-5 flex items-start gap-2 text-xs leading-relaxed text-muted">
              <Lock size={14} className="mt-0.5 shrink-0 text-pink" />
              {t("institutions.noPublicRegistration")}
            </p>
          </section>

          <aside className="space-y-4">
            <div className="rounded-[var(--radius-card)] border border-line bg-paper p-5">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <ShieldCheck size={17} className="text-pink" /> {t("institutions.authorizedOnly")}
              </p>
              <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted">
                {[
                  t("institutions.rule1"),
                  t("institutions.rule2"),
                  t("institutions.rule3"),
                  t("institutions.rule4"),
                  t("institutions.rule5"),
                ].map((line) => (
                  <li key={line} className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-pink" />
                    {line}
                  </li>
                ))}
              </ul>
            </div>
            <ConfidentialNotice />
          </aside>
        </main>
      )}
    </div>
  );
}
