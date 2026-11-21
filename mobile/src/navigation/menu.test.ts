import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import en from '../i18n/locales/en.json';
import sw from '../i18n/locales/sw.json';
import { MENU_LINKS, isMenuLinkAllowed } from './menu';

function hasKey(source: Record<string, unknown>, path: string): boolean {
  let current: unknown = source;
  for (const part of path.split('.')) {
    if (!current || typeof current !== 'object') return false;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === 'string' && current.trim().length > 0;
}

describe('header navigation menu', () => {
  it('uses only in-app expo-router destinations', () => {
    for (const link of MENU_LINKS) {
      assert.ok(link.href.startsWith('/'), `${link.href} must be an in-app route`);
      assert.equal(link.href.includes('://'), false);
    }
  });

  it('never exposes officer or admin entry points', () => {
    for (const link of MENU_LINKS) {
      assert.equal(isMenuLinkAllowed(link), true, `${link.href} is not allowed`);
    }
  });

  it('covers the main app surfaces', () => {
    const hrefs = MENU_LINKS.map((link) => link.href);
    for (const required of [
      '/(tabs)/home',
      '/(tabs)/support',
      '/(tabs)/requests',
      '/ai',
      '/settings',
    ]) {
      assert.ok(hrefs.includes(required), `${required} should be in the menu`);
    }
  });

  it('uses translated labels in both supported languages', () => {
    for (const link of MENU_LINKS) {
      assert.equal(hasKey(en as Record<string, unknown>, link.labelKey), true, `en.${link.labelKey}`);
      assert.equal(hasKey(sw as Record<string, unknown>, link.labelKey), true, `sw.${link.labelKey}`);
    }
  });
});
