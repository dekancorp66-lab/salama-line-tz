export const SUPER_ADMIN_EMAIL = 'wilbardmagaso777@gmail.com';

export function isSuperAdminEmail(email: string): boolean {
  return email.trim().toLowerCase() === SUPER_ADMIN_EMAIL;
}
