/**
 * Safe, non-secret identity fields only. Password hashes, tokens and recovery
 * values never enter this type and must never be persisted in app storage.
 */
export interface AuthUser {
  id: string;
  email: string;
  displayName?: string;
  role: string;
  districtCode?: string | null;
  institutionId?: string | null;
}
