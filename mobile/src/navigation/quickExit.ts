export const NEUTRAL_ROUTE = 'neutral';

export type ResetAction = {
  index: number;
  routes: Array<{ name: string }>;
};

export const RETURN_ROUTE = 'index';

/** Builds a navigation reset that leaves only the neutral screen in history. */
export function buildNeutralResetAction(routeName: string = NEUTRAL_ROUTE): ResetAction {
  return {
    index: 0,
    routes: [{ name: routeName }],
  };
}

/** Builds the fresh stack used when the user explicitly returns to the app. */
export function buildReturnResetAction(routeName: string = RETURN_ROUTE): ResetAction {
  return {
    index: 0,
    routes: [{ name: routeName }],
  };
}

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
  if (!routeName || routeName === NEUTRAL_ROUTE) return false;
  const normalized = routeName.toLowerCase();
  return SENSITIVE_ROUTE_FRAGMENTS.some((fragment) => normalized.includes(fragment));
}
