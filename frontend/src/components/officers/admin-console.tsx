import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  Archive, BadgeCheck, CircleAlert, ClipboardCheck, FileCheck2, RefreshCw,
  ScrollText, ShieldCheck, UserCog, Users,
} from "lucide-react";
import { useI18n } from "@/i18n/provider.tsx";
import type { Dictionary } from "@/i18n/types.ts";
import {
  archiveContent, createConsentPolicy, createServiceEntry, getAdminMetrics, listAuditEvents,
  listConsentPolicies, listContentQueue, listResponders, listServicesForReview,
  listUsers, revokeConsentPolicy, sweepExpiredCases, updateResponderAvailability,
  updateUserAccess, verifyService,
  type AdminMetrics, type AuditEvent, type ConsentPolicy, type ContentReviewRecord,
  type ResponderRecord, type ServiceReviewRecord, type StaffUserRecord,
} from "@/lib/backend-api";
import { canManageContent, canManageServices, canReadAudit, isAdminRole, type StaffUser } from "@/lib/staff-session";

interface Props {
  token: string;
  user: StaffUser;
}

type Section = "overview" | "staff" | "responders" | "services" | "content" | "policies" | "audit";

const ROLES = ["RESPONDER", "ADMIN", "CONTENT_REVIEWER", "CONTENT_MANAGER", "SERVICE_MANAGER", "AUDITOR", "PARTNER_ANALYST", "USER", "SUPER_ADMIN"];
const SERVICE_TYPES = ["CLINIC", "LEGAL_AID", "SOCIAL_WELFARE", "SHELTER", "COUNSELLING", "OTHER"];

/** Dynamic label lookup with a safe fallback for values the backend may add. */
function label(dictionary: Dictionary, group: keyof Dictionary["labels"], value: string): string {
  const table = dictionary.labels[group] as Record<string, string>;
  return table[value] ?? table[value.toLowerCase()] ?? value.replaceAll("_", " ");
}

