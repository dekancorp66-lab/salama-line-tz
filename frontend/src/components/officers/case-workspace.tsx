import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  AlertTriangle, ArrowUpRight, ClipboardList, FileText, HeartHandshake,
  LockKeyhole, RefreshCw, Send, ShieldCheck, UserCheck,
} from "lucide-react";
import { CopyButton } from "@/components/copy-button.tsx";
import { useI18n } from "@/i18n/provider.tsx";
import type { Dictionary } from "@/i18n/types.ts";
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

/** Dynamic label lookup with a safe fallback for values the backend may add. */
function label(dictionary: Dictionary, group: keyof Dictionary["labels"], value: string): string {
  const table = dictionary.labels[group] as Record<string, string>;
  return table[value] ?? table[value.toLowerCase()] ?? value.replaceAll("_", " ");
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

type CaseLocation = Pick<
  CaseSummary,
  "districtCode" | "districtId" | "districtName" | "regionId" | "regionName"
>;

function formatLocation(item: CaseLocation): string {
  const region = item.regionName?.trim() || item.regionId?.trim();
  const district =
    item.districtName?.trim() ||
    item.districtId?.trim() ||
    item.districtCode?.trim() ||
    "—";
  return region ? `${region} · ${district}` : district;
}

function normalizeLocationValue(value: string): string {
  return value.trim().toUpperCase();
}

function matchesCaseLocation(record: CaseLocation, code: string | null | undefined): boolean {
  const target = code?.trim().toUpperCase();
  if (!target) return false;
  const compactTarget = target.replace(/[^A-Z0-9]+/g, "");
  const candidates = [
    record.districtCode,
    record.districtId,
    record.districtName,
    record.regionId,
    record.regionName,
  ].filter((value): value is string => Boolean(value?.trim()));

  for (const candidate of candidates) {
    const normalized = normalizeLocationValue(candidate);
    if (normalized === target) return true;
    const compact = normalized.replace(/[^A-Z0-9]+/g, "");
    if (compactTarget && compact && compact === compactTarget) return true;
  }

  // Compatibility for legacy scopes/codes (e.g. "KYELA" vs "Kyela District",
  // "MBEYA-CITY" vs canonical IDs) so officers can still assign/refer safely.
  for (const candidate of candidates) {
    const normalized = normalizeLocationValue(candidate);
    if (
      normalized.startsWith(`${target} `) ||
      normalized.endsWith(` ${target}`) ||
      normalized.includes(` ${target} `) ||
      normalized.startsWith(`${target}-`) ||
      normalized.endsWith(`-${target}`) ||
      normalized.includes(`-${target}-`)
    ) {
      return true;
    }
  }
  return false;
}

export function CaseWorkspace({ token, user }: Props) {
  const { t, dictionary, errorMessage } = useI18n();
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
      setError(errorMessage(cause));
      setCases([]);
    }
  }, [admin, districtFilter, errorMessage, token, user.districtCode]);

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
        setAssignee(
          caseDetail.assignedResponderId ??
            roster.find((item) => item.isActive && matchesCaseLocation(caseDetail, item.districtCode))?.id ??
            "",
        );
      } else {
        setResponders([]);
      }
    } catch (cause) {
      setError(errorMessage(cause));
      setDetail(null);
    } finally {
      setBusy(false);
    }
  }, [admin, errorMessage, token]);

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
      setError(errorMessage(cause));
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
        <p className="font-semibold text-pink">{t("caseWorkspace.noDistrictTitle")}</p>
        <p className="mt-1 text-ink">{t("caseWorkspace.noDistrictBody")}</p>
      </div>
    );
  }

  const sharePurpose = label(dictionary, "consentPurposes", "SHARE_WITH_SERVICE");
  const detailFields: [string, string][] = [
    [t("caseWorkspace.region"), detail?.regionName ?? detail?.regionId ?? "—"],
    [t("caseWorkspace.district"), detail?.districtName ?? detail?.districtId ?? detail?.districtCode ?? "—"],
    [t("caseWorkspace.channel"), label(dictionary, "channels", detail?.channel ?? "")],
    [t("caseWorkspace.received"), formatDate(detail?.createdAt)],
    [t("caseWorkspace.assigned"), formatDate(detail?.assignedAt)],
    [t("caseWorkspace.escalated"), formatDate(detail?.escalatedAt)],
    [t("caseWorkspace.closed"), formatDate(detail?.closedAt)],
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">{t("caseWorkspace.queueTitle")}</h2>
          <p className="mt-1 text-sm text-muted">{t("caseWorkspace.queueIntro")}</p>
        </div>
        <div className="flex items-center gap-2">
          {admin && (
            <input value={districtFilter} onChange={(event) => setDistrictFilter(event.target.value.toUpperCase())} maxLength={20} placeholder={t("caseWorkspace.allDistricts")} aria-label={t("caseWorkspace.filterByDistrict")} className="min-h-10 w-36 rounded-xl border border-line bg-paper px-3 text-sm outline-none focus:border-pink" />
          )}
          <button type="button" onClick={() => void refreshCases()} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-line px-3 text-sm font-medium text-ink transition hover:border-pink-line hover:bg-pink-soft"><RefreshCw size={15} />{t("caseWorkspace.refresh")}</button>
        </div>
      </div>

      {error && <p role="alert" className="flex items-start gap-2 rounded-xl border border-pink-line bg-pink-soft px-3 py-2.5 text-sm text-pink-hover"><AlertTriangle size={16} className="mt-0.5 shrink-0" />{error}</p>}
      {notice && <p role="status" className="rounded-xl border border-line bg-soft px-3 py-2.5 text-sm text-ink">{notice}</p>}

      <div className="grid gap-5 lg:grid-cols-[minmax(260px,340px)_minmax(0,1fr)]">
        <section aria-label={t("caseWorkspace.openCases")} className="max-h-[70vh] overflow-y-auto rounded-[var(--radius-card)] border border-line bg-paper">
          {cases.length === 0 ? (
            <p className="p-5 text-sm text-muted">{t("caseWorkspace.noOpenCases")}</p>
          ) : cases.map((item) => (
            <button key={item.id} type="button" onClick={() => void openCase(item.id)} className={`block w-full border-b border-line p-4 text-left transition last:border-0 hover:bg-pink-soft ${selectedId === item.id ? "bg-pink-soft" : ""}`}>
              <span className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs font-semibold text-pink">{item.caseCode}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${item.priority === "URGENT" ? "bg-brand-fill text-white" : "bg-soft text-muted"}`}>{label(dictionary, "priorities", item.priority)}</span>
              </span>
              <span className="mt-1.5 block text-sm font-semibold text-ink">{label(dictionary, "topics", item.topic)}</span>
              <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                <span>{label(dictionary, "caseStatuses", item.status)}</span><span>·</span><span>{formatLocation(item)}</span>
                {item.escalationCount > 0 && <><span>·</span><span className="text-pink">{t("caseWorkspace.escalations", { count: item.escalationCount })}</span></>}
              </span>
              <span className="mt-1 block text-xs text-muted">{formatDate(item.createdAt)}</span>
            </button>
          ))}
        </section>

        <section aria-label={t("caseWorkspace.caseDetail")} className="min-w-0 rounded-[var(--radius-card)] border border-line bg-paper p-4 sm:p-6">
          {busy && !detail ? <p className="py-10 text-center text-sm text-muted">{t("caseWorkspace.loadingCase")}</p> : !detail ? (
            <div className="grid place-items-center gap-2 py-14 text-center text-muted"><ClipboardList size={28} className="text-pink" /><p className="text-sm">{t("caseWorkspace.selectCase")}</p></div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
                <div>
                  <p className="font-mono text-sm font-semibold text-pink">{detail.caseCode}</p>
                  <div className="mt-2"><CopyButton value={detail.caseCode} label={t("caseWorkspace.copyCode")} compact /></div>
                  <h3 className="mt-1 text-xl font-semibold tracking-tight">{label(dictionary, "topics", detail.topic)}</h3>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${TERMINAL_STATUSES.includes(detail.status) ? "bg-soft text-muted" : "bg-pink-soft text-pink"}`}>{label(dictionary, "caseStatuses", detail.status)}</span>
              </div>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
                {detailFields.map(([field, value]) => (
                  <div key={field}><dt className="text-xs uppercase tracking-wide text-muted">{field}</dt><dd className="mt-0.5 font-medium text-ink">{value}</dd></div>
                ))}
              </dl>

              <div className="rounded-xl border border-line bg-soft p-4">
                <p className="flex items-center gap-2 text-sm font-semibold"><FileText size={16} className="text-pink" />{t("caseWorkspace.redactedConcern")}</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted">{detail.concernSummary ?? t("caseWorkspace.noSummary")}</p>
              </div>

              <div>
                <p className="flex items-center gap-2 text-sm font-semibold"><LockKeyhole size={16} className="text-pink" />{t("caseWorkspace.consentRecord")}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {detail.consents.length === 0 ? <span className="text-sm text-muted">{t("caseWorkspace.noConsentRecords")}</span> : detail.consents.map((consent, index) => (
                    <span key={`${consent.purpose}-${index}`} className={`rounded-full border px-2.5 py-1 text-xs ${consent.decision === "GRANTED" && !consent.revokedAt ? "border-pink-line bg-pink-soft text-pink" : "border-line bg-soft text-muted"}`}>
                      {label(dictionary, "consentPurposes", consent.purpose)} · {consent.revokedAt ? t("caseWorkspace.revoked") : label(dictionary, "consentDecisions", consent.decision)} · {consent.wordingVersion}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <form onSubmit={(event) => { event.preventDefault(); if (nextStatus) void run(() => updateCaseStatus(token, detail.id, nextStatus), t("caseWorkspace.statusUpdated", { status: label(dictionary, "caseStatuses", nextStatus) })); }} className="space-y-2 rounded-xl border border-line p-4">
                  <p className="flex items-center gap-2 text-sm font-semibold"><ArrowUpRight size={16} className="text-pink" />{t("caseWorkspace.updateStatus")}</p>
                  <select value={nextStatus} onChange={(event) => setNextStatus(event.target.value as CaseStatus | "")} disabled={busy} aria-label={t("caseWorkspace.nextStatus")} className="min-h-11 w-full rounded-xl border border-line bg-paper px-3 text-sm outline-none focus:border-pink disabled:opacity-50">
                    <option value="">{t("caseWorkspace.chooseNextStep")}</option>
                    {allowedStatuses(detail.status).map((status) => <option key={status} value={status}>{label(dictionary, "caseStatuses", status)}</option>)}
                  </select>
                  <button type="submit" disabled={busy || !nextStatus} className="brand-fill min-h-10 w-full rounded-xl px-4 text-sm font-semibold text-white disabled:opacity-40">{t("caseWorkspace.applyStatus")}</button>
                  <p className="text-xs leading-relaxed text-muted">{t("caseWorkspace.statusPolicyNote")}</p>
                </form>

                {admin ? (
                  <form onSubmit={(event) => { event.preventDefault(); if (assignee) void run(() => assignCase(token, detail.id, { responderId: assignee }), t("caseWorkspace.caseAssigned")); }} className="space-y-2 rounded-xl border border-line p-4">
                    <p className="flex items-center gap-2 text-sm font-semibold"><UserCheck size={16} className="text-pink" />{t("caseWorkspace.assignResponder")}</p>
                    <select value={assignee} onChange={(event) => setAssignee(event.target.value)} disabled={busy} aria-label={t("caseWorkspace.responder")} className="min-h-11 w-full rounded-xl border border-line bg-paper px-3 text-sm outline-none focus:border-pink disabled:opacity-50">
                      <option value="">{t("caseWorkspace.chooseResponder")}</option>
                      {responders.filter((item) => item.isActive && matchesCaseLocation(detail, item.districtCode)).map((item) => <option key={item.id} value={item.id}>{item.displayName} · {item.email}</option>)}
                    </select>
                    <button type="submit" disabled={busy || !assignee} className="brand-fill min-h-10 w-full rounded-xl px-4 text-sm font-semibold text-white disabled:opacity-40">{t("caseWorkspace.assign")}</button>
                    <p className="text-xs leading-relaxed text-muted">{t("caseWorkspace.assignmentRestriction")}</p>
                  </form>
                ) : (
                  <div className="rounded-xl border border-line bg-soft p-4">
                    <p className="flex items-center gap-2 text-sm font-semibold"><UserCheck size={16} className="text-pink" />{t("caseWorkspace.assignmentTitle")}</p>
                    <p className="mt-2 text-sm leading-relaxed text-muted">{t("caseWorkspace.assignmentHint", { accepted: label(dictionary, "caseStatuses", "ACCEPTED") })}</p>
                  </div>
                )}
              </div>

              <form onSubmit={(event) => { event.preventDefault(); if (note.trim().length >= 2) void run(() => addCaseNote(token, detail.id, note.trim()), t("caseWorkspace.noteAdded")).then(() => setNote("")); }} className="space-y-2 rounded-xl border border-line p-4">
                <p className="text-sm font-semibold">{t("caseWorkspace.caseNote")}</p>
                <textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={2000} rows={3} disabled={busy} placeholder={t("caseWorkspace.notePlaceholder")} className="w-full resize-y rounded-xl border border-line bg-paper px-3 py-2.5 text-sm outline-none placeholder:text-muted/70 focus:border-pink" />
                <button type="submit" disabled={busy || note.trim().length < 2} className="brand-fill min-h-10 rounded-xl px-5 text-sm font-semibold text-white disabled:opacity-40">{t("caseWorkspace.addNote")}</button>
              </form>

              <div className="grid gap-4 md:grid-cols-2">
                <form onSubmit={(event) => { event.preventDefault(); void run(() => escalateCase(token, detail.id, reason.trim() || undefined), t("caseWorkspace.escalationRecorded")); }} className="space-y-2 rounded-xl border border-pink-line bg-pink-soft/40 p-4">
                  <p className="flex items-center gap-2 text-sm font-semibold"><AlertTriangle size={16} className="text-pink" />{t("caseWorkspace.escalateForReview")}</p>
                  <input value={reason} onChange={(event) => setReason(event.target.value)} maxLength={240} placeholder={t("caseWorkspace.reasonPlaceholder")} className="min-h-11 w-full rounded-xl border border-line bg-paper px-3 text-sm outline-none focus:border-pink" />
                  <button type="submit" disabled={busy} className="min-h-10 rounded-xl border border-pink px-4 text-sm font-semibold text-pink transition hover:bg-pink-soft disabled:opacity-40">{t("caseWorkspace.escalate")}</button>
                  <p className="text-xs leading-relaxed text-muted">{t("caseWorkspace.escalationNote")}</p>
                </form>

                <form onSubmit={(event) => { event.preventDefault(); void run(() => grantCaseConsent(token, detail.id, consentPurpose), t("caseWorkspace.consentGranted")); }} className="space-y-2 rounded-xl border border-line p-4">
                  <p className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck size={16} className="text-pink" />{t("caseWorkspace.recordConsent")}</p>
                  <select value={consentPurpose} onChange={(event) => setConsentPurpose(event.target.value as ConsentPurpose)} className="min-h-11 w-full rounded-xl border border-line bg-paper px-3 text-sm outline-none focus:border-pink">
                    {PURPOSES.map((purpose) => <option key={purpose} value={purpose}>{label(dictionary, "consentPurposes", purpose)}</option>)}
                  </select>
                  <button type="submit" disabled={busy} className="min-h-10 rounded-xl border border-line px-4 text-sm font-semibold text-ink transition hover:bg-pink-soft disabled:opacity-40">{t("caseWorkspace.grantConsent")}</button>
                  <p className="text-xs leading-relaxed text-muted">{t("caseWorkspace.consentNote")}</p>
                </form>
              </div>

              <div className="space-y-3 rounded-xl border border-line p-4">
                <p className="flex items-center gap-2 text-sm font-semibold"><HeartHandshake size={16} className="text-pink" />{t("caseWorkspace.referralsTitle")}</p>
                {!activeShareConsent && <p className="rounded-lg bg-pink-soft px-3 py-2 text-xs leading-relaxed text-pink-hover">{t("caseWorkspace.shareConsentRequired", { purpose: sharePurpose })}</p>}
                <form onSubmit={(event) => { event.preventDefault(); if (serviceId) void run(() => createReferral(token, detail.id, serviceId), t("caseWorkspace.referralOffered")); }} className="flex flex-wrap gap-2">
                  <select value={serviceId} onChange={(event) => setServiceId(event.target.value)} disabled={!activeShareConsent || busy} aria-label={t("caseWorkspace.verifiedService")} className="min-h-11 min-w-0 flex-1 rounded-xl border border-line bg-paper px-3 text-sm outline-none focus:border-pink disabled:opacity-50">
                    <option value="">{t("caseWorkspace.chooseService")}</option>
                    {services.filter((service) => matchesCaseLocation(detail, service.districtCode)).map((service) => <option key={service.id} value={service.id}>{service.name} · {label(dictionary, "serviceTypes", service.type)}</option>)}
                  </select>
                  <button type="submit" disabled={!activeShareConsent || !serviceId || busy} className="brand-fill inline-flex min-h-11 items-center gap-1.5 rounded-xl px-4 text-sm font-semibold text-white disabled:opacity-40"><Send size={15} />{t("caseWorkspace.offer")}</button>
                </form>
                <ul className="divide-y divide-line text-sm">
                  {referrals.length === 0 ? <li className="py-2 text-xs text-muted">{t("caseWorkspace.noReferrals")}</li> : referrals.map((referral) => (
                    <li key={referral.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <span className="font-mono text-xs text-muted">{services.find((service) => service.id === referral.serviceEntryId)?.name ?? referral.serviceEntryId}</span>
                      <span className="text-xs font-semibold text-pink">{label(dictionary, "referralStatuses", referral.status)}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="border-t border-line pt-4">
                <p className="text-sm font-semibold">{t("caseWorkspace.withdrawConsent")}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {PURPOSES.map((purpose) => {
                    const active = detail.consents.some((item) => item.purpose === purpose && item.decision === "GRANTED" && !item.revokedAt);
                    const purposeLabel = label(dictionary, "consentPurposes", purpose);
                    return (
                      <button key={purpose} type="button" disabled={!active || busy} onClick={() => void run(() => revokeCaseConsent(token, detail.id, purpose), t("caseWorkspace.purposeRevoked", { purpose: purposeLabel }))} className="min-h-10 rounded-full border border-line px-3 text-xs font-medium text-muted transition hover:border-pink-line hover:bg-pink-soft hover:text-pink disabled:cursor-not-allowed disabled:opacity-40">
                        {t("caseWorkspace.revokePurpose", { purpose: purposeLabel })}
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
