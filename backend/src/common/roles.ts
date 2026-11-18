import { UserRole } from '@prisma/client';

export const ADMIN_ROLES: UserRole[] = [UserRole.ADMIN, UserRole.SUPER_ADMIN];

export const CASE_MANAGEMENT_ROLES: UserRole[] = [...ADMIN_ROLES, UserRole.RESPONDER];

export const CONTENT_MANAGEMENT_ROLES: UserRole[] = [
  ...ADMIN_ROLES,
  UserRole.CONTENT_REVIEWER,
  UserRole.CONTENT_MANAGER,
];

export const SERVICE_MANAGEMENT_ROLES: UserRole[] = [...ADMIN_ROLES, UserRole.SERVICE_MANAGER];

export const AI_KNOWLEDGE_MANAGEMENT_ROLES: UserRole[] = [
  ...ADMIN_ROLES,
  UserRole.CONTENT_MANAGER,
];

export const AUDIT_READ_ROLES: UserRole[] = [...ADMIN_ROLES, UserRole.AUDITOR];

/** Any role beyond a plain user or responder carries elevated permissions. */
export const PRIVILEGED_ROLES: UserRole[] = [
  UserRole.ADMIN,
  UserRole.SUPER_ADMIN,
  UserRole.CONTENT_REVIEWER,
  UserRole.CONTENT_MANAGER,
  UserRole.SERVICE_MANAGER,
  UserRole.AUDITOR,
  UserRole.PARTNER_ANALYST,
];

export function isPrivilegedRole(role?: string | null): boolean {
  return PRIVILEGED_ROLES.includes(role as UserRole);
}

export function isAdminRole(role?: string | null): boolean {
  return ADMIN_ROLES.includes(role as UserRole);
}

export function isResponderRole(role?: string | null): boolean {
  return role === UserRole.RESPONDER;
}

export function canManageCases(role?: string | null): boolean {
  return CASE_MANAGEMENT_ROLES.includes(role as UserRole);
}

export function canManageContent(role?: string | null): boolean {
  return CONTENT_MANAGEMENT_ROLES.includes(role as UserRole);
}
