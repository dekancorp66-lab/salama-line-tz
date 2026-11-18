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
 * The dedicated SUPER_ADMIN role is the single source of truth for privilege.
 * Email is intentionally NOT consulted here: public registration accepts any
 * email address, so an email-based check would let a self-registered account
 * inherit super-admin rights. SUPER_ADMIN_EMAIL / isSuperAdminEmail are used
 * only by the bootstrap allowlist that decides which account may be created
 * as the initial super administrator.
 */
export function isSuperAdmin(user: StaffIdentity): boolean {
  return user.role === UserRole.SUPER_ADMIN;
}

export function isPrivilegedAdmin(user: StaffIdentity): boolean {
  return isAdminRole(user.role) || isSuperAdmin(user);
}
