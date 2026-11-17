import { useSyncExternalStore } from "react";

export interface StaffUser {
  id: string;
  email: string;
  displayName: string;
  role: string;
  districtCode?: string | null;
}

export interface StaffSession {
  token: string | null;
  user: StaffUser | null;
}

/**
 * Staff tokens deliberately live only in page memory, matching the existing
 * partner-dashboard convention. A refresh requires signing in again; that is
 * preferable to leaving a long-lived credential in browser storage.
 */
let snapshot: StaffSession = { token: null, user: null };
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

export function setStaffSession(next: StaffSession): void {
  snapshot = next;
  notify();
}

export function clearStaffSession(): void {
  setStaffSession({ token: null, user: null });
}

export function getStaffSession(): StaffSession {
  return snapshot;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useStaffSession(): StaffSession {
  return useSyncExternalStore(subscribe, getStaffSession, getStaffSession);
}

export const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"] as const;
export const CASE_MANAGEMENT_ROLES = [...ADMIN_ROLES, "RESPONDER"] as const;
const CONTENT_ROLES = [...ADMIN_ROLES, "CONTENT_REVIEWER", "CONTENT_MANAGER"] as const;
const SERVICE_ROLES = [...ADMIN_ROLES, "SERVICE_MANAGER"] as const;
const AUDIT_ROLES = [...ADMIN_ROLES, "AUDITOR"] as const;

function hasRole(allowed: readonly string[], role?: string | null): boolean {
  return Boolean(role && allowed.includes(role));
}

export const isAdminRole = (role?: string | null) => hasRole(ADMIN_ROLES, role);
export const canManageCases = (role?: string | null) => hasRole(CASE_MANAGEMENT_ROLES, role);
export const canManageContent = (role?: string | null) => hasRole(CONTENT_ROLES, role);
export const canManageServices = (role?: string | null) => hasRole(SERVICE_ROLES, role);
export const canReadAudit = (role?: string | null) => hasRole(AUDIT_ROLES, role);

export type CaseStatus =
  | "NEW"
  | "PENDING"
  | "PENDING_REVIEW"
  | "ACCEPTED"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "ESCALATED"
  | "REFERRED"
  | "RESOLVED"
  | "CLOSED"
  | "CANCELLED"
  | "EXPIRED";

export const TERMINAL_STATUSES: CaseStatus[] = ["CLOSED", "CANCELLED", "EXPIRED"];

/** Mirrors backend CASE_TRANSITIONS so the UI never offers an illegal move. */
export const CASE_TRANSITIONS: Record<CaseStatus, CaseStatus[]> = {
  NEW: ["PENDING", "PENDING_REVIEW", "CANCELLED"],
  PENDING: ["ACCEPTED", "ASSIGNED", "PENDING_REVIEW", "CANCELLED", "EXPIRED"],
  PENDING_REVIEW: ["ACCEPTED", "ASSIGNED", "CANCELLED"],
  ACCEPTED: ["IN_PROGRESS", "ASSIGNED", "ESCALATED", "REFERRED", "RESOLVED", "CLOSED", "CANCELLED"],
  ASSIGNED: ["IN_PROGRESS", "ESCALATED", "REFERRED", "RESOLVED", "CLOSED", "CANCELLED"],
  IN_PROGRESS: ["ESCALATED", "REFERRED", "RESOLVED", "CLOSED", "CANCELLED"],
  ESCALATED: ["IN_PROGRESS", "REFERRED", "RESOLVED", "CLOSED", "CANCELLED"],
  REFERRED: ["IN_PROGRESS", "RESOLVED", "CLOSED", "CANCELLED"],
  RESOLVED: ["CLOSED", "CANCELLED"],
  CLOSED: [],
  CANCELLED: [],
  EXPIRED: [],
};

export function allowedStatuses(status: CaseStatus): CaseStatus[] {
  return CASE_TRANSITIONS[status] ?? [];
}
