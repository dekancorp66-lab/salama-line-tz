/**
 * Role helpers for the public mobile app. These only decide which neutral
 * labels and notices are shown; they never grant access to staff features.
 * Server-side authorization remains the only source of truth.
 */
const PRIVILEGED_ROLES = new Set([
  'ADMIN',
  'SUPER_ADMIN',
  'CONTENT_REVIEWER',
  'CONTENT_MANAGER',
  'SERVICE_MANAGER',
  'AUDITOR',
  'PARTNER_ANALYST',
]);

const STAFF_ROLES = new Set([...PRIVILEGED_ROLES, 'RESPONDER']);

export function isPrivilegedRole(role?: string | null): boolean {
  return !!role && PRIVILEGED_ROLES.has(role);
}

export function isStaffRole(role?: string | null): boolean {
  return !!role && STAFF_ROLES.has(role);
}

export function isPlainUser(role?: string | null): boolean {
  return role === 'USER';
}

/** No privileged surfaces exist in mobile; staff are directed to their workspace. */
export function roleLabelKey(role?: string | null): string {
  return isStaffRole(role) ? 'account.roleStaff' : 'account.roleUser';
}