export function AdminConsole({ token, user }: Props) {
  const { t, dictionary, errorMessage } = useI18n();
  const admin = isAdminRole(user.role);
  const [section, setSection] = useState<Section>("overview");
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [users, setUsers] = useState<StaffUserRecord[]>([]);
  const [responders, setResponders] = useState<ResponderRecord[]>([]);
  const [services, setServices] = useState<ServiceReviewRecord[]>([]);
  const [content, setContent] = useState<ContentReviewRecord[]>([]);
  const [policies, setPolicies] = useState<ConsentPolicy[]>([]);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [policyVersion, setPolicyVersion] = useState("");
  const [policyWording, setPolicyWording] = useState("");
  const [serviceType, setServiceType] = useState("CLINIC");
  const [serviceName, setServiceName] = useState("");
  const [serviceDistrict, setServiceDistrict] = useState("");
  const [serviceRegion, setServiceRegion] = useState("");
  const [verificationOrg, setVerificationOrg] = useState("");
  const [verifiedBy, setVerifiedBy] = useState("");
  const [verifiedAt, setVerifiedAt] = useState("");

  const setError = (key: string, value: string) => setErrors((previous) => ({ ...previous, [key]: value }));

  const load = useCallback(async () => {
    // The backend class-level guard reserves these endpoints for administrators;
    // non-admin reviewers only fetch the queues their role can actually read.
    const tasks: Array<[string, () => Promise<unknown>, (value: never) => void]> = [];
    if (admin) {
      tasks.push(
        ["overview", () => getAdminMetrics(token), (value) => setMetrics(value as AdminMetrics)],
        ["users", () => listUsers(token), (value) => setUsers(value as StaffUserRecord[])],
        ["responders", () => listResponders(token), (value) => setResponders(value as ResponderRecord[])],
        ["policies", () => listConsentPolicies(token), (value) => setPolicies(value as ConsentPolicy[])],
      );
    }
    if (canManageServices(user.role)) tasks.push(["services", () => listServicesForReview(token), (value) => setServices(value as ServiceReviewRecord[])]);
    if (canManageContent(user.role)) tasks.push(["content", () => listContentQueue(token), (value) => setContent(value as ContentReviewRecord[])]);
    if (canReadAudit(user.role)) tasks.push(["audit", () => listAuditEvents(token), (value) => setAudit(value as AuditEvent[])]);

    await Promise.all(tasks.map(async ([key, fetcher, setter]) => {
      try { setter(await fetcher() as never); setError(key, ""); }
      catch (cause) { setError(key, errorMessage(cause)); }
    }));
  }, [admin, errorMessage, token, user.role]);

  useEffect(() => { void load(); }, [load]);

  async function run(key: string, action: () => Promise<unknown>, success: string) {
    setBusy(true); setNotice(""); setError(key, "");
    try { await action(); setNotice(success); await load(); }
    catch (cause) { setError(key, errorMessage(cause)); }
    finally { setBusy(false); }
  }

  const sections: Array<{ id: Section; label: string; icon: typeof Users }> = [
    { id: "overview", label: t("admin.overview"), icon: ClipboardCheck },
    { id: "staff", label: t("admin.staffAccounts"), icon: Users },
    { id: "responders", label: t("admin.responders"), icon: UserCog },
    { id: "services", label: t("admin.serviceDirectory"), icon: BadgeCheck },
    { id: "content", label: t("admin.contentReview"), icon: FileCheck2 },
    { id: "policies", label: t("admin.consentPolicies"), icon: ShieldCheck },
    { id: "audit", label: t("admin.auditLog"), icon: ScrollText },
  ];
  const visible = sections.filter((item) => {
    if (item.id === "services") return canManageServices(user.role);
    if (item.id === "content") return canManageContent(user.role);
    if (item.id === "audit") return canReadAudit(user.role);
    return admin; // overview, staff, responders and policies are admin-only
  });
  const activeSection: Section = visible.some((item) => item.id === section) ? section : visible[0]?.id ?? "overview";

  const metricCards: [string, string | number][] = [
    [t("admin.totalCases"), metrics?.cases ?? "—"],
    [t("admin.approvedContent"), metrics?.approvedContent ?? "—"],
    [t("admin.verifiedServices"), metrics?.verifiedServices ?? "—"],
  ];
  const serviceFields: [string, string, (value: string) => void, string][] = [
    [t("admin.name"), serviceName, setServiceName, t("admin.namePlaceholder")],
    [t("caseWorkspace.district"), serviceDistrict, setServiceDistrict, t("admin.districtPlaceholder")],
    [t("services.region"), serviceRegion, setServiceRegion, t("admin.regionPlaceholder")],
    [t("admin.verificationOrg"), verificationOrg, setVerificationOrg, t("admin.verificationOrgPlaceholder")],
    [t("admin.verifiedBy"), verifiedBy, setVerifiedBy, t("admin.verifiedByPlaceholder")],
  ];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{t("admin.title")}</h2>
        <p className="mt-1 text-sm text-muted">{t("admin.intro")}</p>
      </div>

      <nav aria-label={t("admin.sectionsLabel")} className="flex flex-wrap gap-2">
        {visible.map((item) => {
          const Icon = item.icon;
          return (
            <button key={item.id} type="button" onClick={() => setSection(item.id)} aria-current={activeSection === item.id ? "page" : undefined} className={`inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-semibold transition ${activeSection === item.id ? "border-pink bg-pink text-white" : "border-line bg-paper text-ink hover:border-pink-line hover:bg-pink-soft"}`}>
              <Icon size={15} />{item.label}
            </button>
          );
        })}
        <button type="button" onClick={() => void load()} className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-line bg-paper px-3.5 py-2 text-xs font-medium text-ink hover:bg-pink-soft"><RefreshCw size={14} />{t("admin.reload")}</button>
      </nav>

      {notice && <p role="status" className="rounded-xl border border-line bg-soft px-3 py-2 text-sm">{notice}</p>}
      {Object.entries(errors).filter(([, value]) => value).map(([key, value]) => (
        <p key={key} role="alert" className="flex items-start gap-2 rounded-xl border border-pink-line bg-pink-soft px-3 py-2 text-sm text-pink-hover"><CircleAlert size={16} className="mt-0.5 shrink-0" />{value}</p>
      ))}

      {activeSection === "overview" && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {metricCards.map(([labelText, value]) => (
              <div key={labelText} className="rounded-[var(--radius-card)] border border-line bg-paper p-5">
                <p className="text-3xl font-semibold">{String(value)}</p><p className="mt-1 text-sm text-muted">{labelText}</p>
              </div>
            ))}
          </div>
          {metrics?.smallCountsSuppressed && <p className="text-xs text-muted">{t("admin.suppressionNote")}</p>}
          {admin && (
            <div className="rounded-[var(--radius-card)] border border-line bg-paper p-5">
              <p className="font-semibold">{t("admin.retentionTitle")}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted">{t("admin.retentionBody")}</p>
              <button type="button" disabled={busy} onClick={() => void run("overview", () => sweepExpiredCases(token), t("admin.retentionSuccess"))} className="mt-3 min-h-10 rounded-xl border border-pink px-4 text-sm font-semibold text-pink transition hover:bg-pink-soft disabled:opacity-40">{t("admin.runSweep")}</button>
            </div>
          )}
        </div>
      )}

      {activeSection === "staff" && (
        <div className="space-y-3">
          {users.length === 0 && <p className="text-sm text-muted">{t("admin.noStaff")}</p>}
          {users.map((item) => <UserRow key={item.id} item={item} token={token} admin={admin} busy={busy} onRun={(action, message) => void run("users", action, message)} />)}
        </div>
      )}

      {activeSection === "responders" && (
        <div className="space-y-3">
          {responders.length === 0 && <p className="text-sm text-muted">{t("admin.noResponders")}</p>}
          {responders.map((item) => {
            const profile = item.responderProfile;
            return (
              <div key={item.id} className="flex flex-wrap items-center gap-3 rounded-[var(--radius-card)] border border-line bg-paper p-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{item.displayName}</p>
                  <p className="text-xs text-muted">{item.email} · {item.districtCode ?? t("admin.noDistrict")} · {item.isActive ? t("admin.active") : t("admin.inactive")}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${profile?.available ? "bg-pink-soft text-pink" : "bg-soft text-muted"}`}>{profile?.available ? t("admin.available") : t("admin.unavailable")}</span>
                <form onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); void run("responders", () => updateResponderAvailability(token, item.id, {
                  available: data.get("available") === "true",
                  districtCode: String(data.get("districtCode") ?? "").toUpperCase(),
                  maxActiveCases: Number(data.get("maxActiveCases") ?? 10),
                }), t("admin.availabilityUpdated")); }} className="flex flex-wrap items-center gap-2">
                  <select name="available" defaultValue={String(profile?.available ?? false)} aria-label={t("admin.availability")} className="min-h-10 rounded-xl border border-line bg-paper px-2 text-xs"><option value="true">{t("admin.available")}</option><option value="false">{t("admin.unavailable")}</option></select>
                  <input name="districtCode" defaultValue={item.districtCode ?? ""} maxLength={20} placeholder={t("caseWorkspace.district")} aria-label={t("caseWorkspace.district")} className="min-h-10 w-24 rounded-xl border border-line bg-paper px-2 text-xs" />
                  <input name="maxActiveCases" type="number" min={1} max={50} defaultValue={profile?.maxActiveCases ?? 10} aria-label={t("admin.maxActiveCases")} className="min-h-10 w-16 rounded-xl border border-line bg-paper px-2 text-xs" />
                  <button type="submit" disabled={busy} className="min-h-10 rounded-xl border border-line px-3 text-xs font-semibold hover:bg-pink-soft disabled:opacity-40">{t("common.save")}</button>
                </form>
              </div>
            );
          })}
        </div>
      )}

      {activeSection === "services" && (
        <div className="space-y-4">
          <form onSubmit={(event) => {
            event.preventDefault();
            void run("services", () => createServiceEntry(token, {
              name: serviceName, type: serviceType, districtCode: serviceDistrict.toUpperCase(),
              region: serviceRegion, verificationOrg, verifiedBy,
              verifiedAt: new Date(verifiedAt).toISOString(),
            }), t("admin.serviceDraftSuccess")).then(() => {
              setServiceName(""); setServiceDistrict(""); setServiceRegion(""); setVerificationOrg(""); setVerifiedBy(""); setVerifiedAt("");
            });
          }} className="grid gap-2 rounded-[var(--radius-card)] border border-line bg-paper p-4 sm:grid-cols-2">
            <p className="sm:col-span-2 text-sm font-semibold">{t("admin.addServiceTitle")}</p>
            {serviceFields.map(([labelText, value, setter, placeholder]) => (
              <label key={labelText} className="text-xs font-medium text-muted">
                {labelText}
                <input value={value} onChange={(event) => setter(event.target.value)} placeholder={placeholder} className="mt-1 min-h-10 w-full rounded-xl border border-line bg-paper px-3 text-sm text-ink outline-none focus:border-pink" />
              </label>
            ))}
            <label className="text-xs font-medium text-muted">{t("admin.type")}
              <select value={serviceType} onChange={(event) => setServiceType(event.target.value)} className="mt-1 min-h-10 w-full rounded-xl border border-line bg-paper px-3 text-sm text-ink">{SERVICE_TYPES.map((type) => <option key={type} value={type}>{label(dictionary, "serviceTypes", type)}</option>)}</select>
            </label>
            <label className="text-xs font-medium text-muted">{t("admin.verificationDate")}
              <input type="date" value={verifiedAt} onChange={(event) => setVerifiedAt(event.target.value)} className="mt-1 min-h-10 w-full rounded-xl border border-line bg-paper px-3 text-sm text-ink" />
            </label>
            <button type="submit" disabled={busy || !serviceName || !verifiedAt} className="brand-fill sm:col-span-2 min-h-10 rounded-xl px-4 text-sm font-semibold text-white disabled:opacity-40">{t("admin.saveDraft")}</button>
          </form>
          {services.map((item) => (
            <div key={item.id} className="flex flex-wrap items-center gap-3 rounded-[var(--radius-card)] border border-line bg-paper p-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{item.name}</p>
                <p className="text-xs text-muted">{label(dictionary, "serviceTypes", item.type)} · {item.districtCode} · {item.verificationOrg} · {item.isActive ? t("admin.active") : t("admin.inactiveDraft")}</p>
              </div>
              <form onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); void run("services", () => verifyService(token, item.id, {
                isActive: data.get("isActive") === "true",
                expiresAt: String(data.get("expiresAt") ?? "") ? new Date(String(data.get("expiresAt"))).toISOString() : undefined,
              }), t("admin.serviceVerificationSuccess")); }} className="flex flex-wrap items-center gap-2">
                <select name="isActive" defaultValue={String(item.isActive)} aria-label={t("admin.publishedState")} className="min-h-10 rounded-xl border border-line bg-paper px-2 text-xs"><option value="false">{t("admin.inactive")}</option><option value="true">{t("admin.active")}</option></select>
                <input name="expiresAt" type="date" defaultValue={item.expiresAt ? item.expiresAt.slice(0, 10) : ""} aria-label={t("admin.verificationExpiry")} className="min-h-10 rounded-xl border border-line bg-paper px-2 text-xs" />
                <button type="submit" disabled={busy} className="min-h-10 rounded-xl border border-line px-3 text-xs font-semibold hover:bg-pink-soft disabled:opacity-40">{t("common.save")}</button>
              </form>
            </div>
          ))}
        </div>
      )}

      {activeSection === "content" && (
        <div className="space-y-3">
          {content.length === 0 && <p className="text-sm text-muted">{t("admin.noContent")}</p>}
          {content.map((item) => (
            <div key={item.id} className="flex flex-wrap items-center gap-3 rounded-[var(--radius-card)] border border-line bg-paper p-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{item.title}</p>
                <p className="text-xs text-muted">{item.slug} · {item.language} · {label(dictionary, "topics", item.topic)} · {label(dictionary, "auditOutcomes", item.status)} · {t("admin.source")} {item.sourceName}</p>
              </div>
              <button type="button" disabled={busy} onClick={() => void run("content", () => archiveContent(token, item.id), t("admin.contentArchived"))} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-line px-3 text-xs font-semibold hover:bg-pink-soft disabled:opacity-40"><Archive size={14} />{t("admin.archive")}</button>
            </div>
          ))}
        </div>
      )}

      {activeSection === "policies" && (
        <div className="space-y-4">
          <form onSubmit={(event) => { event.preventDefault(); void run("policies", () => createConsentPolicy(token, policyVersion.trim(), policyWording.trim()), t("admin.policyCreated")).then(() => { setPolicyVersion(""); setPolicyWording(""); }); }} className="space-y-2 rounded-[var(--radius-card)] border border-line bg-paper p-4">
            <p className="text-sm font-semibold">{t("admin.newPolicyTitle")}</p>
            <input value={policyVersion} onChange={(event) => setPolicyVersion(event.target.value)} maxLength={80} placeholder={t("admin.policyVersionPlaceholder")} aria-label={t("admin.policyVersion")} className="min-h-11 w-full rounded-xl border border-line px-3 text-sm outline-none focus:border-pink" />
            <textarea value={policyWording} onChange={(event) => setPolicyWording(event.target.value)} minLength={20} maxLength={4000} rows={3} placeholder={t("admin.policyWordingPlaceholder")} aria-label={t("admin.policyWording")} className="w-full resize-y rounded-xl border border-line px-3 py-2.5 text-sm outline-none focus:border-pink" />
            <button type="submit" disabled={busy || policyVersion.length < 3 || policyWording.length < 20} className="brand-fill min-h-10 rounded-xl px-4 text-sm font-semibold text-white disabled:opacity-40">{t("admin.createPolicy")}</button>
          </form>
          {policies.map((item) => (
            <div key={item.id} className="flex flex-wrap items-center gap-3 rounded-[var(--radius-card)] border border-line bg-paper p-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{item.version} {item.revokedAt && <span className="text-xs text-pink">{t("admin.revoked")}</span>}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted">{item.wording}</p>
              </div>
              {!item.revokedAt && <button type="button" disabled={busy} onClick={() => void run("policies", () => revokeConsentPolicy(token, item.id), t("admin.policyRevoked"))} className="min-h-10 rounded-xl border border-line px-3 text-xs font-semibold hover:bg-pink-soft disabled:opacity-40">{t("admin.revoke")}</button>}
            </div>
          ))}
        </div>
      )}

      {activeSection === "audit" && (
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line bg-paper">
          <table className="w-full min-w-[600px] text-left text-xs">
            <thead className="bg-soft text-muted"><tr><th className="p-3">{t("admin.when")}</th><th className="p-3">{t("admin.action")}</th><th className="p-3">{t("admin.resource")}</th><th className="p-3">{t("admin.outcome")}</th><th className="p-3">{t("admin.actor")}</th></tr></thead>
            <tbody>
              {audit.length === 0 ? <tr><td colSpan={5} className="p-4 text-muted">{t("admin.noAuditEvents")}</td></tr> : audit.map((item) => (
                <tr key={item.id} className="border-t border-line">
                  <td className="p-3 text-muted">{new Date(item.createdAt).toLocaleString()}</td>
                  <td className="p-3 font-medium">{item.action}</td>
                  <td className="p-3 text-muted">{item.resourceType}{item.resourceId ? ` · ${item.resourceId.slice(0, 8)}` : ""}</td>
                  <td className="p-3 text-muted">{label(dictionary, "auditOutcomes", item.outcome)}</td>
                  <td className="p-3 font-mono text-muted">{item.actorUserId?.slice(0, 8) ?? t("admin.system")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function UserRow({ item, token, admin, busy, onRun }: {
  item: StaffUserRecord;
  token: string;
  admin: boolean;
  busy: boolean;
  onRun: (action: () => Promise<unknown>, message: string) => void;
}) {
  const { t, dictionary } = useI18n();
  const [role, setRole] = useState(item.role);
  const [district, setDistrict] = useState(item.districtCode ?? "");
  return (
    <form onSubmit={(event) => {
      event.preventDefault();
      const active = (new FormData(event.currentTarget).get("active") === "true");
      onRun(() => updateUserAccess(token, item.id, { isActive: active, role, districtCode: district }), t("admin.accountUpdated"));
    }} className="flex flex-wrap items-center gap-2 rounded-[var(--radius-card)] border border-line bg-paper p-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{item.displayName}</p>
        <p className="text-xs text-muted">{item.email} · {item.isActive ? t("admin.active") : t("admin.inactive")}</p>
      </div>
      <select name="active" defaultValue={String(item.isActive)} aria-label={t("admin.accountActive")} className="min-h-10 rounded-xl border border-line px-2 text-xs"><option value="true">{t("admin.active")}</option><option value="false">{t("admin.inactive")}</option></select>
      <select value={role} onChange={(event) => setRole(event.target.value)} disabled={!admin} aria-label={t("admin.role")} className="min-h-10 rounded-xl border border-line px-2 text-xs disabled:opacity-40">
        {(admin ? ROLES : [item.role]).map((option) => <option key={option} value={option}>{label(dictionary, "roles", option)}</option>)}
      </select>
      <input value={district} onChange={(event) => setDistrict(event.target.value.toUpperCase())} maxLength={20} placeholder={t("caseWorkspace.district")} aria-label={t("caseWorkspace.district")} className="min-h-10 w-24 rounded-xl border border-line px-2 text-xs" />
      <button type="submit" disabled={busy} className="min-h-10 rounded-xl border border-line px-3 text-xs font-semibold hover:bg-pink-soft disabled:opacity-40">{t("common.save")}</button>
    </form>
  );
}
