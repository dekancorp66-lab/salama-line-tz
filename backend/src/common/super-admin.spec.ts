import { UserRole } from '@prisma/client';
import { isSuperAdmin, isPrivilegedAdmin, SUPER_ADMIN_EMAIL } from './super-admin';

describe('super-admin identity helpers', () => {
  it('grants super-admin privilege only via the SUPER_ADMIN role, never by email', () => {
    expect(isSuperAdmin({ email: SUPER_ADMIN_EMAIL, role: UserRole.USER })).toBe(false);
    expect(isSuperAdmin({ email: SUPER_ADMIN_EMAIL, role: UserRole.RESPONDER })).toBe(false);
    expect(isSuperAdmin({ email: SUPER_ADMIN_EMAIL, role: UserRole.ADMIN })).toBe(false);
    expect(isSuperAdmin({ email: 'someone-else@example.org', role: UserRole.SUPER_ADMIN })).toBe(true);
    expect(isSuperAdmin({ email: SUPER_ADMIN_EMAIL, role: UserRole.SUPER_ADMIN })).toBe(true);
  });

  it('treats a self-registered owner-email account as non-privileged', () => {
    // Public registration accepts any email; matching the owner address must
    // not confer elevated rights without the dedicated role.
    expect(isSuperAdmin({ email: SUPER_ADMIN_EMAIL, role: UserRole.RESPONDER })).toBe(false);
    expect(isPrivilegedAdmin({ email: SUPER_ADMIN_EMAIL, role: UserRole.RESPONDER })).toBe(false);
  });
});
