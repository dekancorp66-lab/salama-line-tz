import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createAuthRequests, type AuthHttpClient } from './authRequests';
import { apiErrorKey, translateApiError } from './errors';
import type { AuthUser } from '../auth/types';

interface Call {
  method: 'post' | 'get';
  url: string;
  body?: unknown;
}

function fakeClient(handler: (call: Call) => unknown): AuthHttpClient & { calls: Call[] } {
  const calls: Call[] = [];
  return {
    calls,
    async post(url, body) {
      calls.push({ method: 'post', url, body });
      const data = handler({ method: 'post', url, body });
      if (data instanceof Error) throw data;
      return { data: data as never };
    },
    async get(url) {
      calls.push({ method: 'get', url });
      const data = handler({ method: 'get', url });
      if (data instanceof Error) throw data;
      return { data: data as never };
    },
  };
}

const USER: AuthUser = {
  id: 'user-1',
  email: 'parent@example.org',
  displayName: 'Amani Juma',
  role: 'USER',
};

describe('auth API requests', () => {
  it('registers only the three public DTO fields and normalizes the email', async () => {
    const client = fakeClient(() => ({ message: 'created', user: USER }));
    const requests = createAuthRequests(client);

    const user = await requests.register({
      email: '  Parent@Example.ORG ',
      password: 'A-long-password-123!',
      displayName: '  Amani Juma  ',
    });

    assert.deepEqual(user, USER);
    assert.equal(client.calls[0].url, '/auth/register/public');
    assert.deepEqual(client.calls[0].body, {
      email: 'parent@example.org',
      password: 'A-long-password-123!',
      displayName: 'Amani Juma',
    });
    assert.equal(Object.keys(client.calls[0].body as object).length, 3);
  });

  it('logs in and returns the token and safe user fields', async () => {
    const client = fakeClient(() => ({
      accessToken: 'jwt-token',
      tokenType: 'Bearer',
      expiresIn: '15m',
      user: USER,
    }));
    const requests = createAuthRequests(client);

    const result = await requests.login({
      email: 'PARENT@example.org',
      password: 'A-long-password-123!',
    });

    assert.deepEqual(result, {
      token: 'jwt-token',
      tokenType: 'Bearer',
      expiresIn: '15m',
      user: USER,
    });
    assert.equal(client.calls[0].url, '/auth/login');
    assert.deepEqual(client.calls[0].body, {
      email: 'parent@example.org',
      password: 'A-long-password-123!',
    });
  });

  it('logs out through the guarded endpoint without a body', async () => {
    const client = fakeClient(() => ({ message: 'signed out' }));
    const requests = createAuthRequests(client);

    await requests.logout();

    assert.equal(client.calls.length, 1);
    assert.equal(client.calls[0].method, 'post');
    assert.equal(client.calls[0].url, '/auth/logout');
    assert.equal(client.calls[0].body, undefined);
  });

  it('restores the identity from GET /auth/me', async () => {
    const meUser: AuthUser = {
      id: 'user-1',
      email: 'parent@example.org',
      role: 'USER',
      institutionId: null,
    };
    const client = fakeClient(() => ({ user: meUser }));
    const requests = createAuthRequests(client);

    assert.deepEqual(await requests.me(), meUser);
    assert.equal(client.calls[0].method, 'get');
    assert.equal(client.calls[0].url, '/auth/me');
  });
});

describe('API error handling', () => {
  it('maps a duplicate-account response to the conflict key', () => {
    const error = { response: { status: 409 } };
    assert.equal(apiErrorKey(error), 'errors.conflict');
    assert.equal(translateApiError((key) => `translated:${key}`, error), 'translated:errors.conflict');
  });

  it('maps auth failures and network errors without exposing server text', () => {
    assert.equal(apiErrorKey({ response: { status: 401 } }), 'errors.unauthorized');
    assert.equal(apiErrorKey({ response: { status: 403 } }), 'errors.forbidden');
    assert.equal(apiErrorKey({ response: { status: 429 } }), 'errors.rateLimited');
    assert.equal(apiErrorKey({ code: 'ECONNABORTED' }), 'errors.timeout');
    assert.equal(apiErrorKey({}), 'errors.network');
  });

  it('propagates a login rejection so the UI can show a safe error', async () => {
    const rejected = Object.assign(new Error('request failed'), {
      response: { status: 401 },
    });
    const client = fakeClient(() => rejected);
    const requests = createAuthRequests(client);

    await assert.rejects(
      () => requests.login({ email: 'parent@example.org', password: 'wrong' }),
      (error: unknown) => apiErrorKey(error) === 'errors.unauthorized',
    );
  });
});
