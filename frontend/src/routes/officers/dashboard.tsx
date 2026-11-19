import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { LogOut } from "lucide-react";
import { GlobalControls } from "@/components/global-controls";
import { useI18n, usePageMeta } from "@/i18n/provider.tsx";
import type { Dictionary } from "@/i18n/types.ts";
import {
  canManageCases,
  canManageContent,
  canManageServices,
  canReadAudit,
  clearStaffSession,
  isAdminRole,
  useStaffSession,
  type StaffUser,
} from "@/lib/staff-session";
import { CaseWorkspace } from "@/components/officers/case-workspace";
import { AdminConsole } from "@/components/officers/admin-console";

export const Route = createFileRoute("/officers/dashboard")({
  component: OfficersDashboard,
});

/** Dynamic label lookup with a safe fallback for values the backend may add. */
function label(dictionary: Dictionary, group: keyof Dictionary["labels"], value: string): string {
  const table = dictionary.labels[group] as Record<string, string>;
  return table[value] ?? table[value.toLowerCase()] ?? value.replaceAll("_", " ");
}

function OfficersDashboard() {
  const { t, dictionary } = useI18n();
  usePageMeta("officers");
  const session = useStaffSession();
  const [tab, setTab] = useState<"cases" | "admin">("cases");

  if (!session.token || !session.user) {
    return <Navigate to="/officers/login" />;
  }

  const user: StaffUser = session.user;
  const canSeeCases = canManageCases(user.role);
  const canSeeAdmin = isAdminRole(user.role) || canManageServices(user.role) || canManageContent(user.role) || canReadAudit(user.role);
  const activeTab = tab === "admin" && canSeeAdmin ? "admin" : canSeeCases ? "cases" : canSeeAdmin ? "admin" : "cases";

  return (
    <main className="min-h-screen bg-soft text-ink">
      <header className="sticky top-0 z-20 border-b border-line bg-paper/95 px-4 py-3 backdrop-blur md:px-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="brand-text text-lg font-semibold tracking-tight">{t("officers.workspaceName")}</span>
            <span className="hidden h-5 w-px bg-line sm:block" />
            <span className="truncate text-sm font-medium text-muted">{t("common.officersPortal")}</span>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <GlobalControls />
            <div className="text-right">
              <p className="text-sm font-semibold">{user.displayName}</p>
              <p className="text-xs text-muted">{label(dictionary, "roles", user.role)}{user.districtCode ? ` · ${user.districtCode}` : ""}</p>
            </div>
            <button
              type="button"
              onClick={() => { clearStaffSession(); }}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-line px-3 text-xs font-semibold text-muted transition hover:border-pink-line hover:bg-pink-soft hover:text-pink"
            >
              <LogOut size={15} />{t("common.signOut")}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 md:py-8">
        <nav aria-label={t("nav.workspaceSections")} className="mb-5 flex flex-wrap gap-2">
          {canSeeCases ? (
            <button
              type="button"
              onClick={() => setTab("cases")}
              aria-current={activeTab === "cases" ? "page" : undefined}
              className={`min-h-10 rounded-full border px-4 text-sm font-semibold transition ${activeTab === "cases" ? "border-brand-fill bg-brand-fill text-white" : "border-line bg-paper hover:bg-pink-soft"}`}
            >
              {t("officers.caseWork")}
            </button>
          ) : null}
          {canSeeAdmin ? (
            <button
              type="button"
              onClick={() => setTab("admin")}
              aria-current={activeTab === "admin" ? "page" : undefined}
              className={`min-h-10 rounded-full border px-4 text-sm font-semibold transition ${activeTab === "admin" ? "border-brand-fill bg-brand-fill text-white" : "border-line bg-paper hover:bg-pink-soft"}`}
            >
              {t("admin.title")}
            </button>
          ) : null}
        </nav>

        {!canSeeCases && !canSeeAdmin ? (
          <div role="alert" className="rounded-[var(--radius-card)] border border-pink-line bg-pink-soft p-5 text-sm leading-relaxed text-ink">
            <p className="font-semibold text-pink">{t("nav.noAccess")}</p>
            <p className="mt-1">{t("institutions.noAccessBody")}</p>
          </div>
        ) : null}

        {activeTab === "cases" && canSeeCases ? <CaseWorkspace token={session.token} user={user} /> : null}
        {activeTab === "admin" && canSeeAdmin ? <AdminConsole token={session.token} user={user} /> : null}
      </div>
    </main>
  );
}
