/**
 * Declarative links for the lightweight header menu. The app keeps its existing
 * expo-router stacks and tabs; this list only describes destinations the menu
 * is allowed to offer. Nothing here is an officer/admin entry point.
 */
export type MenuIcon =
  | 'home-outline'
  | 'book-outline'
  | 'chatbubble-outline'
  | 'clipboard-outline'
  | 'business-outline'
  | 'sparkles-outline'
  | 'notifications-outline'
  | 'person-outline'
  | 'settings-outline'
  | 'language-outline'
  | 'shield-outline'
  | 'swap-horizontal-outline';

export interface MenuLink {
  href: string;
  labelKey: string;
  icon: MenuIcon;
}

export const MENU_LINKS: readonly MenuLink[] = [
  { href: '/(tabs)/home', labelKey: 'nav.home', icon: 'home-outline' },
  { href: '/(tabs)/learn', labelKey: 'nav.learn', icon: 'book-outline' },
  { href: '/(tabs)/support', labelKey: 'nav.support', icon: 'chatbubble-outline' },
  { href: '/(tabs)/requests', labelKey: 'nav.requests', icon: 'clipboard-outline' },
  { href: '/services', labelKey: 'nav.services', icon: 'business-outline' },
  { href: '/ai', labelKey: 'nav.ai', icon: 'sparkles-outline' },
  { href: '/notifications', labelKey: 'nav.notifications', icon: 'notifications-outline' },
  { href: '/(tabs)/profile', labelKey: 'nav.profile', icon: 'person-outline' },
  { href: '/settings', labelKey: 'nav.settings', icon: 'settings-outline' },
  { href: '/settings/language', labelKey: 'nav.language', icon: 'language-outline' },
  { href: '/privacy', labelKey: 'nav.privacy', icon: 'shield-outline' },
  { href: '/referral-info', labelKey: 'home.referrals', icon: 'swap-horizontal-outline' },
];

const FORBIDDEN_FRAGMENTS = ['admin', 'officer', 'staff', 'investigator'];

/** Guard used by tests and by the menu before a link is offered. */
export function isMenuLinkAllowed(link: MenuLink): boolean {
  const haystack = `${link.href} ${link.labelKey}`.toLowerCase();
  return !FORBIDDEN_FRAGMENTS.some((fragment) => haystack.includes(fragment));
}
