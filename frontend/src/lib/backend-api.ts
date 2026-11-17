import { apiRequest } from "./api-client";
import type { CaseStatus, StaffUser } from "./staff-session";

export type ConsentPurpose = "CONTACT_FOR_HELP" | "SHARE_WITH_SERVICE" | "FOLLOW_UP";
export type ConsentDecision = "GRANTED" | "DECLINED" | "REVOKED";
export type CasePriority = "NORMAL" | "URGENT";
export type HelpChannel = "WEB" | "USSD" | "SMS" | "WHATSAPP" | "STAFF";

export interface CreateHelpRequestInput {
  topic: string;
  districtCode: string;
  channel: HelpChannel;
  consentToContact: boolean;
  contact?: string;
  priority?: CasePriority;
  anonymousReport?: boolean;
  concernSummary?: string;
}

export interface HelpRequestReceipt {
  id: string;
  caseCode: string;
  topic: string;
  concernSummary: string | null;
  districtCode: string;
  status: string;
  priority: CasePriority;
  createdAt: string;
  message: string;
}

export interface CaseSummary {
  id: string;
  caseCode: string;
  topic: string;
  districtCode: string;
  channel: HelpChannel;
  status: CaseStatus;
  priority: CasePriority;
  assignedResponderId: string | null;
  createdAt: string;
  escalationCount: number;
}

export interface ConsentRecord {
  id?: string;
  purpose: ConsentPurpose;
  decision: ConsentDecision;
  wordingVersion: string;
  channel: HelpChannel;
  createdAt: string;
  revokedAt?: string | null;
}

export interface CaseNote {
  id: string;
  note: string;
  authorId: string;
  createdAt: string;
}

export interface CaseDetail extends CaseSummary {
  concernSummary: string | null;
  consentToContact: boolean;
  acceptedAt: string | null;
  assignedAt: string | null;
  escalatedAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  expiresAt: string | null;
  lastAlertAt: string | null;
  consents: ConsentRecord[];
  notes: CaseNote[];
}

export interface Referral {
  id: string;
  helpRequestId: string;
  serviceEntryId: string;
  status: string;
  consentGranted: boolean;
  createdAt: string;
}

export interface VerifiedService {
  id: string;
  name: string;
  type: string;
  districtCode: string;
  region: string;
  phonePublic: string | null;
}

export interface StaffUserRecord {
  id: string;
  email: string;
  displayName: string;
  role: string;
  districtCode: string | null;
  isActive: boolean;
  createdAt?: string;
}

export interface ResponderRecord {
  id: string;
  email: string;
  displayName: string;
  districtCode: string | null;
  isActive: boolean;
  responderProfile: {
    available: boolean;
    districtCode: string | null;
    maxActiveCases: number;
    updatedAt: string;
  } | null;
}

export interface ServiceReviewRecord {
  id: string;
  name: string;
  type: string;
  districtCode: string;
  region: string;
  phonePublic: string | null;
  verificationOrg: string;
  verifiedBy: string;
  verifiedAt: string;
  expiresAt: string | null;
  isActive: boolean;
}

export interface ContentReviewRecord {
  id: string;
  slug: string;
  title: string;
  language: string;
  topic: string;
  status: string;
  sourceName: string;
  reviewerId: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export interface ConsentPolicy {
  id: string;
  version: string;
  wording: string;
  effectiveAt: string;
  revokedAt: string | null;
  createdAt: string;
}

export interface AuditEvent {
  id: string;
  actorUserId: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  outcome: string;
  createdAt: string;
}

export interface AdminMetrics {
  cases: number | null;
  approvedContent: number;
  verifiedServices: number;
  smallCountsSuppressed: boolean;
}

interface LoginResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: string;
  user: StaffUser;
}

function auth(token: string) {
  return { token };
}

// --- Public intake ---------------------------------------------------------

export function submitHelpRequest(input: CreateHelpRequestInput) {
  return apiRequest<HelpRequestReceipt>("/help-requests", { method: "POST", body: input });
}

// --- Authentication --------------------------------------------------------

export function loginStaff(email: string, password: string) {
  return apiRequest<LoginResponse>("/auth/login", {
    method: "POST",
    body: { email, password },
  });
}

export function fetchCurrentUser(token: string) {
  return apiRequest<{ user: StaffUser }>("/auth/me", auth(token));
}

// --- Case management --------------------------------------------------------

export function listCases(token: string, districtCode?: string) {
  const query = districtCode ? `?district=${encodeURIComponent(districtCode)}` : "";
  return apiRequest<CaseSummary[]>(`/help-requests${query}`, auth(token));
}

export function getCase(token: string, id: string) {
  return apiRequest<CaseDetail>(`/help-requests/${encodeURIComponent(id)}`, auth(token));
}

export function updateCaseStatus(token: string, id: string, status: CaseStatus) {
  return apiRequest<{ id: string; caseCode: string; status: CaseStatus }>(
    `/help-requests/${encodeURIComponent(id)}/status`,
    { ...auth(token), method: "PATCH", body: { status } },
  );
}

export function assignCase(
  token: string,
  id: string,
  input: { responderId: string; reason?: string; force?: boolean },
) {
  return apiRequest<CaseDetail>(`/help-requests/${encodeURIComponent(id)}/assign`, {
    ...auth(token),
    method: "POST",
    body: input,
  });
}

