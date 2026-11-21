import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isSensitiveRoute,
  NEUTRAL_HREF,
  NEUTRAL_ROUTE,
  RETURN_HREF,
  RETURN_ROUTE,
} from './quickExit';

describe('Quick Exit navigation targets', () => {
  it('uses root-safe replace hrefs instead of partial reset actions', () => {
    assert.equal(NEUTRAL_HREF, '/neutral');
    assert.equal(RETURN_HREF, '/');
  });

  it('keeps the neutral destination non-sensitive', () => {
    assert.equal(NEUTRAL_ROUTE, 'neutral');
    assert.equal(isSensitiveRoute(NEUTRAL_ROUTE), false);
    assert.equal(isSensitiveRoute(NEUTRAL_HREF), false);
  });

  it('returns to the fresh index route', () => {
    assert.equal(RETURN_ROUTE, 'index');
    assert.notEqual(RETURN_HREF, NEUTRAL_HREF);
  });
});

describe('sensitive route detection', () => {
  it('treats request, support and content screens as sensitive', () => {
    for (const route of ['support', 'requests', 'content/[id]', 'referral-info', 'home', 'ai']) {
      assert.equal(isSensitiveRoute(route), true, `${route} should be sensitive`);
    }
  });

  it('treats the neutral screen and unknown routes as non-sensitive', () => {
    assert.equal(isSensitiveRoute(NEUTRAL_ROUTE), false);
    assert.equal(isSensitiveRoute(undefined), false);
    assert.equal(isSensitiveRoute(''), false);
  });
});
