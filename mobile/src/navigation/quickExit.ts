/** Internal route name used by the conditional root navigator. */
export const NEUTRAL_ROUTE = 'neutral';

/** Root-safe hrefs used by `router.replace` for Quick Exit navigation. */
export const NEUTRAL_HREF = '/neutral';
export const RETURN_HREF = '/';

/** Fresh normal-stack route reached when the user explicitly returns. */
export const RETURN_ROUTE = 'index';

/** Routes that may contain sensitive content and must be covered on background. */
const SENSITIVE_ROUTE_FRAGMENTS = [
  'support',
  'requests',
  'services',
  'content',
  'referral',
  'privacy',
  'learn',
  'home',
  'profile',
  'settings',
  'ai',
];

export function isSensitiveRoute(routeName: string | undefined): boolean {
  if (!routeName || routeName === NEUTRAL_ROUTE || routeName === NEUTRAL_HREF) return false;
  const normalized = routeName.toLowerCase();
  return SENSITIVE_ROUTE_FRAGMENTS.some((fragment) => normalized.includes(fragment));
}
