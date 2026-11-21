import { type ReactNode } from 'react';
import { Redirect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { LoadingState } from '../components/ui/Feedback';
import { useAuthStore } from './authStore';
import { resolveProtectedRoute } from './session';

/**
 * Applied only to account-level routes. Public content, services, support and
 * case tracking remain available without an account by design.
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const status = useAuthStore((state) => state.status);
  const decision = resolveProtectedRoute(status);

  if (decision.kind === 'loading') {
    return <LoadingState label={t('common.loading')} />;
  }
  if (decision.kind === 'redirect') {
    return <Redirect href={`/${decision.to}` as never} />;
  }
  return <>{children}</>;
}
