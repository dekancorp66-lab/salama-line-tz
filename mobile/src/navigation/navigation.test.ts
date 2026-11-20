import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildNeutralResetAction,
  buildReturnResetAction,
  isSensitiveRoute,
  NEUTRAL_ROUTE,
  RETURN_ROUTE,
} from './quickExit';

describe('Quick Exit navigation reset', () => {
  it('leaves only the neutral screen in the navigation stack', () => {
    const action = buildNeutralResetAction();
    assert.deepEqual(action, {
      index: 0,
      routes: [{ name: NEUTRAL_ROUTE }],
    });
  });

  it('never keeps a sensitive screen in the reset history', () => {
    const action = buildNeutralResetAction();
    assert.equal(action.routes.length, 1);
    assert.equal(isSensitiveRoute(action.routes[0].name), false);
  });

  it('builds a fresh normal stack when the user explicitly returns', () => {
    const action = buildReturnResetAction();
    assert.deepEqual(action, {
      index: 0,
      routes: [{ name: RETURN_ROUTE }],
    });
    assert.equal(RETURN_ROUTE, 'index');
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