export function addCaseNote(token: string, id: string, note: string) {
  return apiRequest<CaseNote>(`/help-requests/${encodeURIComponent(id)}/notes`, {
    ...auth(token),
    method: "POST",
    body: { note },
  });
}

export function escalateCase(token: string, id: string, reason?: string) {
  return apiRequest<CaseDetail>(`/help-requests/${encodeURIComponent(id)}/escalate`, {
    ...auth(token),
    method: "POST",
    body: reason ? { reason } : {},
  });
}

export function grantCaseConsent(token: string, id: string, purpose: ConsentPurpose, wordingVersion?: string) {
  return apiRequest<ConsentRecord>(`/help-requests/${encodeURIComponent(id)}/consent/grant`, {
    ...auth(token),
    method: "POST",
    body: wordingVersion ? { purpose, wordingVersion } : { purpose },
  });
}

export function revokeCaseConsent(token: string, id: string, purpose: ConsentPurpose) {
  return apiRequest<{ revokedAt: string; purpose: ConsentPurpose }>(
    `/help-requests/${encodeURIComponent(id)}/consent/revoke`,
    { ...auth(token), method: "POST", body: { purpose } },
  );
}

export function listReferrals(token: string, id: string) {
  return apiRequest<Referral[]>(`/help-requests/${encodeURIComponent(id)}/referrals`, auth(token));
}

export function createReferral(token: string, id: string, serviceEntryId: string, note?: string) {
  return apiRequest<Referral>(`/help-requests/${encodeURIComponent(id)}/referrals`, {
    ...auth(token),
    method: "POST",
    body: note ? { serviceEntryId, note } : { serviceEntryId },
  });
}

/** Read-only verified directory for case workers (no unverified draft data). */
export function listVerifiedServices(token: string) {
  return apiRequest<VerifiedService[]>("/admin/verified-services", auth(token));
}

export function sweepExpiredCases(token: string) {
  return apiRequest<{ expired: number }>("/help-requests/retention/sweep", {
    ...auth(token),
    method: "POST",
    body: {},
  });
}

// --- Administration --------------------------------------------------------

export function listUsers(token: string) {
  return apiRequest<StaffUserRecord[]>("/admin/users", auth(token));
}

export function listResponders(token: string) {
  return apiRequest<ResponderRecord[]>("/admin/responders", auth(token));
}

export interface CreateServiceEntryInput {
  name: string;
  type: string;
  districtCode: string;
  region: string;
  verificationOrg: string;
  verifiedBy: string;
  verifiedAt: string;
  expiresAt?: string;
  phonePublic?: string;
  address?: string;
  openingHours?: string;
  languages?: string[];
}

export function createServiceEntry(token: string, input: CreateServiceEntryInput) {
  return apiRequest<{ id: string; name: string; districtCode: string; isActive: boolean }>(
    "/admin/services",
    { ...auth(token), method: "POST", body: input },
  );
}

export function listServicesForReview(token: string) {
  return apiRequest<ServiceReviewRecord[]>("/admin/services", auth(token));
}

export function listContentQueue(token: string) {
  return apiRequest<ContentReviewRecord[]>("/admin/content", auth(token));
}

export function listConsentPolicies(token: string) {
  return apiRequest<ConsentPolicy[]>("/admin/consent-policies", auth(token));
}

export function listAuditEvents(token: string) {
  return apiRequest<AuditEvent[]>("/admin/audit", auth(token));
}

export function getAdminMetrics(token: string) {
  return apiRequest<AdminMetrics>("/admin/metrics", auth(token));
}

export function updateUserAccess(
  token: string,
  id: string,
  input: { isActive: boolean; role?: string; districtCode?: string },
) {
  return apiRequest<StaffUserRecord>(`/admin/users/${encodeURIComponent(id)}/access`, {
    ...auth(token),
    method: "PATCH",
    body: input,
  });
}

export function updateResponderAvailability(
  token: string,
  id: string,
  input: { available: boolean; districtCode?: string; maxActiveCases?: number },
) {
  return apiRequest<ResponderRecord["responderProfile"]>(
    `/admin/users/${encodeURIComponent(id)}/availability`,
    { ...auth(token), method: "PATCH", body: input },
  );
}

export function verifyService(
  token: string,
  id: string,
  input: { isActive: boolean; expiresAt?: string },
) {
  return apiRequest<ServiceReviewRecord>(`/admin/services/${encodeURIComponent(id)}/verify`, {
    ...auth(token),
    method: "PATCH",
    body: input,
  });
}

export function archiveContent(token: string, id: string) {
  return apiRequest<{ id: string; slug: string; status: string }>(
    `/admin/content/${encodeURIComponent(id)}/archive`,
    { ...auth(token), method: "PATCH", body: {} },
  );
}

export function createConsentPolicy(token: string, version: string, wording: string) {
  return apiRequest<ConsentPolicy>("/admin/consent-policies", {
    ...auth(token),
    method: "POST",
    body: { version, wording },
  });
}

export function revokeConsentPolicy(token: string, id: string) {
  return apiRequest<{ id: string; version: string; revokedAt: string }>(
    `/admin/consent-policies/${encodeURIComponent(id)}/revoke`,
    { ...auth(token), method: "PATCH", body: {} },
  );
}
