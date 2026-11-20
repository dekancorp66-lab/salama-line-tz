import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  AI_CONTEXT_LIMIT,
  AI_TURN_LIMIT,
  createAiRequests,
  type AiHttpClient,
} from './aiRequests';
import { apiErrorKey } from './errors';

interface Call {
  method: 'post' | 'get';
  url: string;
  body?: unknown;
}

function fakeClient(handler: (call: Call) => unknown): AiHttpClient & { calls: Call[] } {
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

const HEALTH = {
  status: 'ok' as const,
  service: 'SalamaLine AI',
  knowledgeBase: { loaded: true, records: 255 },
};

const ANSWER = {
  answer: 'Hapana. Haipaswi kufanywa.',
  language: 'sw' as const,
  sources: [{ id: 'TZA_LCA_2023', name: 'The Law of the Child Act' }],
  status: 'answered' as const,
  generatedBy: 'grounded_fallback' as const,
};

describe('AI API requests', () => {
  it('reads health from the verified public endpoint', async () => {
    const client = fakeClient(() => HEALTH);
    const requests = createAiRequests(client);

    assert.deepEqual(await requests.health(), HEALTH);
    assert.equal(client.calls.length, 1);
    assert.equal(client.calls[0].method, 'get');
    assert.equal(client.calls[0].url, '/ai/health');
  });

  it('asks with only DTO fields and a bounded conversation window', async () => {
    const client = fakeClient(() => ANSWER);
    const requests = createAiRequests(client);

    const context = Array.from({ length: 10 }, (_, index) => ({
      role: (index % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `turn-${index}`,
    }));

    const result = await requests.ask({
      question: '  Ni nini sheria ya ndoa ya utoto?  ',
      language: 'sw',
      context,
    });

    assert.deepEqual(result, ANSWER);
    assert.equal(client.calls[0].method, 'post');
    assert.equal(client.calls[0].url, '/ai/ask');
    const body = client.calls[0].body as Record<string, unknown>;
    assert.deepEqual(Object.keys(body).sort(), ['context', 'language', 'question']);
    assert.equal(body.question, 'Ni nini sheria ya ndoa ya utoto?');
    assert.equal(body.language, 'sw');
    assert.equal((body.context as unknown[]).length, AI_CONTEXT_LIMIT);
    assert.equal((body.context as Array<{ content: string }>)[0].content, 'turn-4');
  });

  it('clamps long conversation turns to the backend DTO limit', async () => {
    const client = fakeClient(() => ANSWER);
    const requests = createAiRequests(client);

    await requests.ask({
      question: 'Nini sheria?',
      language: 'sw',
      context: [{ role: 'assistant', content: 'a'.repeat(AI_TURN_LIMIT + 50) }],
    });

    const body = client.calls[0].body as { context: Array<{ content: string }> };
    assert.equal(body.context[0].content.length, AI_TURN_LIMIT);
  });

  it('propagates rate limits so the UI can show the safe translated error', async () => {
    const rejected = Object.assign(new Error('request failed'), {
      response: { status: 429 },
    });
    const client = fakeClient(() => rejected);
    const requests = createAiRequests(client);

    await assert.rejects(
      () => requests.ask({ question: 'Nini sheria?', language: 'sw' }),
      (error: unknown) => apiErrorKey(error) === 'errors.rateLimited',
    );
  });
});
