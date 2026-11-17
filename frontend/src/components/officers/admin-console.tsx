import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  Archive, BadgeCheck, CircleAlert, ClipboardCheck, FileCheck2, RefreshCw,
  ScrollText, ShieldCheck, UserCog, Users,
} from "lucide-react";
import { ApiError } from "@/lib/api-client";
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

function messageOf(cause: unknown) {
  return cause instanceof ApiError || cause instanceof Error ? cause.message : "Something went wrong.";
}

export function AdminConsole({ token, user }: Props) {
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
      catch (cause) { setError(key, messageOf(cause)); }
    }));
  }, [admin, token, user.role]);

  useEffect(() => { void load(); }, [load]);

  async function run(key: string, action: () => Promise<unknown>, success: string) {
    setBusy(true); setNotice(""); setError(key, "");
    try { await action(); setNotice(success); await load(); }
    catch (cause) { setError(key, messageOf(cause)); }
    finally { setBusy(false); }
  }

  const sections: Array<{ id: Section; label: string; icon: typeof Users }> = [
    { id: "overview", label: "Overview", icon: ClipboardCheck },
    { id: "staff", label: "Staff accounts", icon: Users },
    { id: "responders", label: "Responders", icon: UserCog },
    { id: "services", label: "Service directory", icon: BadgeCheck },
    { id: "content", label: "Content review", icon: FileCheck2 },
    { id: "policies", label: "Consent policies", icon: ShieldCheck },
    { id: "audit", label: "Audit log", icon: ScrollText },
  ];
  const visible = sections.filter((item) => {
    if (item.id === "services") return canManageServices(user.role);
    if (item.id === "content") return canManageContent(user.role);
    if (item.id === "audit") return canReadAudit(user.role);
    return admin; // overview, staff, responders and policies are admin-only
  });
  const activeSection: Section = visible.some((item) => item.id === section) ? section : visible[0]?.id ?? "overview";

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Administration</h2>
        <p className="mt-1 text-sm text-muted">Manage the people, reviewed information and safeguards behind case work.</p>
      </div>

      <nav aria-label="Administration sections" className="flex flex-wrap gap-2">
        {visible.map((item) => {
          const Icon = item.icon;
          return (
            <button key={item.id} type="button" onClick={() => setSection(item.id)} aria-current={activeSection === item.id ? "page" : undefined} className={`inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-semibold transition ${activeSection === item.id ? "border-pink bg-pink text-white" : "border-line bg-paper text-ink hover:border-pink-line hover:bg-pink-soft"}`}>
              <Icon size={15} />{item.label}
            </button>
          );
        })}
        <button type="button" onClick={() => void load()} className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-line bg-paper px-3.5 py-2 text-xs font-medium text-ink hover:bg-pink-soft"><RefreshCw size={14} />Reload</button>
      </nav>

      {notice && <p role="status" className="rounded-xl border border-line bg-soft px-3 py-2 text-sm">{notice}</p>}
      {Object.entries(errors).filter(([, value]) => value).map(([key, value]) => (
        <p key={key} role="alert" className="flex items-start gap-2 rounded-xl border border-pink-line bg-pink-soft px-3 py-2 text-sm text-pink-hover"><CircleAlert size={16} className="mt-0.5 shrink-0" />{value}</p>
      ))}

      {activeSection === "overview" && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ["Total cases", metrics?.cases ?? "—"],
              ["Approved content", metrics?.approvedContent ?? "—"],
              ["Verified services", metrics?.verifiedServices ?? "—"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-[var(--radius-card)] border border-line bg-paper p-5">
                <p className="text-3xl font-semibold">{String(value)}</p><p className="mt-1 text-sm text-muted">{label}</p>
              </div>
            ))}
          </div>
          {metrics?.smallCountsSuppressed && <p className="text-xs text-muted">Case counts below five are suppressed so no individual can be identified.</p>}
          {admin && (
            <div className="rounded-[var(--radius-card)] border border-line bg-paper p-5">
              <p className="font-semibold">Retention sweep</p>
              <p className="mt-1 text-sm leading-relaxed text-muted">Expires open cases past the configured retention window and wipes their contact identifiers. It never contacts a third party.</p>
              <button type="button" disabled={busy} onClick={() => void run("overview", () => sweepExpiredCases(token), "Retention sweep completed.")} className="mt-3 min-h-10 rounded-xl border border-pink px-4 text-sm font-semibold text-pink transition hover:bg-pink-soft disabled:opacity-40">Run sweep</button>
            </div>
          )}
        </div>
      )}

      {activeSection === "staff" && (
        <div className="space-y-3">
          {users.length === 0 && <p className="text-sm text-muted">No staff accounts returned.</p>}
          {users.map((item) => <UserRow key={item.id} item={item} token={token} admin={admin} busy={busy} onRun={(action, message) => void run("users", action, message)} />)}
        </div>
      )}

      {activeSection === "responders" && (
        <div className="space-y-3">
          {responders.length === 0 && <p className="text-sm text-muted">No responders found.</p>}
          {responders.map((item) => {
            const profile = item.responderProfile;
            return (
              <div key={item.id} className="flex flex-wrap items-center gap-3 rounded-[var(--radius-card)] border border-line bg-paper p-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{item.displayName}</p>
                  <p className="text-xs text-muted">{item.email} · {item.districtCode ?? "no district"} · {item.isActive ? "active" : "inactive"}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${profile?.available ? "bg-pink-soft text-pink" : "bg-soft text-muted"}`}>{profile?.available ? "available" : "unavailable"}</span>
                <form onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); void run("responders", () => updateResponderAvailability(token, item.id, {
                  available: data.get("available") === "true",
                  districtCode: String(data.get("districtCode") ?? "").toUpperCase(),
                  maxActiveCases: Number(data.get("maxActiveCases") ?? 10),
                }), "Responder availability updated."); }} className="flex flex-wrap items-center gap-2">
                  <select name="available" defaultValue={String(profile?.available ?? false)} aria-label="Availability" className="min-h-10 rounded-xl border border-line bg-paper px-2 text-xs"><option value="true">Available</option><option value="false">Unavailable</option></select>
                  <input name="districtCode" defaultValue={item.districtCode ?? ""} maxLength={20} placeholder="District" aria-label="District" className="min-h-10 w-24 rounded-xl border border-line bg-paper px-2 text-xs" />
                  <input name="maxActiveCases" type="number" min={1} max={50} defaultValue={profile?.maxActiveCases ?? 10} aria-label="Maximum active cases" className="min-h-10 w-16 rounded-xl border border-line bg-paper px-2 text-xs" />
                  <button type="submit" disabled={busy} className="min-h-10 rounded-xl border border-line px-3 text-xs font-semibold hover:bg-pink-soft disabled:opacity-40">Save</button>
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
            }), "Service saved as a draft. Verify it before it can be used for referrals.").then(() => {
              setServiceName(""); setServiceDistrict(""); setServiceRegion(""); setVerificationOrg(""); setVerifiedBy(""); setVerifiedAt("");
            });
          }} className="grid gap-2 rounded-[var(--radius-card)] border border-line bg-paper p-4 sm:grid-cols-2">
            <p className="sm:col-span-2 text-sm font-semibold">Add a service entry (starts inactive)</p>
            {[
              ["Name", serviceName, setServiceName, "e.g. Mbeya Health Clinic"],
              ["District", serviceDistrict, setServiceDistrict, "MBEYA"],
              ["Region", serviceRegion, setServiceRegion, "Mbeya"],
              ["Verification organisation", verificationOrg, setVerificationOrg, "District Health Office"],
              ["Verified by", verifiedBy, setVerifiedBy, "reviewer-id"],
            ].map(([label, value, setter, placeholder]) => (
              <label key={String(label)} className="text-xs font-medium text-muted">
                {String(label)}
                <input value={String(value)} onChange={(event) => (setter as (value: string) => void)(event.target.value)} placeholder={String(placeholder)} className="mt-1 min-h-10 w-full rounded-xl border border-line bg-paper px-3 text-sm text-ink outline-none focus:border-pink" />
              </label>
            ))}
            <label className="text-xs font-medium text-muted">Type
              <select value={serviceType} onChange={(event) => setServiceType(event.target.value)} className="mt-1 min-h-10 w-full rounded-xl border border-line bg-paper px-3 text-sm text-ink">{SERVICE_TYPES.map((type) => <option key={type} value={type}>{type.replaceAll("_", " ")}</option>)}</select>
            </label>
            <label className="text-xs font-medium text-muted">Verification date
              <input type="date" value={verifiedAt} onChange={(event) => setVerifiedAt(event.target.value)} className="mt-1 min-h-10 w-full rounded-xl border border-line bg-paper px-3 text-sm text-ink" />
            </label>
            <button type="submit" disabled={busy || !serviceName || !verifiedAt} className="brand-fill sm:col-span-2 min-h-10 rounded-xl px-4 text-sm font-semibold text-white disabled:opacity-40">Save draft</button>
          </form>
          {services.map((item) => (
            <div key={item.id} className="flex flex-wrap items-center gap-3 rounded-[var(--radius-card)] border border-line bg-paper p-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{item.name}</p>
                <p className="text-xs text-muted">{item.type.replaceAll("_", " ")} · {item.districtCode} · {item.verificationOrg} · {item.isActive ? "active" : "inactive draft"}</p>
              </div>
              <form onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); void run("services", () => verifyService(token, item.id, {
                isActive: data.get("isActive") === "true",
                expiresAt: String(data.get("expiresAt") ?? "") ? new Date(String(data.get("expiresAt"))).toISOString() : undefined,
              }), "Service verification updated."); }} className="flex flex-wrap items-center gap-2">
                <select name="isActive" defaultValue={String(item.isActive)} aria-label="Published state" className="min-h-10 rounded-xl border border-line bg-paper px-2 text-xs"><option value="false">Inactive</option><option value="true">Active</option></select>
                <input name="expiresAt" type="date" defaultValue={item.expiresAt ? item.expiresAt.slice(0, 10) : ""} aria-label="Verification expiry" className="min-h-10 rounded-xl border border-line bg-paper px-2 text-xs" />
                <button type="submit" disabled={busy} className="min-h-10 rounded-xl border border-line px-3 text-xs font-semibold hover:bg-pink-soft disabled:opacity-40">Save</button>
              </form>
            </div>
          ))}
        </div>
      )}

      {activeSection === "content" && (
        <div className="space-y-3">
          {content.length === 0 && <p className="text-sm text-muted">No content awaiting review.</p>}
          {content.map((item) => (
            <div key={item.id} className="flex flex-wrap items-center gap-3 rounded-[var(--radius-card)] border border-line bg-paper p-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{item.title}</p>
                <p className="text-xs text-muted">{item.slug} · {item.language} · {item.topic} · {item.status} · source: {item.sourceName}</p>
              </div>
              <button type="button" disabled={busy} onClick={() => void run("content", () => archiveContent(token, item.id), "Content archived.")} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-line px-3 text-xs font-semibold hover:bg-pink-soft disabled:opacity-40"><Archive size={14} />Archive</button>
            </div>
          ))}
        </div>
      )}

      {activeSection === "policies" && (
        <div className="space-y-4">
          <form onSubmit={(event) => { event.preventDefault(); void run("policies", () => createConsentPolicy(token, policyVersion.trim(), policyWording.trim()), "Consent policy created.").then(() => { setPolicyVersion(""); setPolicyWording(""); }); }} className="space-y-2 rounded-[var(--radius-card)] border border-line bg-paper p-4">
            <p className="text-sm font-semibold">New consent wording</p>
            <input value={policyVersion} onChange={(event) => setPolicyVersion(event.target.value)} maxLength={80} placeholder="salama-consent-v2" aria-label="Policy version" className="min-h-11 w-full rounded-xl border border-line px-3 text-sm outline-none focus:border-pink" />
            <textarea value={policyWording} onChange={(event) => setPolicyWording(event.target.value)} minLength={20} maxLength={4000} rows={3} placeholder="Plain-language explanation of what the consent allows and how to withdraw it." aria-label="Policy wording" className="w-full resize-y rounded-xl border border-line px-3 py-2.5 text-sm outline-none focus:border-pink" />
            <button type="submit" disabled={busy || policyVersion.length < 3 || policyWording.length < 20} className="brand-fill min-h-10 rounded-xl px-4 text-sm font-semibold text-white disabled:opacity-40">Create policy</button>
          </form>
          {policies.map((item) => (
            <div key={item.id} className="flex flex-wrap items-center gap-3 rounded-[var(--radius-card)] border border-line bg-paper p-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{item.version} {item.revokedAt && <span className="text-xs text-pink">(revoked)</span>}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted">{item.wording}</p>
              </div>
              {!item.revokedAt && <button type="button" disabled={busy} onClick={() => void run("policies", () => revokeConsentPolicy(token, item.id), "Consent policy revoked.")} className="min-h-10 rounded-xl border border-line px-3 text-xs font-semibold hover:bg-pink-soft disabled:opacity-40">Revoke</button>}
            </div>
          ))}
        </div>
      )}

      {activeSection === "audit" && (
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line bg-paper">
          <table className="w-full min-w-[600px] text-left text-xs">
            <thead className="bg-soft text-muted"><tr><th className="p-3">When</th><th className="p-3">Action</th><th className="p-3">Resource</th><th className="p-3">Outcome</th><th className="p-3">Actor</th></tr></thead>
            <tbody>
              {audit.length === 0 ? <tr><td colSpan={5} className="p-4 text-muted">No audit events.</td></tr> : audit.map((item) => (
                <tr key={item.id} className="border-t border-line">
                  <td className="p-3 text-muted">{new Date(item.createdAt).toLocaleString()}</td>
                  <td className="p-3 font-medium">{item.action}</td>
                  <td className="p-3 text-muted">{item.resourceType}{item.resourceId ? ` · ${item.resourceId.slice(0, 8)}` : ""}</td>
                  <td className="p-3 text-muted">{item.outcome}</td>
                  <td className="p-3 font-mono text-muted">{item.actorUserId?.slice(0, 8) ?? "system"}</td>
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
  const [role, setRole] = useState(item.role);
  const [district, setDistrict] = useState(item.districtCode ?? "");
  return (
    <form onSubmit={(event) => {
      event.preventDefault();
      const active = (new FormData(event.currentTarget).get("active") === "true");
      onRun(() => updateUserAccess(token, item.id, { isActive: active, role, districtCode: district }), "Account access updated.");
    }} className="flex flex-wrap items-center gap-2 rounded-[var(--radius-card)] border border-line bg-paper p-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{item.displayName}</p>
        <p className="text-xs text-muted">{item.email} · {item.isActive ? "active" : "inactive"}</p>
      </div>
      <select name="active" defaultValue={String(item.isActive)} aria-label="Account active" className="min-h-10 rounded-xl border border-line px-2 text-xs"><option value="true">Active</option><option value="false">Inactive</option></select>
      <select value={role} onChange={(event) => setRole(event.target.value)} disabled={!admin} aria-label="Role" className="min-h-10 rounded-xl border border-line px-2 text-xs disabled:opacity-40">
        {(admin ? ROLES : [item.role]).map((option) => <option key={option} value={option}>{option.replaceAll("_", " ")}</option>)}
      </select>
      <input value={district} onChange={(event) => setDistrict(event.target.value.toUpperCase())} maxLength={20} placeholder="District" aria-label="District" className="min-h-10 w-24 rounded-xl border border-line px-2 text-xs" />
      <button type="submit" disabled={busy} className="min-h-10 rounded-xl border border-line px-3 text-xs font-semibold hover:bg-pink-soft disabled:opacity-40">Save</button>
    </form>
  );
}
