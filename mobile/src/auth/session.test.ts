import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AuthUser } from './types';
import {
  isUsableUser,
  resolveProtectedRoute,
  restoreSession,
} from './session';
import {
  isPlainUser,
  isPrivilegedRole,
  isStaffRole,
  roleLabelKey,
} from './roles';

const USER: AuthUser = {
  id: 'user-1',
  email: 'parent@example.org',
  role: 'USER',
};

interface Harness {
  token: string | null;
  cleared: number;
  deps: Parameters<typeof restoreSession>[0];
}

function harness(token: string | null, me: () => Promise<AuthUser>): Harness {
  const state = {
    token,
    cleared: 0,
    deps: {
      async getToken() {
        return state.token;
      },
      async fetchMe() {
        return me();
      },
      async clearToken() {
        state.cleared += 1;
        state.token = null;
      },
    },
  };
  return state;
}

describe('authentication persistence', () => {
  it('keeps the session and returns the verified user when the token is valid', async () => {
    const h = harness('stored-token', async () => USER);

    const restored = await restoreSession(h.deps);

    assert.deepEqual(restored, USER);
    assert.equal(h.cleared, 0);
  });

  it('never trusts a role from local storage: the server response wins', async () => {
    const h = harness('stored-token', async () => ({
      ...USER,
      role: 'USER',
      institutionId: null,
    }));

    const restored = await restoreSession(h.deps);

    assert.equal(restored?.role, 'USER');
  });

  it('clears the stored token when verification fails', async () => {
    const h = harness('expired-token', async () => {
      throw Object.assign(new Error('unauthorized'), {
        response: { status: 401 },
      });
    });

    const restored = await restoreSession(h.deps);

    assert.equal(restored, null);
    assert.equal(h.token, null);
    assert.equal(h.cleared, 1);
  });

  it('returns null without calling the server when no token is stored', async () => {
    let calls = 0;
    const h = harness(null, async () => {
      calls += 1;
      return USER;
    });

    assert.equal(await restoreSession(h.deps), null);
    assert.equal(calls, 0);
    assert.equal(h.cleared, 0);
  });

  it('clears the token when the server returns a malformed identity', async () => {
    const h = harness('bad-token', async () => ({ id: '', email: '', role: 'USER' }));

    assert.equal(await restoreSession(h.deps), null);
    assert.equal(h.token, null);
    assert.equal(h.cleared, 1);
  });

  it('rejects unusable identities', () => {
    assert.equal(isUsableUser(USER), true);
    assert.equal(isUsableUser(null), false);
    assert.equal(isUsableUser({ id: 'x', email: '', role: 'USER' }), false);
  });
});

describe('protected routes', () => {
  it('waits while the auth state is unknown', () => {
    assert.deepEqual(resolveProtectedRoute('unknown'), { kind: 'loading' });
  });

  it('redirects anonymous users to sign-in', () => {
    assert.deepEqual(resolveProtectedRoute('anonymous'), {
      kind: 'redirect',
      to: 'auth/sign-in',
    });
  });

  it('allows an authenticated session', () => {
    assert.deepEqual(resolveProtectedRoute('authenticated'), { kind: 'allow' });
  });
});

describe('role-aware labels (no privileged mobile UI)', () => {
  it('recognizes plain public users', () => {
    assert.equal(isPlainUser('USER'), true);
    assert.equal(isStaffRole('USER'), false);
    assert.equal(isPrivilegedRole('USER'), false);
    assert.equal(roleLabelKey('USER'), 'account.roleUser');
  });

  it('treats responders as staff but not privileged', () => {
    assert.equal(isStaffRole('RESPONDER'), true);
    assert.equal(isPrivilegedRole('RESPONDER'), false);
    assert.equal(roleLabelKey('RESPONDER'), 'account.roleStaff');
  });

  it('marks privileged roles without granting mobile privileges', () => {
    for (const role of ['ADMIN', 'SUPER_ADMIN', 'AUDITOR']) {
      assert.equal(isPrivilegedRole(role), true);
      assert.equal(isStaffRole(role), true);
      assert.equal(roleLabelKey(role), 'account.roleStaff');
    }
  });

  it('does not treat unknown or missing roles as privileged', () => {
    assert.equal(isPrivilegedRole(undefined), false);
    assert.equal(isStaffRole(null), false);
    assert.equal(roleLabelKey(undefined), 'account.roleUser');
  });
});
