import { UserRole } from '@prisma/client';
import { isAdminRole } from './roles';

export const SUPER_ADMIN_EMAIL = 'wilbardmagaso777@gmail.com';

export function isSuperAdminEmail(email: string): boolean {
  return email.trim().toLowerCase() === SUPER_ADMIN_EMAIL;
}

export interface StaffIdentity {
  email?: string | null;
  role?: string | null;
}

/**
 * The dedicated SUPER_ADMIN role is the source of truth. The email check is
 * retained only for accounts bootstrapped before that role existed.
 */
export function isSuperAdmin(user: StaffIdentity): boolean {
  return user.role === UserRole.SUPER_ADMIN || isSuperAdminEmail(user.email ?? '');
}

export function isPrivilegedAdmin(user: StaffIdentity): boolean {
  return isAdminRole(user.role) || isSuperAdmin(user);
}
