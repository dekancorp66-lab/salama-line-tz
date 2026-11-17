import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  AlertTriangle, ArrowUpRight, ClipboardList, FileText, HeartHandshake,
  LockKeyhole, RefreshCw, Send, ShieldCheck, UserCheck,
} from "lucide-react";
import { ApiError } from "@/lib/api-client";
import {
  addCaseNote, assignCase, createReferral, escalateCase, getCase, grantCaseConsent,
  listCases, listReferrals, listResponders, listVerifiedServices, revokeCaseConsent,
  updateCaseStatus,
  type CaseDetail, type CaseSummary, type ConsentPurpose, type Referral,
  type ResponderRecord, type VerifiedService,
} from "@/lib/backend-api";
import {
  allowedStatuses, isAdminRole, TERMINAL_STATUSES,
  type CaseStatus, type StaffUser,
} from "@/lib/staff-session";

interface Props {
  token: string;
  user: StaffUser;
}

const PURPOSES: ConsentPurpose[] = ["CONTACT_FOR_HELP", "SHARE_WITH_SERVICE", "FOLLOW_UP"];

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function messageOf(cause: unknown) {
  return cause instanceof ApiError || cause instanceof Error
    ? cause.message
    : "Something went wrong. Please try again.";
}

export function CaseWorkspace({ token, user }: Props) {
  const admin = isAdminRole(user.role);
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CaseDetail | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [services, setServices] = useState<VerifiedService[]>([]);
  const [responders, setResponders] = useState<ResponderRecord[]>([]);
  const [districtFilter, setDistrictFilter] = useState("");
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [nextStatus, setNextStatus] = useState<CaseStatus | "">("");
  const [assignee, setAssignee] = useState("");
  const [consentPurpose, setConsentPurpose] = useState<ConsentPurpose>("SHARE_WITH_SERVICE");
  const [serviceId, setServiceId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const lastOpenedId = useRef<string | null>(null);

  const refreshCases = useCallback(async () => {
    setError("");
    try {
      const district = admin ? districtFilter || undefined : user.districtCode ?? undefined;
      const list = await listCases(token, district);
      setCases(list);
      setSelectedId((current) => (current && list.some((item) => item.id === current) ? current : list[0]?.id ?? null));
    } catch (cause) {
      setError(messageOf(cause));
      setCases([]);
    }
  }, [admin, districtFilter, token, user.districtCode]);

  useEffect(() => {
    void refreshCases();
  }, [refreshCases]);

  const openCase = useCallback(async (id: string) => {
    lastOpenedId.current = id;
    setSelectedId(id);
    setError("");
    setNotice("");
    setNote(""); setReason(""); setNextStatus(""); setServiceId("");
    setBusy(true);
    try {
      const [caseDetail, caseReferrals, serviceList] = await Promise.all([
        getCase(token, id),
        listReferrals(token, id),
        listVerifiedServices(token),
      ]);
      setDetail(caseDetail);
      setReferrals(caseReferrals);
      setServices(serviceList);
      if (admin) {
        const roster = await listResponders(token);
        setResponders(roster);
        setAssignee(caseDetail.assignedResponderId ?? roster.find((item) => item.isActive && item.districtCode === caseDetail.districtCode)?.id ?? "");
      } else {
        setResponders([]);
      }
    } catch (cause) {
      setError(messageOf(cause));
      setDetail(null);
    } finally {
      setBusy(false);
    }
  }, [admin, token]);

  useEffect(() => {
    if (selectedId && lastOpenedId.current !== selectedId) void openCase(selectedId);
  }, [selectedId, openCase]);

  async function run(action: () => Promise<unknown>, success: string, reloadDetail = true) {
    setBusy(true); setError(""); setNotice("");
    try {
      await action();
      setNotice(success);
      await refreshCases();
      if (reloadDetail && detail) {
        const [caseDetail, caseReferrals] = await Promise.all([
          getCase(token, detail.id),
          listReferrals(token, detail.id),
        ]);
        setDetail(caseDetail);
        setReferrals(caseReferrals);
      }
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(false);
    }
  }

  const activeShareConsent = detail?.consents.some(
    (item) => item.purpose === "SHARE_WITH_SERVICE" && item.decision === "GRANTED" && !item.revokedAt,
  );

  if (!user.districtCode && !admin) {
    return (
      <div role="alert" className="rounded-[var(--radius-card)] border border-pink-line bg-pink-soft p-5 text-sm leading-relaxed">
        <p className="font-semibold text-pink">No district is assigned to this account.</p>
        <p className="mt-1 text-ink">An administrator must assign your district before cases can be shown. No cases are displayed until then.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Case queue</h2>
          <p className="mt-1 text-sm text-muted">Open help requests only. Closed cases disappear from this list after their retention window.</p>
        </div>
        <div className="flex items-center gap-2">
          {admin && (
            <input value={districtFilter} onChange={(event) => setDistrictFilter(event.target.value.toUpperCase())} maxLength={20} placeholder="All districts" aria-label="Filter by district" className="min-h-10 w-36 rounded-xl border border-line bg-paper px-3 text-sm outline-none focus:border-pink" />
          )}
          <button type="button" onClick={() => void refreshCases()} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-line px-3 text-sm font-medium text-ink transition hover:border-pink-line hover:bg-pink-soft"><RefreshCw size={15} />Refresh</button>
        </div>
      </div>

      {error && <p role="alert" className="flex items-start gap-2 rounded-xl border border-pink-line bg-pink-soft px-3 py-2.5 text-sm text-pink-hover"><AlertTriangle size={16} className="mt-0.5 shrink-0" />{error}</p>}
      {notice && <p role="status" className="rounded-xl border border-line bg-soft px-3 py-2.5 text-sm text-ink">{notice}</p>}

      <div className="grid gap-5 lg:grid-cols-[minmax(260px,340px)_minmax(0,1fr)]">
        <section aria-label="Open cases" className="max-h-[70vh] overflow-y-auto rounded-[var(--radius-card)] border border-line bg-paper">
          {cases.length === 0 ? (
            <p className="p-5 text-sm text-muted">No open cases in your authorized district.</p>
          ) : cases.map((item) => (
            <button key={item.id} type="button" onClick={() => void openCase(item.id)} className={`block w-full border-b border-line p-4 text-left transition last:border-0 hover:bg-pink-soft ${selectedId === item.id ? "bg-pink-soft" : ""}`}>
              <span className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs font-semibold text-pink">{item.caseCode}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${item.priority === "URGENT" ? "bg-pink text-white" : "bg-soft text-muted"}`}>{item.priority}</span>
              </span>
              <span className="mt-1.5 block text-sm font-semibold text-ink">{item.topic}</span>
              <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                <span>{item.status.replaceAll("_", " ")}</span><span>·</span><span>{item.districtCode}</span>
                {item.escalationCount > 0 && <><span>·</span><span className="text-pink">{item.escalationCount} escalations</span></>}
              </span>
              <span className="mt-1 block text-xs text-muted">{formatDate(item.createdAt)}</span>
            </button>
          ))}
        </section>

        <section aria-label="Case detail" className="min-w-0 rounded-[var(--radius-card)] border border-line bg-paper p-4 sm:p-6">
          {busy && !detail ? <p className="py-10 text-center text-sm text-muted">Loading case…</p> : !detail ? (
            <div className="grid place-items-center gap-2 py-14 text-center text-muted"><ClipboardList size={28} className="text-pink" /><p className="text-sm">Select a case to review it.</p></div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
                <div>
                  <p className="font-mono text-sm font-semibold text-pink">{detail.caseCode}</p>
                  <h3 className="mt-1 text-xl font-semibold tracking-tight">{detail.topic}</h3>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${TERMINAL_STATUSES.includes(detail.status) ? "bg-soft text-muted" : "bg-pink-soft text-pink"}`}>{detail.status.replaceAll("_", " ")}</span>
              </div>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
                {[
                  ["District", detail.districtCode], ["Channel", detail.channel],
                  ["Received", formatDate(detail.createdAt)], ["Assigned", formatDate(detail.assignedAt)],
                  ["Escalated", formatDate(detail.escalatedAt)], ["Closed", formatDate(detail.closedAt)],
                ].map(([label, value]) => (
                  <div key={label}><dt className="text-xs uppercase tracking-wide text-muted">{label}</dt><dd className="mt-0.5 font-medium text-ink">{value}</dd></div>
                ))}
              </dl>

              <div className="rounded-xl border border-line bg-soft p-4">
                <p className="flex items-center gap-2 text-sm font-semibold"><FileText size={16} className="text-pink" />Redacted concern summary</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted">{detail.concernSummary ?? "No summary was provided."}</p>
              </div>

              <div>
                <p className="flex items-center gap-2 text-sm font-semibold"><LockKeyhole size={16} className="text-pink" />Consent record</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {detail.consents.length === 0 ? <span className="text-sm text-muted">No consent records.</span> : detail.consents.map((consent, index) => (
                    <span key={`${consent.purpose}-${index}`} className={`rounded-full border px-2.5 py-1 text-xs ${consent.decision === "GRANTED" && !consent.revokedAt ? "border-pink-line bg-pink-soft text-pink" : "border-line bg-soft text-muted"}`}>
                      {consent.purpose.replaceAll("_", " ")} · {consent.revokedAt ? "revoked" : consent.decision.toLowerCase()} · {consent.wordingVersion}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <form onSubmit={(event) => { event.preventDefault(); if (nextStatus) void run(() => updateCaseStatus(token, detail.id, nextStatus), `Status updated to ${nextStatus.replaceAll("_", " ")}.`); }} className="space-y-2 rounded-xl border border-line p-4">
                  <p className="flex items-center gap-2 text-sm font-semibold"><ArrowUpRight size={16} className="text-pink" />Update status</p>
                  <select value={nextStatus} onChange={(event) => setNextStatus(event.target.value as CaseStatus | "")} disabled={busy} aria-label="Next status" className="min-h-11 w-full rounded-xl border border-line bg-paper px-3 text-sm outline-none focus:border-pink disabled:opacity-50">
                    <option value="">Choose next step…</option>
                    {allowedStatuses(detail.status).map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}
                  </select>
                  <button type="submit" disabled={busy || !nextStatus} className="brand-fill min-h-10 w-full rounded-xl px-4 text-sm font-semibold text-white disabled:opacity-40">Apply status</button>
                  <p className="text-xs leading-relaxed text-muted">Only transitions allowed by the case policy are shown. Closing or cancelling wipes contact identifiers.</p>
                </form>

                {admin ? (
                  <form onSubmit={(event) => { event.preventDefault(); if (assignee) void run(() => assignCase(token, detail.id, { responderId: assignee }), "Case assigned."); }} className="space-y-2 rounded-xl border border-line p-4">
                    <p className="flex items-center gap-2 text-sm font-semibold"><UserCheck size={16} className="text-pink" />Assign responder</p>
                    <select value={assignee} onChange={(event) => setAssignee(event.target.value)} disabled={busy} aria-label="Responder" className="min-h-11 w-full rounded-xl border border-line bg-paper px-3 text-sm outline-none focus:border-pink disabled:opacity-50">
                      <option value="">Choose a responder…</option>
                      {responders.filter((item) => item.isActive && item.districtCode === detail.districtCode).map((item) => <option key={item.id} value={item.id}>{item.displayName} · {item.email}</option>)}
                    </select>
                    <button type="submit" disabled={busy || !assignee} className="brand-fill min-h-10 w-full rounded-xl px-4 text-sm font-semibold text-white disabled:opacity-40">Assign</button>
                    <p className="text-xs leading-relaxed text-muted">Only active responders in this case’s district can be selected.</p>
                  </form>
                ) : (
                  <div className="rounded-xl border border-line bg-soft p-4">
                    <p className="flex items-center gap-2 text-sm font-semibold"><UserCheck size={16} className="text-pink" />Assignment</p>
                    <p className="mt-2 text-sm leading-relaxed text-muted">Select <strong>Accepted</strong> above to take an unassigned case yourself. Reassignment requires an administrator.</p>
                  </div>
                )}
              </div>

              <form onSubmit={(event) => { event.preventDefault(); if (note.trim().length >= 2) void run(() => addCaseNote(token, detail.id, note.trim()), "Case note added.").then(() => setNote("")); }} className="space-y-2 rounded-xl border border-line p-4">
                <p className="text-sm font-semibold">Case note</p>
                <textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={2000} rows={3} disabled={busy} placeholder="Case metadata only — never names, phone numbers or message text." className="w-full resize-y rounded-xl border border-line bg-paper px-3 py-2.5 text-sm outline-none placeholder:text-muted/70 focus:border-pink" />
                <button type="submit" disabled={busy || note.trim().length < 2} className="brand-fill min-h-10 rounded-xl px-5 text-sm font-semibold text-white disabled:opacity-40">Add note</button>
              </form>

              <div className="grid gap-4 md:grid-cols-2">
                <form onSubmit={(event) => { event.preventDefault(); void run(() => escalateCase(token, detail.id, reason.trim() || undefined), "Escalation recorded for human review."); }} className="space-y-2 rounded-xl border border-pink-line bg-pink-soft/40 p-4">
                  <p className="flex items-center gap-2 text-sm font-semibold"><AlertTriangle size={16} className="text-pink" />Escalate for review</p>
                  <input value={reason} onChange={(event) => setReason(event.target.value)} maxLength={240} placeholder="Optional metadata-only reason" className="min-h-11 w-full rounded-xl border border-line bg-paper px-3 text-sm outline-none focus:border-pink" />
                  <button type="submit" disabled={busy} className="min-h-10 rounded-xl border border-pink px-4 text-sm font-semibold text-pink transition hover:bg-pink-soft disabled:opacity-40">Escalate</button>
                  <p className="text-xs leading-relaxed text-muted">Creates an internal review task only. No destination or message body is stored, and nothing is sent automatically.</p>
                </form>

                <form onSubmit={(event) => { event.preventDefault(); void run(() => grantCaseConsent(token, detail.id, consentPurpose), "Consent granted and recorded."); }} className="space-y-2 rounded-xl border border-line p-4">
                  <p className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck size={16} className="text-pink" />Record consent</p>
                  <select value={consentPurpose} onChange={(event) => setConsentPurpose(event.target.value as ConsentPurpose)} className="min-h-11 w-full rounded-xl border border-line bg-paper px-3 text-sm outline-none focus:border-pink">
                    {PURPOSES.map((purpose) => <option key={purpose} value={purpose}>{purpose.replaceAll("_", " ")}</option>)}
                  </select>
                  <button type="submit" disabled={busy} className="min-h-10 rounded-xl border border-line px-4 text-sm font-semibold text-ink transition hover:bg-pink-soft disabled:opacity-40">Grant · salama-consent-v1</button>
                  <p className="text-xs leading-relaxed text-muted">Consent must be specific to a purpose and is stored with its wording version. General contact consent does not permit service sharing.</p>
                </form>
              </div>

              <div className="space-y-3 rounded-xl border border-line p-4">
                <p className="flex items-center gap-2 text-sm font-semibold"><HeartHandshake size={16} className="text-pink" />Verified service referrals</p>
                {!activeShareConsent && <p className="rounded-lg bg-pink-soft px-3 py-2 text-xs leading-relaxed text-pink-hover">Grant <strong>Share with service</strong> consent above before offering a referral.</p>}
                <form onSubmit={(event) => { event.preventDefault(); if (serviceId) void run(() => createReferral(token, detail.id, serviceId), "Referral offered. No third party was contacted automatically."); }} className="flex flex-wrap gap-2">
                  <select value={serviceId} onChange={(event) => setServiceId(event.target.value)} disabled={!activeShareConsent || busy} aria-label="Verified service" className="min-h-11 min-w-0 flex-1 rounded-xl border border-line bg-paper px-3 text-sm outline-none focus:border-pink disabled:opacity-50">
                    <option value="">Choose a verified service…</option>
                    {services.filter((service) => service.districtCode === detail.districtCode).map((service) => <option key={service.id} value={service.id}>{service.name} · {service.type.replaceAll("_", " ")}</option>)}
                  </select>
                  <button type="submit" disabled={!activeShareConsent || !serviceId || busy} className="brand-fill inline-flex min-h-11 items-center gap-1.5 rounded-xl px-4 text-sm font-semibold text-white disabled:opacity-40"><Send size={15} />Offer</button>
                </form>
                <ul className="divide-y divide-line text-sm">
                  {referrals.length === 0 ? <li className="py-2 text-xs text-muted">No referrals recorded for this case.</li> : referrals.map((referral) => (
                    <li key={referral.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <span className="font-mono text-xs text-muted">{services.find((service) => service.id === referral.serviceEntryId)?.name ?? referral.serviceEntryId}</span>
                      <span className="text-xs font-semibold text-pink">{referral.status}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="border-t border-line pt-4">
                <p className="text-sm font-semibold">Withdraw consent</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {PURPOSES.map((purpose) => {
                    const active = detail.consents.some((item) => item.purpose === purpose && item.decision === "GRANTED" && !item.revokedAt);
                    return (
                      <button key={purpose} type="button" disabled={!active || busy} onClick={() => void run(() => revokeCaseConsent(token, detail.id, purpose), `${purpose.replaceAll("_", " ")} consent revoked.`)} className="min-h-10 rounded-full border border-line px-3 text-xs font-medium text-muted transition hover:border-pink-line hover:bg-pink-soft hover:text-pink disabled:cursor-not-allowed disabled:opacity-40">
                        Revoke {purpose.replaceAll("_", " ").toLowerCase()}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
